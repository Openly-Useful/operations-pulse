import { ImapFlow } from "imapflow";
import type { ConnectionCheck, ConnectionConfig, EventStatus } from "./types.js";
import { OperationsStore } from "./db.js";

type FetchLike = typeof fetch;

export type ImapClient = Pick<ImapFlow, "connect" | "logout" | "getMailboxLock" | "search" | "fetchAll">;

export type ConnectionTestDependencies = {
  fetchImpl?: FetchLike;
  imapFactory?: (options: ConstructorParameters<typeof ImapFlow>[0]) => ImapClient;
};

function check(
  connectionId: string,
  status: EventStatus,
  summary: string,
  evidence: Record<string, unknown>,
): ConnectionCheck {
  return { connectionId, checkId: `connection:${connectionId}`, status, summary, evidence };
}

function credential(connection: ConnectionConfig): string | null {
  return connection.credentialEnv ? process.env[connection.credentialEnv] ?? null : null;
}

function requiredSetting(connection: ConnectionConfig, key: string): string | null {
  const value = connection.settings[key]?.trim();
  return value || null;
}

function endpoint(connection: ConnectionConfig, fallback: string): string {
  return (connection.endpoint ?? fallback).replace(/\/$/, "");
}

function connectionError(connection: ConnectionConfig, reason: string): ConnectionCheck {
  return check(connection.id, "blocked", reason, {
    configured: true,
    credentialReference: connection.credentialEnv,
    credentialPresent: Boolean(credential(connection)),
    secretStored: false,
  });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > 200_000) throw new Error("Connection response exceeded the 200 KB safety limit.");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Connection returned a non-JSON response.");
  }
}

async function getJson(
  fetchImpl: FetchLike,
  url: string,
  authorization: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ response: Response; json: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        ...extraHeaders,
      },
      redirect: "error",
      signal: controller.signal,
    });
    const json = await readJson(response);
    return { response, json };
  } finally {
    clearTimeout(timeout);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function testGitHub(connection: ConnectionConfig, fetchImpl: FetchLike): Promise<ConnectionCheck> {
  const token = credential(connection);
  if (!token) return connectionError(connection, `Set ${connection.credentialEnv ?? "a credential environment variable"} before testing GitHub.`);
  const { response, json } = await getJson(
    fetchImpl,
    `${endpoint(connection, "https://api.github.com")}/user`,
    `Bearer ${token}`,
    { "X-GitHub-Api-Version": "2022-11-28" },
  );
  if (!response.ok) return check(connection.id, "blocked", `GitHub rejected the configured credential (${response.status}).`, { status: response.status, secretStored: false });
  const user = asObject(json);
  return check(connection.id, "pass", "GitHub read-only connection verified.", {
    account: typeof user.login === "string" ? user.login : "authenticated",
    scopes: response.headers.get("x-oauth-scopes")?.split(",").map((item) => item.trim()).filter(Boolean) ?? [],
    secretStored: false,
  });
}

async function testLinear(connection: ConnectionConfig, fetchImpl: FetchLike): Promise<ConnectionCheck> {
  const token = credential(connection);
  if (!token) return connectionError(connection, `Set ${connection.credentialEnv ?? "a credential environment variable"} before testing Linear.`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(`${endpoint(connection, "https://api.linear.app")}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ query: "query OperationsPulseViewer { viewer { id name } }" }),
      redirect: "error",
      signal: controller.signal,
    });
    const json = asObject(await readJson(response));
    const viewer = asObject(asObject(json.data).viewer);
    if (!response.ok || Array.isArray(json.errors)) {
      return check(connection.id, "blocked", `Linear rejected the configured credential (${response.status}).`, { status: response.status, secretStored: false });
    }
    return check(connection.id, "pass", "Linear read-only connection verified.", {
      account: typeof viewer.name === "string" ? viewer.name : "authenticated",
      secretStored: false,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function testSentry(connection: ConnectionConfig, fetchImpl: FetchLike): Promise<ConnectionCheck> {
  const token = credential(connection);
  const organization = requiredSetting(connection, "organization");
  if (!token) return connectionError(connection, `Set ${connection.credentialEnv ?? "a credential environment variable"} before testing Sentry.`);
  if (!organization) return connectionError(connection, "Sentry requires a non-secret organization setting before it can be tested.");
  const { response, json } = await getJson(
    fetchImpl,
    `${endpoint(connection, "https://sentry.io")}/api/0/organizations/${encodeURIComponent(organization)}/projects/`,
    `Bearer ${token}`,
  );
  if (!response.ok) return check(connection.id, "blocked", `Sentry rejected the configured connection (${response.status}).`, { status: response.status, secretStored: false });
  return check(connection.id, "pass", "Sentry read-only connection verified.", {
    organization,
    projectCount: Array.isArray(json) ? json.length : 0,
    secretStored: false,
  });
}

async function testPostHog(connection: ConnectionConfig, fetchImpl: FetchLike): Promise<ConnectionCheck> {
  const token = credential(connection);
  const organization = requiredSetting(connection, "organization");
  const project = requiredSetting(connection, "project");
  if (!token) return connectionError(connection, `Set ${connection.credentialEnv ?? "a credential environment variable"} before testing PostHog.`);
  if (!organization || !project) return connectionError(connection, "PostHog requires non-secret organization and project settings before it can be tested.");
  const { response, json } = await getJson(
    fetchImpl,
    `${endpoint(connection, "https://app.posthog.com")}/api/organizations/${encodeURIComponent(organization)}/projects/${encodeURIComponent(project)}/`,
    `Bearer ${token}`,
  );
  if (!response.ok) return check(connection.id, "blocked", `PostHog rejected the configured connection (${response.status}).`, { status: response.status, secretStored: false });
  const projectData = asObject(json);
  return check(connection.id, "pass", "PostHog read-only connection verified.", {
    project: typeof projectData.name === "string" ? projectData.name : project,
    secretStored: false,
  });
}

async function testImap(connection: ConnectionConfig, imapFactory: ConnectionTestDependencies["imapFactory"]): Promise<ConnectionCheck> {
  const encoded = credential(connection);
  if (!encoded) return connectionError(connection, `Set ${connection.credentialEnv ?? "a credential environment variable"} to IMAP credential JSON before testing email.`);
  const host = requiredSetting(connection, "host");
  const user = requiredSetting(connection, "user");
  if (!host || !user) return connectionError(connection, "IMAP requires non-secret host and user settings before it can be tested.");
  let parsed: { password?: string; accessToken?: string };
  try {
    parsed = JSON.parse(encoded) as { password?: string; accessToken?: string };
  } catch {
    return check(connection.id, "blocked", "IMAP credential environment value must be JSON with password or accessToken; no credential was stored.", { secretStored: false });
  }
  if (!parsed.password && !parsed.accessToken) return check(connection.id, "blocked", "IMAP credential JSON did not include password or accessToken.", { secretStored: false });
  const port = Number(requiredSetting(connection, "port") ?? "993");
  if (!Number.isInteger(port) || port < 1 || port > 65535) return connectionError(connection, "IMAP port must be an integer between 1 and 65535.");
  const factory = imapFactory ?? ((options) => new ImapFlow(options));
  const client = factory({
    host,
    port,
    secure: requiredSetting(connection, "secure") !== "false",
    auth: { user, pass: parsed.password, accessToken: parsed.accessToken },
    logger: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const mailbox = requiredSetting(connection, "mailbox") ?? "INBOX";
  const limit = Math.max(1, Math.min(Number(requiredSetting(connection, "limit") ?? "20"), 100));
  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailbox, { readOnly: true });
    try {
      const result = await client.search({ seen: false }, { uid: true, returnOptions: ["COUNT"] });
      const unread = Array.isArray(result) ? result.slice(-limit).length : result && "count" in result ? result.count ?? 0 : 0;
      return check(connection.id, unread ? "warn" : "pass", unread ? `Email connection found ${unread} unread message${unread === 1 ? "" : "s"}.` : "Email connection verified with no unread messages.", {
        mailbox,
        unreadCount: unread,
        sampleLimit: limit,
        contentIncluded: false,
        secretStored: false,
      });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function checkConnection(
  connection: ConnectionConfig,
  dependencies: ConnectionTestDependencies = {},
): Promise<ConnectionCheck> {
  if (connection.state === "disconnected") return connectionError(connection, "Connection is disconnected. Configure it explicitly before testing.");
  if (connection.mode === "host-oauth") {
    return connectionError(connection, "This connection requires the host's OAuth picker. Operations Pulse will not accept OAuth tokens through MCP or chat.");
  }
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    switch (connection.id) {
      case "local-files":
      case "git":
      case "sqlite":
        return check(connection.id, "pass", `${connection.id} is a local capability and requires no remote credential.`, { secretStored: false });
      case "imap-email":
        return await testImap(connection, dependencies.imapFactory);
      case "github":
        return await testGitHub(connection, fetchImpl);
      case "linear":
        return await testLinear(connection, fetchImpl);
      case "sentry":
        return await testSentry(connection, fetchImpl);
      case "posthog":
        return await testPostHog(connection, fetchImpl);
      default:
        return connectionError(connection, `No runtime adapter is available for ${connection.id}. Choose a supported connection or wait for its adapter.`);
    }
  } catch (error) {
    return check(connection.id, "blocked", `${connection.id} could not be reached or verified.`, {
      error: error instanceof Error ? error.message.slice(0, 300) : "Unknown connection error",
      secretStored: false,
    });
  }
}

export async function testStoredConnection(
  store: OperationsStore,
  connectionId: string,
  dependencies: ConnectionTestDependencies = {},
): Promise<ConnectionCheck> {
  const connection = store.getConnection(connectionId);
  if (!connection) {
    return check(connectionId, "blocked", `Connection ${connectionId} is not configured. Configure it with the CLI before testing.`, { configured: false, secretStored: false });
  }
  const result = await checkConnection(connection, dependencies);
  const state = result.status === "pass" || result.status === "warn"
    ? "connected"
    : credential(connection) ? "error" : "needs_credentials";
  store.markConnectionTest(connectionId, state, result.status === "blocked" ? result.summary : null);
  return result;
}

export async function testStoredConnections(
  store: OperationsStore,
  connectionIds: string[],
  dependencies: ConnectionTestDependencies = {},
): Promise<ConnectionCheck[]> {
  return Promise.all(connectionIds.map((connectionId) => testStoredConnection(store, connectionId, dependencies)));
}

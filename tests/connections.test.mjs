import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  heartbeatPlan,
  OperationsStore,
  runConnectedPulse,
  testStoredConnection,
} from "../packages/core/dist/index.js";

function storeFixture() {
  const root = mkdtempSync(join(tmpdir(), "operations-pulse-connections-"));
  return new OperationsStore(join(root, "pulse.sqlite"));
}

test("connection records retain only references and disconnect clears the credential reference", () => {
  const store = storeFixture();
  const connection = store.configureConnection({
    id: "github",
    mode: "env-token",
    credentialEnv: "OPERATIONS_PULSE_GITHUB_TOKEN",
    endpoint: "https://api.github.com",
  });
  assert.equal(connection.credentialEnv, "OPERATIONS_PULSE_GITHUB_TOKEN");
  assert.deepEqual(connection.settings, {});
  assert.throws(
    () => store.configureConnection({ id: "github", mode: "env-token", settings: { token: "not-allowed" } }),
    /non-secret/,
  );
  const disconnected = store.disconnectConnection("github");
  assert.equal(disconnected.state, "disconnected");
  assert.equal(disconnected.credentialEnv, null);
  store.close();
});

test("GitHub adapter validates a credential reference without exposing the token", async () => {
  const store = storeFixture();
  process.env.OPERATIONS_PULSE_TEST_GITHUB_TOKEN = "test-token";
  store.configureConnection({
    id: "github",
    mode: "env-token",
    credentialEnv: "OPERATIONS_PULSE_TEST_GITHUB_TOKEN",
  });
  const result = await testStoredConnection(store, "github", {
    fetchImpl: async (url, init) => {
      assert.equal(String(url), "https://api.github.com/user");
      assert.equal(init.headers.Authorization, "Bearer test-token");
      return new Response(JSON.stringify({ login: "openly-useful-test" }), {
        status: 200,
        headers: { "x-oauth-scopes": "read:user, repo" },
      });
    },
  });
  assert.equal(result.status, "pass");
  assert.equal(result.evidence.account, "openly-useful-test");
  assert.equal(JSON.stringify(result).includes("test-token"), false);
  assert.equal(store.getConnection("github")?.state, "connected");
  delete process.env.OPERATIONS_PULSE_TEST_GITHUB_TOKEN;
  store.close();
});

test("GitHub CLI mode reads a local session only at test time and never records its token", async () => {
  const store = storeFixture();
  store.configureConnection({ id: "github", mode: "github-cli" });
  const result = await testStoredConnection(store, "github", {
    githubToken: () => "github-cli-test-token",
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, "Bearer github-cli-test-token");
      return new Response(JSON.stringify({ login: "local-gh-user" }), {
        status: 200,
        headers: { "x-oauth-scopes": "read:org, repo" },
      });
    },
  });
  assert.equal(result.status, "pass");
  assert.equal(result.evidence.credentialSource, "local-github-cli");
  assert.equal(JSON.stringify(result).includes("github-cli-test-token"), false);
  assert.equal(store.getConnection("github")?.credentialEnv, null);
  assert.equal(store.getConnection("github")?.state, "connected");
  store.close();
});

test("IMAP adapter reads only unread-count metadata", async () => {
  const store = storeFixture();
  process.env.OPERATIONS_PULSE_TEST_IMAP = JSON.stringify({ password: "not-recorded" });
  store.configureConnection({
    id: "imap-email",
    mode: "env-token",
    credentialEnv: "OPERATIONS_PULSE_TEST_IMAP",
    settings: { host: "imap.example.test", user: "ops@example.test", mailbox: "INBOX", limit: "10" },
  });
  const calls = [];
  const result = await testStoredConnection(store, "imap-email", {
    imapFactory: () => ({
      connect: async () => calls.push("connect"),
      logout: async () => calls.push("logout"),
      getMailboxLock: async () => ({ release: () => calls.push("release") }),
      search: async () => ({ count: 3 }),
      fetchAll: async () => [],
    }),
  });
  assert.equal(result.status, "warn");
  assert.equal(result.evidence.unreadCount, 3);
  assert.equal(result.evidence.contentIncluded, false);
  assert.equal(JSON.stringify(result).includes("not-recorded"), false);
  assert.deepEqual(calls, ["connect", "release", "logout"]);
  delete process.env.OPERATIONS_PULSE_TEST_IMAP;
  store.close();
});

test("Linear, Sentry, and PostHog adapters use bounded read-only probes", async () => {
  const store = storeFixture();
  process.env.OPERATIONS_PULSE_TEST_SAAS = "test-token";
  store.configureConnection({ id: "linear", mode: "env-token", credentialEnv: "OPERATIONS_PULSE_TEST_SAAS" });
  store.configureConnection({
    id: "sentry",
    mode: "env-token",
    credentialEnv: "OPERATIONS_PULSE_TEST_SAAS",
    settings: { organization: "openly-useful" },
  });
  store.configureConnection({
    id: "posthog",
    mode: "env-token",
    credentialEnv: "OPERATIONS_PULSE_TEST_SAAS",
    settings: { organization: "42", project: "9" },
  });
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    seen.push({ url: String(url), method: init.method ?? "GET" });
    if (String(url).endsWith("/graphql")) {
      assert.equal(init.method, "POST");
      return new Response(JSON.stringify({ data: { viewer: { id: "viewer", name: "Pulse Owner" } } }), { status: 200 });
    }
    if (String(url).includes("sentry.io")) return new Response(JSON.stringify([{ slug: "api" }]), { status: 200 });
    return new Response(JSON.stringify({ id: 9, name: "Pulse Project" }), { status: 200 });
  };
  const [linear, sentry, posthog] = await Promise.all([
    testStoredConnection(store, "linear", { fetchImpl }),
    testStoredConnection(store, "sentry", { fetchImpl }),
    testStoredConnection(store, "posthog", { fetchImpl }),
  ]);
  assert.deepEqual([linear.status, sentry.status, posthog.status], ["pass", "pass", "pass"]);
  assert.equal(JSON.stringify([linear, sentry, posthog]).includes("test-token"), false);
  assert.ok(seen.every((request) => request.method === "GET" || request.method === "POST"));
  delete process.env.OPERATIONS_PULSE_TEST_SAAS;
  store.close();
});

test("connected pulses preserve the local baseline when an adapter is not configured", async () => {
  const store = storeFixture();
  const result = await runConnectedPulse(store, {
    workspace: process.cwd(),
    connectionIds: ["github"],
  });
  assert.ok(result.events.some((event) => event.checkId === "connection:github" && event.status === "blocked"));
  assert.ok(result.events.some((event) => event.checkId === "git_worktree"));
  store.close();
});

test("heartbeat plan is explicit, bounded, and does not include credentials", () => {
  const plan = heartbeatPlan({
    workspace: "/workspace",
    database: "/workspace/.operations-pulse/pulse.sqlite",
    intervalMinutes: 30,
    logPaths: ["app.log"],
    connectionIds: ["github"],
    createTickets: false,
  }, "/tmp/operations-pulse-home");
  assert.equal(plan.supported, process.platform === "darwin");
  assert.deepEqual(plan.connectionIds, ["github"]);
  assert.equal(JSON.stringify(plan).includes("token"), false);
  assert.throws(() => heartbeatPlan({
    workspace: "/workspace",
    database: "/workspace/pulse.sqlite",
    intervalMinutes: 1,
    logPaths: [],
    connectionIds: [],
    createTickets: false,
  }), /5 to 1440/);
});

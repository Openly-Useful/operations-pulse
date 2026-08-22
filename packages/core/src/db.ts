import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CONNECTION_MODES } from "./types.js";
import type {
  CreateTicketInput,
  PulseEvent,
  PulseRun,
  Ticket,
  TicketPriority,
  TicketQuery,
  TicketStatus,
  ConnectionConfig,
  ConfigureConnectionInput,
  ConnectionState,
} from "./types.js";

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: string;
  source_ref: string | null;
  tags_json: string;
  created_at: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  workspace: string;
  status: "running" | "completed" | "failed";
  summary: string | null;
  started_at: string;
  completed_at: string | null;
};

type EventRow = {
  id: string;
  run_id: string;
  check_id: string;
  status: "pass" | "warn" | "fail" | "blocked";
  summary: string;
  evidence_json: string;
  ticket_id: string | null;
  created_at: string;
};

type ConnectionRow = {
  id: string;
  mode: ConnectionConfig["mode"];
  credential_env: string | null;
  endpoint: string | null;
  settings_json: string;
  state: ConnectionState;
  configured_at: string;
  tested_at: string | null;
  last_error: string | null;
};

function ticketFromRow(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    source: row.source,
    sourceRef: row.source_ref,
    tags: JSON.parse(row.tags_json) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function runFromRow(row: RunRow): PulseRun {
  return {
    id: row.id,
    workspace: row.workspace,
    status: row.status,
    summary: row.summary,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function eventFromRow(row: EventRow): PulseEvent {
  return {
    id: row.id,
    runId: row.run_id,
    checkId: row.check_id,
    status: row.status,
    summary: row.summary,
    evidence: JSON.parse(row.evidence_json) as Record<string, unknown>,
    ticketId: row.ticket_id,
    createdAt: row.created_at,
  };
}

function connectionFromRow(row: ConnectionRow): ConnectionConfig {
  return {
    id: row.id,
    mode: row.mode,
    credentialEnv: row.credential_env,
    endpoint: row.endpoint,
    settings: JSON.parse(row.settings_json) as Record<string, string>,
    state: row.state,
    configuredAt: row.configured_at,
    testedAt: row.tested_at,
    lastError: row.last_error,
  };
}

function assertSafeConnectionInput(input: ConfigureConnectionInput): void {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(input.id)) {
    throw new Error("Connection ID must be a lowercase catalog-style identifier.");
  }
  if (!CONNECTION_MODES.includes(input.mode)) {
    throw new Error(`Unsupported connection mode: ${input.mode}`);
  }
  if (input.mode === "github-cli" && input.id !== "github") {
    throw new Error("github-cli mode is available only for the GitHub connection.");
  }
  if (input.mode === "github-cli" && input.credentialEnv) {
    throw new Error("github-cli reads the existing local GitHub CLI session and does not accept a credential environment variable.");
  }
  if (input.credentialEnv && !/^[A-Z][A-Z0-9_]{1,127}$/.test(input.credentialEnv)) {
    throw new Error("credentialEnv must be an environment-variable name, never a credential value.");
  }
  if (input.endpoint) {
    const url = new URL(input.endpoint);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) {
      throw new Error("Connection endpoint must use HTTPS, except for explicit loopback self-hosted development.");
    }
    if (url.username || url.password) {
      throw new Error("Connection endpoint must not embed credentials.");
    }
  }
  for (const [key, value] of Object.entries(input.settings ?? {})) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key) || /token|secret|password|credential|api_?key/i.test(key)) {
      throw new Error("Connection settings may contain only non-secret, lowercase configuration keys.");
    }
    if (typeof value !== "string" || value.length > 500 || /[\r\n]/.test(value)) {
      throw new Error(`Connection setting ${key} must be one short single-line string.`);
    }
  }
}

export class OperationsStore {
  readonly path: string;
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);
    this.migrate();
  }

  migrate(): void {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('backlog','triaged','in_progress','blocked','done','closed')),
        priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
        source TEXT NOT NULL,
        source_ref TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS tickets_status_priority_idx
        ON tickets(status, priority, updated_at DESC);

      CREATE TABLE IF NOT EXISTS pulse_runs (
        id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
        summary TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS pulse_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES pulse_runs(id) ON DELETE CASCADE,
        check_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pass','warn','fail','blocked')),
        summary TEXT NOT NULL,
        evidence_json TEXT NOT NULL DEFAULT '{}',
        ticket_id TEXT REFERENCES tickets(id),
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS pulse_events_run_idx
        ON pulse_events(run_id, created_at);

      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('local','host-oauth','env-token','self-hosted','github-cli')),
        credential_env TEXT,
        endpoint TEXT,
        settings_json TEXT NOT NULL DEFAULT '{}',
        state TEXT NOT NULL CHECK (state IN ('configured','connected','needs_credentials','error','disconnected')),
        configured_at TEXT NOT NULL,
        tested_at TEXT,
        last_error TEXT
      );

      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (1, datetime('now'));

      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (2, datetime('now'));
    `);

    const githubCliMigration = this.db.prepare("SELECT version FROM schema_migrations WHERE version = 3").get() as { version: number } | undefined;
    if (!githubCliMigration) {
      this.db.exec(`
        BEGIN IMMEDIATE;
        ALTER TABLE connections RENAME TO connections_before_github_cli;
        CREATE TABLE connections (
          id TEXT PRIMARY KEY,
          mode TEXT NOT NULL CHECK (mode IN ('local','host-oauth','env-token','self-hosted','github-cli')),
          credential_env TEXT,
          endpoint TEXT,
          settings_json TEXT NOT NULL DEFAULT '{}',
          state TEXT NOT NULL CHECK (state IN ('configured','connected','needs_credentials','error','disconnected')),
          configured_at TEXT NOT NULL,
          tested_at TEXT,
          last_error TEXT
        );
        INSERT INTO connections (id, mode, credential_env, endpoint, settings_json, state, configured_at, tested_at, last_error)
          SELECT id, mode, credential_env, endpoint, settings_json, state, configured_at, tested_at, last_error
          FROM connections_before_github_cli;
        DROP TABLE connections_before_github_cli;
        INSERT INTO schema_migrations(version, applied_at) VALUES (3, datetime('now'));
        COMMIT;
      `);
    }
  }

  close(): void {
    this.db.close();
  }

  createTicket(input: CreateTicketInput): Ticket {
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: randomUUID(),
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      status: input.status ?? "backlog",
      priority: input.priority ?? "medium",
      source: input.source ?? "human",
      sourceRef: input.sourceRef ?? null,
      tags: [...new Set(input.tags ?? [])].sort(),
      createdAt: now,
      updatedAt: now,
    };

    if (!ticket.title) {
      throw new Error("Ticket title must not be empty.");
    }

    this.db
      .prepare(`
        INSERT INTO tickets
          (id, title, description, status, priority, source, source_ref, tags_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.status,
        ticket.priority,
        ticket.source,
        ticket.sourceRef,
        JSON.stringify(ticket.tags),
        ticket.createdAt,
        ticket.updatedAt,
      );

    return ticket;
  }

  listTickets(query: TicketQuery = {}): Ticket[] {
    const where: string[] = [];
    const values: Array<string | number> = [];

    if (query.status) {
      where.push("status = ?");
      values.push(query.status);
    }
    if (query.priority) {
      where.push("priority = ?");
      values.push(query.priority);
    }
    if (query.query?.trim()) {
      where.push("(title LIKE ? OR description LIKE ? OR tags_json LIKE ?)");
      const pattern = `%${query.query.trim()}%`;
      values.push(pattern, pattern, pattern);
    }

    const limit = Math.max(1, Math.min(query.limit ?? 50, 200));
    values.push(limit);
    const sql = `
      SELECT * FROM tickets
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        updated_at DESC
      LIMIT ?
    `;

    return (this.db.prepare(sql).all(...values) as TicketRow[]).map(ticketFromRow);
  }

  startPulse(workspace: string): PulseRun {
    const run: PulseRun = {
      id: randomUUID(),
      workspace: resolve(workspace),
      status: "running",
      summary: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    this.db
      .prepare("INSERT INTO pulse_runs (id, workspace, status, started_at) VALUES (?, ?, ?, ?)")
      .run(run.id, run.workspace, run.status, run.startedAt);
    return run;
  }

  completePulse(id: string, summary: string, status: "completed" | "failed" = "completed"): PulseRun {
    const completedAt = new Date().toISOString();
    this.db
      .prepare("UPDATE pulse_runs SET status = ?, summary = ?, completed_at = ? WHERE id = ?")
      .run(status, summary, completedAt, id);
    const row = this.db.prepare("SELECT * FROM pulse_runs WHERE id = ?").get(id) as RunRow | undefined;
    if (!row) throw new Error(`Pulse run not found: ${id}`);
    return runFromRow(row);
  }

  recordEvent(input: Omit<PulseEvent, "id" | "createdAt">): PulseEvent {
    const event: PulseEvent = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(`
        INSERT INTO pulse_events
          (id, run_id, check_id, status, summary, evidence_json, ticket_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        event.id,
        event.runId,
        event.checkId,
        event.status,
        event.summary,
        JSON.stringify(event.evidence),
        event.ticketId,
        event.createdAt,
      );
    return event;
  }

  attachEventTicket(eventId: string, ticketId: string): void {
    this.db.prepare("UPDATE pulse_events SET ticket_id = ? WHERE id = ?").run(ticketId, eventId);
  }

  pulseHistory(limit = 20): PulseRun[] {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = this.db
      .prepare("SELECT * FROM pulse_runs ORDER BY started_at DESC LIMIT ?")
      .all(safeLimit) as RunRow[];
    return rows.map((row) => {
      const run = runFromRow(row);
      run.events = (
        this.db
          .prepare("SELECT * FROM pulse_events WHERE run_id = ? ORDER BY created_at")
          .all(run.id) as EventRow[]
      ).map(eventFromRow);
      return run;
    });
  }

  configureConnection(input: ConfigureConnectionInput): ConnectionConfig {
    assertSafeConnectionInput(input);
    const now = new Date().toISOString();
    const existing = this.getConnection(input.id);
    const connection: ConnectionConfig = {
      id: input.id,
      mode: input.mode,
      credentialEnv: input.credentialEnv?.trim() || null,
      endpoint: input.endpoint?.trim() || null,
      settings: input.settings ?? {},
      state: "configured",
      configuredAt: existing?.configuredAt ?? now,
      testedAt: null,
      lastError: null,
    };
    this.db
      .prepare(`
        INSERT INTO connections
          (id, mode, credential_env, endpoint, settings_json, state, configured_at, tested_at, last_error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          mode = excluded.mode,
          credential_env = excluded.credential_env,
          endpoint = excluded.endpoint,
          settings_json = excluded.settings_json,
          state = excluded.state,
          tested_at = excluded.tested_at,
          last_error = excluded.last_error
      `)
      .run(
        connection.id,
        connection.mode,
        connection.credentialEnv,
        connection.endpoint,
        JSON.stringify(connection.settings),
        connection.state,
        connection.configuredAt,
        connection.testedAt,
        connection.lastError,
      );
    return connection;
  }

  getConnection(id: string): ConnectionConfig | null {
    const row = this.db.prepare("SELECT * FROM connections WHERE id = ?").get(id) as ConnectionRow | undefined;
    return row ? connectionFromRow(row) : null;
  }

  listConnections(): ConnectionConfig[] {
    return (this.db.prepare("SELECT * FROM connections ORDER BY id").all() as ConnectionRow[]).map(connectionFromRow);
  }

  markConnectionTest(id: string, state: ConnectionState, lastError: string | null = null): ConnectionConfig {
    const testedAt = new Date().toISOString();
    this.db
      .prepare("UPDATE connections SET state = ?, tested_at = ?, last_error = ? WHERE id = ?")
      .run(state, testedAt, lastError, id);
    const connection = this.getConnection(id);
    if (!connection) throw new Error(`Connection not found: ${id}`);
    return connection;
  }

  disconnectConnection(id: string): ConnectionConfig {
    const existing = this.getConnection(id);
    if (!existing) throw new Error(`Connection not found: ${id}`);
    this.db
      .prepare("UPDATE connections SET credential_env = NULL, state = 'disconnected', tested_at = NULL, last_error = NULL WHERE id = ?")
      .run(id);
    const connection = this.getConnection(id);
    if (!connection) throw new Error(`Connection not found: ${id}`);
    return connection;
  }
}

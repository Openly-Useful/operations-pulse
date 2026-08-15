#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  OperationsStore,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  runPulse,
} from "@openly-useful/operations-pulse-core";
import { z } from "zod";

type JsonObject = Record<string, unknown>;

function loadCatalog(name: "tools" | "connections"): JsonObject {
  const url = new URL(`../../../catalog/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as JsonObject;
}

function response(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: { result: value },
  };
}

const toolsCatalog = loadCatalog("tools");
const connectionsCatalog = loadCatalog("connections");
const store = new OperationsStore(
  process.env.OPERATIONS_PULSE_DB ?? resolve(".operations-pulse/pulse.sqlite"),
);

const server = new McpServer({
  name: "operations-pulse",
  version: "0.1.0",
});

server.registerTool(
  "operations_describe",
  {
    title: "Describe Operations Pulse",
    description:
      "Explain all available tools, examples, cost classes, data boundaries, write behavior, and approvals. Use this at setup or before selecting a workflow.",
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => response({ tools: toolsCatalog, connections: connectionsCatalog }),
);

server.registerTool(
  "tickets_list",
  {
    title: "List operational tickets",
    description:
      "Query local ticket memory before staffing or creating work. Supports status, priority, text, and bounded result filters.",
    inputSchema: z.object({
      status: z.enum(TICKET_STATUSES).optional(),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      query: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => response(store.listTickets(input)),
);

server.registerTool(
  "ticket_create",
  {
    title: "Create an operational ticket",
    description:
      "Create one explicit local ticket after checking for related work. Agent-authored and pulse-authored ideas should remain in backlog until human triage.",
    inputSchema: z.object({
      title: z.string().min(1).max(240),
      description: z.string().max(10_000).default(""),
      priority: z.enum(TICKET_PRIORITIES).default("medium"),
      status: z.enum(TICKET_STATUSES).default("backlog"),
      source: z.enum(["human", "agent", "pulse", "import"]).default("human"),
      source_ref: z.string().max(500).optional(),
      tags: z.array(z.string().min(1).max(60)).max(20).default([]),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async (input) =>
    response(
      store.createTicket({
        ...input,
        sourceRef: input.source_ref,
      }),
    ),
);

server.registerTool(
  "pulse_run",
  {
    title: "Run an operations pulse",
    description:
      "Run deterministic local repository, documentation, and optional log checks. The run is stored locally. Ticket creation is disabled unless create_tickets is explicitly true.",
    inputSchema: z.object({
      workspace: z.string().default("."),
      create_tickets: z.boolean().default(false),
      log_paths: z.array(z.string()).max(20).default([]),
      log_patterns: z
        .array(z.string().min(1).max(100))
        .max(30)
        .default(["error", "warn", "retry", "timeout"]),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async (input) =>
    response(
      runPulse(store, {
        workspace: input.workspace,
        createTickets: input.create_tickets,
        localLogs: input.log_paths.length
          ? { paths: input.log_paths, patterns: input.log_patterns }
          : undefined,
      }),
    ),
);

server.registerTool(
  "pulse_history",
  {
    title: "Read pulse history",
    description:
      "Read recent local pulse runs with check events to identify repeated noise, regressions, and changes over time.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ limit }) => response(store.pulseHistory(limit)),
);

server.registerTool(
  "connections_list",
  {
    title: "List optional connections",
    description:
      "Show free/local, self-hosted, subscription, and bring-your-own-credential options with scopes, write behavior, status, and setup method. This never returns secrets.",
    inputSchema: z.object({
      status: z.enum(["available", "experimental", "planned"]).optional(),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ status }) => {
    const values = (connectionsCatalog.connections ?? []) as JsonObject[];
    return response({
      ...connectionsCatalog,
      connections: status ? values.filter((item) => item.status === status) : values,
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", () => {
  store.close();
  process.exit(0);
});

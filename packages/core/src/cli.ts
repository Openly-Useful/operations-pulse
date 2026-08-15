#!/usr/bin/env node

import { resolve } from "node:path";
import { OperationsStore } from "./db.js";
import { runPulse } from "./pulse.js";
import type { TicketPriority, TicketStatus } from "./types.js";

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function databasePath(): string {
  return process.env.OPERATIONS_PULSE_DB ?? resolve(".operations-pulse/pulse.sqlite");
}

function help(): never {
  process.stdout.write(`Operations Pulse

Usage:
  operations-pulse init
  operations-pulse pulse run [--root PATH] [--logs a.log,b.log] [--create-tickets]
  operations-pulse pulse history [--limit 20]
  operations-pulse tickets list [--status STATUS] [--priority PRIORITY] [--query TEXT] [--limit 50]
  operations-pulse tickets add --title TEXT [--description TEXT] [--priority PRIORITY] [--tags a,b]

Environment:
  OPERATIONS_PULSE_DB   SQLite path (default: .operations-pulse/pulse.sqlite)
`);
  process.exit(0);
}

const args = process.argv.slice(2);
if (!args.length || has(args, "--help") || has(args, "-h")) help();

const store = new OperationsStore(databasePath());

try {
  if (args[0] === "init") {
    process.stdout.write(JSON.stringify({ ok: true, database: store.path }, null, 2) + "\n");
  } else if (args[0] === "pulse" && args[1] === "run") {
    const logValue = valueAfter(args, "--logs");
    const result = runPulse(store, {
      workspace: valueAfter(args, "--root") ?? ".",
      createTickets: has(args, "--create-tickets"),
      localLogs: logValue
        ? { paths: logValue.split(",").map((item) => item.trim()).filter(Boolean) }
        : undefined,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else if (args[0] === "pulse" && args[1] === "history") {
    const limit = Number(valueAfter(args, "--limit") ?? 20);
    process.stdout.write(JSON.stringify(store.pulseHistory(limit), null, 2) + "\n");
  } else if (args[0] === "tickets" && args[1] === "list") {
    const result = store.listTickets({
      status: valueAfter(args, "--status") as TicketStatus | undefined,
      priority: valueAfter(args, "--priority") as TicketPriority | undefined,
      query: valueAfter(args, "--query"),
      limit: Number(valueAfter(args, "--limit") ?? 50),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else if (args[0] === "tickets" && args[1] === "add") {
    const title = valueAfter(args, "--title");
    if (!title) throw new Error("--title is required.");
    const tags = valueAfter(args, "--tags");
    const ticket = store.createTicket({
      title,
      description: valueAfter(args, "--description"),
      priority: valueAfter(args, "--priority") as TicketPriority | undefined,
      tags: tags ? tags.split(",").map((item) => item.trim()).filter(Boolean) : [],
      source: "human",
    });
    process.stdout.write(JSON.stringify(ticket, null, 2) + "\n");
  } else {
    help();
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  store.close();
}

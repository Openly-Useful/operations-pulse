#!/usr/bin/env node

import { resolve } from "node:path";
import { OperationsStore } from "./db.js";
import { testStoredConnection } from "./connections.js";
import { runConnectedPulse, runPulse } from "./pulse.js";
import { heartbeatPlan, heartbeatStatus, installHeartbeat, uninstallHeartbeat } from "./scheduler.js";
import type { ConfigureConnectionInput, TicketPriority, TicketStatus } from "./types.js";

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function valuesAfter(args: string[], flag: string): string[] {
  return args.flatMap((value, index) => value === flag && args[index + 1] ? [args[index + 1]] : []);
}

function csv(value: string | undefined): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function settingsFrom(args: string[]): Record<string, string> {
  return Object.fromEntries(valuesAfter(args, "--setting").map((entry) => {
    const separator = entry.indexOf("=");
    if (separator <= 0) throw new Error("Each --setting must use key=value and may not contain secrets.");
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
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
  operations-pulse connections list
  operations-pulse connections configure --id ID --mode MODE [--credential-env NAME] [--endpoint HTTPS_URL] [--setting key=value]
  operations-pulse connections test --id ID
  operations-pulse connections disconnect --id ID
  operations-pulse schedule plan --interval-minutes 30 [--root PATH] [--logs a.log,b.log] [--connections a,b] [--create-tickets]
  operations-pulse schedule install --confirm-install --interval-minutes 30 [same options as plan]
  operations-pulse schedule uninstall --confirm-uninstall
  operations-pulse heartbeat serve --interval-minutes 30 [same options as plan]

Environment:
  OPERATIONS_PULSE_DB   SQLite path (default: .operations-pulse/pulse.sqlite)
  Connection credentials are read only from the named environment variable. They are never written to SQLite.
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
    const options = {
      workspace: valueAfter(args, "--root") ?? ".",
      createTickets: has(args, "--create-tickets"),
      localLogs: logValue
        ? { paths: logValue.split(",").map((item) => item.trim()).filter(Boolean) }
        : undefined,
    };
    const connectionIds = csv(valueAfter(args, "--connections"));
    const result = connectionIds.length
      ? await runConnectedPulse(store, { ...options, connectionIds })
      : runPulse(store, options);
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
  } else if (args[0] === "connections" && args[1] === "list") {
    process.stdout.write(JSON.stringify(store.listConnections().map((connection) => ({
      ...connection,
      settings: Object.keys(connection.settings).sort(),
      credentialPresent: Boolean(connection.credentialEnv && process.env[connection.credentialEnv]),
    })), null, 2) + "\n");
  } else if (args[0] === "connections" && args[1] === "configure") {
    const id = valueAfter(args, "--id");
    const mode = valueAfter(args, "--mode");
    if (!id || !mode) throw new Error("connections configure requires --id and --mode.");
    const connection = store.configureConnection({
      id,
      mode: mode as ConfigureConnectionInput["mode"],
      credentialEnv: valueAfter(args, "--credential-env"),
      endpoint: valueAfter(args, "--endpoint"),
      settings: settingsFrom(args),
    });
    process.stdout.write(JSON.stringify({
      ...connection,
      settings: Object.keys(connection.settings).sort(),
      credentialPresent: Boolean(connection.credentialEnv && process.env[connection.credentialEnv]),
      secretStored: false,
    }, null, 2) + "\n");
  } else if (args[0] === "connections" && args[1] === "test") {
    const id = valueAfter(args, "--id");
    if (!id) throw new Error("connections test requires --id.");
    process.stdout.write(JSON.stringify(await testStoredConnection(store, id), null, 2) + "\n");
  } else if (args[0] === "connections" && args[1] === "disconnect") {
    const id = valueAfter(args, "--id");
    if (!id) throw new Error("connections disconnect requires --id.");
    const connection = store.disconnectConnection(id);
    process.stdout.write(JSON.stringify({ ...connection, settings: Object.keys(connection.settings).sort(), secretStored: false }, null, 2) + "\n");
  } else if (args[0] === "schedule" && args[1] === "status") {
    process.stdout.write(JSON.stringify(heartbeatStatus(), null, 2) + "\n");
  } else if (args[0] === "schedule" && ["plan", "install"].includes(args[1])) {
    const intervalMinutes = Number(valueAfter(args, "--interval-minutes"));
    const schedule = {
      workspace: valueAfter(args, "--root") ?? ".",
      database: databasePath(),
      intervalMinutes,
      logPaths: csv(valueAfter(args, "--logs")),
      connectionIds: csv(valueAfter(args, "--connections")),
      createTickets: has(args, "--create-tickets"),
    };
    if (args[1] === "install") {
      if (!has(args, "--confirm-install")) throw new Error("schedule install writes one user LaunchAgent. Re-run with --confirm-install after reviewing schedule plan.");
      process.stdout.write(JSON.stringify(installHeartbeat(schedule), null, 2) + "\n");
    } else {
      process.stdout.write(JSON.stringify(heartbeatPlan(schedule), null, 2) + "\n");
    }
  } else if (args[0] === "schedule" && args[1] === "uninstall") {
    if (!has(args, "--confirm-uninstall")) throw new Error("schedule uninstall removes only the Operations Pulse user LaunchAgent. Re-run with --confirm-uninstall.");
    process.stdout.write(JSON.stringify(uninstallHeartbeat(), null, 2) + "\n");
  } else if (args[0] === "heartbeat" && args[1] === "serve") {
    const intervalMinutes = Number(valueAfter(args, "--interval-minutes"));
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 1440) {
      throw new Error("heartbeat serve requires --interval-minutes from 5 to 1440.");
    }
    const options = {
      workspace: valueAfter(args, "--root") ?? ".",
      createTickets: has(args, "--create-tickets"),
      localLogs: csv(valueAfter(args, "--logs")).length ? { paths: csv(valueAfter(args, "--logs")) } : undefined,
    };
    const connectionIds = csv(valueAfter(args, "--connections"));
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const result = connectionIds.length
          ? await runConnectedPulse(store, { ...options, connectionIds })
          : runPulse(store, options);
        process.stdout.write(JSON.stringify(result) + "\n");
      } catch (error) {
        process.stderr.write(`Heartbeat failed: ${error instanceof Error ? error.message : String(error)}\n`);
      } finally {
        running = false;
      }
    };
    await tick();
    const timer = setInterval(() => void tick(), intervalMinutes * 60_000);
    process.on("SIGINT", () => {
      clearInterval(timer);
      store.close();
      process.exit(0);
    });
    await new Promise<void>(() => undefined);
  } else {
    help();
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  store.close();
}

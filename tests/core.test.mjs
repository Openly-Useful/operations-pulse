import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { OperationsStore, runPulse } from "../packages/core/dist/index.js";

test("stores and queries operational tickets", () => {
  const root = mkdtempSync(join(tmpdir(), "operations-pulse-ticket-"));
  const store = new OperationsStore(join(root, "pulse.sqlite"));
  const created = store.createTicket({
    title: "Review noisy retry logs",
    priority: "high",
    tags: ["logs", "retry"],
  });

  const tickets = store.listTickets({ query: "retry" });
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].id, created.id);
  assert.equal(tickets[0].status, "backlog");
  store.close();
});

test("runs local checks without including log content", () => {
  const root = mkdtempSync(join(tmpdir(), "operations-pulse-run-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "README.md"), "# Fixture\n");
  writeFileSync(join(root, "logs.txt"), "token=secret-value ERROR retry failed\n");
  execFileSync("git", ["init", "-q"], { cwd: root });

  const store = new OperationsStore(join(root, "pulse.sqlite"));
  const result = runPulse(store, {
    workspace: root,
    localLogs: { paths: ["logs.txt"], patterns: ["error", "retry"] },
  });

  const logEvent = result.events.find((event) => event.checkId === "local_logs");
  assert.ok(logEvent);
  assert.equal(logEvent.evidence.contentIncluded, false);
  assert.equal(JSON.stringify(logEvent.evidence).includes("secret-value"), false);
  assert.equal(result.createdTickets.length, 0);
  assert.equal(store.pulseHistory(1).length, 1);
  store.close();
});

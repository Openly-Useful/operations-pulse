import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { EventStatus, PulseOptions, PulseResult, Ticket } from "./types.js";
import { OperationsStore } from "./db.js";

type CheckResult = {
  checkId: string;
  status: EventStatus;
  summary: string;
  evidence: Record<string, unknown>;
};

function checkGit(workspace: string): CheckResult {
  const result = spawnSync("git", ["status", "--short"], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 10_000,
  });

  if (result.error || result.status !== 0) {
    return {
      checkId: "git_worktree",
      status: "blocked",
      summary: "Git status was unavailable.",
      evidence: {
        exitCode: result.status,
        error: result.error?.message ?? result.stderr.trim().slice(0, 400),
      },
    };
  }

  const entries = result.stdout.split("\n").filter(Boolean);
  return {
    checkId: "git_worktree",
    status: entries.length ? "warn" : "pass",
    summary: entries.length
      ? `Worktree has ${entries.length} changed or untracked entr${entries.length === 1 ? "y" : "ies"}.`
      : "Worktree is clean.",
    evidence: {
      command: "git status --short",
      count: entries.length,
      entries: entries.slice(0, 50),
      truncated: entries.length > 50,
    },
  };
}

function checkDocs(workspace: string): CheckResult {
  const candidates = ["README.md", "docs", "CONTRIBUTING.md", "SECURITY.md"];
  const found = candidates.filter((candidate) => existsSync(join(workspace, candidate)));
  const missing = candidates.filter((candidate) => !found.includes(candidate));
  return {
    checkId: "docs_presence",
    status: found.includes("README.md") && found.includes("docs") ? "pass" : "warn",
    summary:
      found.includes("README.md") && found.includes("docs")
        ? "Core project documentation is present."
        : "Core project documentation is incomplete.",
    evidence: { found, missing },
  };
}

function checkLocalLogs(workspace: string, paths: string[], patterns: string[]): CheckResult {
  const matches: Array<{ path: string; pattern: string; line: number }> = [];
  const unavailable: Array<{ path: string; reason: string }> = [];

  for (const configuredPath of paths) {
    const path = isAbsolute(configuredPath) ? configuredPath : resolve(workspace, configuredPath);
    try {
      const size = statSync(path).size;
      const text = readFileSync(path, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        const lowered = line.toLowerCase();
        for (const pattern of patterns) {
          if (lowered.includes(pattern.toLowerCase())) {
            matches.push({ path, pattern, line: index + 1 });
            break;
          }
        }
      });
      if (size > 5_000_000) {
        unavailable.push({ path, reason: "File exceeded the recommended 5 MB scan size." });
      }
    } catch (error) {
      unavailable.push({ path, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  const status: EventStatus = matches.length ? "warn" : unavailable.length === paths.length ? "blocked" : "pass";
  return {
    checkId: "local_logs",
    status,
    summary: matches.length
      ? `Found ${matches.length} configured log-pattern match${matches.length === 1 ? "" : "es"}.`
      : unavailable.length === paths.length
        ? "No configured log file could be scanned."
        : "No configured log patterns were found.",
    evidence: {
      patterns,
      matches: matches.slice(0, 200),
      matchCount: matches.length,
      unavailable,
      contentIncluded: false,
    },
  };
}

export function runPulse(store: OperationsStore, options: PulseOptions): PulseResult {
  const workspace = resolve(options.workspace);
  const run = store.startPulse(workspace);
  const checks: CheckResult[] = [checkGit(workspace), checkDocs(workspace)];

  if (options.localLogs?.paths.length) {
    checks.push(
      checkLocalLogs(
        workspace,
        options.localLogs.paths,
        options.localLogs.patterns ?? ["error", "warn", "retry", "timeout"],
      ),
    );
  }

  const events = checks.map((check) =>
    store.recordEvent({
      runId: run.id,
      checkId: check.checkId,
      status: check.status,
      summary: check.summary,
      evidence: check.evidence,
      ticketId: null,
    }),
  );

  const createdTickets: Ticket[] = [];
  if (options.createTickets) {
    for (const event of events.filter((item) => item.status === "warn" || item.status === "fail")) {
      const existing = store.listTickets({ query: event.checkId, limit: 10 }).find(
        (ticket) => ticket.status !== "done" && ticket.status !== "closed",
      );
      if (!existing) {
        const ticket = store.createTicket({
          title: event.summary,
          description: `Generated from pulse check ${event.checkId}. Review the pulse evidence before staffing.`,
          priority: event.status === "fail" ? "high" : "medium",
          source: "pulse",
          sourceRef: `pulse:${run.id}:${event.checkId}`,
          tags: ["pulse", event.checkId],
        });
        store.attachEventTicket(event.id, ticket.id);
        event.ticketId = ticket.id;
        createdTickets.push(ticket);
      }
    }
  }

  const counts = Object.fromEntries(
    ["pass", "warn", "fail", "blocked"].map((status) => [
      status,
      events.filter((event) => event.status === status).length,
    ]),
  );
  const summary = `${events.length} checks: ${counts.pass} passed, ${counts.warn} warned, ${counts.fail} failed, ${counts.blocked} blocked; ${createdTickets.length} tickets created.`;
  const completedRun = store.completePulse(run.id, summary);

  return { run: completedRun, events, createdTickets };
}

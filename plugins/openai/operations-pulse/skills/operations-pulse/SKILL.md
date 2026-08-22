---
name: operations-pulse
description: Run a local-first operational heartbeat that checks configured evidence sources, queries related ticket memory, reports verified signals, and optionally creates governed tickets. Use when the user asks for an operations pulse, heartbeat, recurring checks, log or documentation review, operational triage, self-managed tickets, or a loop-orchestrator status report.
---

# Operations Pulse

Use this skill to turn repeatable checks into an evidence-backed operational
report and durable local ticket memory. The default path is free, local, and
read-only except for storing the pulse record.

## Choose the workflow

- For an on-demand heartbeat, follow [workflows.md](references/workflows.md).
- For tool or MCP setup, read [connections.md](references/connections.md).
- For release or deployment work, read [launch.md](references/launch.md).
- For a new work graph, copy `assets/work-graph.example.yaml` and replace every
  example value before use.

## Operating rules

1. State the workspace, checks, connections, and write behavior before running.
2. Query related tickets before creating a new one.
3. Prefer deterministic local checks; use a model to interpret evidence, not to
   invent it.
4. Keep observations, inferences, and recommendations visibly separate.
5. Never place credentials, customer content, or unrestricted logs in tickets.
6. Do not create tickets during a pulse unless the user or configured policy
   explicitly enables it.
7. Never treat a ticket or agent recommendation as permission for a paid,
   destructive, public, or account-changing action.
8. Report unavailable connections with the required scopes, cost class, and a
   free/local alternative when one exists.
9. Never collect credentials through chat, an MCP argument, ticket text, or a
   generated command. Store only a named environment-variable reference through
   the local CLI or use the host's own OAuth picker.
10. Treat schedule installation and removal as explicit local operator actions;
    never infer either from a request to run a pulse.

## Run locally

These commands are for a source checkout after building the repository. A
marketplace plugin installs the portable skill only; it does not install an
npm package, register an MCP server, or change host settings.

```bash
node packages/core/dist/cli.js init
node packages/core/dist/cli.js pulse run --root .
node packages/core/dist/cli.js tickets list
```

Use `--create-tickets` only when agent-authored backlog tickets are wanted.

For a selected configured adapter, include it explicitly in a pulse:

```bash
node packages/core/dist/cli.js connections list
node packages/core/dist/cli.js pulse run --root . --connections github,sentry
```

For a recurring local heartbeat, inspect `schedule plan` first. Installing or
removing a macOS LaunchAgent requires the corresponding CLI confirmation flag;
an MCP tool exposes status only.

## Finish the pulse

Return:

1. scope and checks run;
2. new signals with evidence;
3. repeated or noisy signals;
4. tickets created or related tickets found;
5. blocked checks and missing connections;
6. recommended next actions, clearly labeled as recommendations.

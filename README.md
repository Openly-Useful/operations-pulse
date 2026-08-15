# Operations Pulse

**A local-first loop orchestrator for useful, explainable operations.**

Operations Pulse turns recurring checks into evidence, evidence into durable
tickets, and tickets into a reviewable operating memory. It runs without a
paid service by default: Node.js, SQLite, Git, local files, and local logs are
enough to get a useful pulse.

It is an [Openly Useful](https://openlyuseful.org) project: useful things,
openly made.

## What launches in v0.1

- A SQLite ticket and pulse ledger.
- Read-only local checks for repository state, documentation, and configured
  log files.
- An MCP server with self-describing tools and structured results.
- A portable `operations-pulse` skill for Codex and compatible agents.
- Optional role definitions for operations, signal review, triage, and
  integrations.
- A connection catalog that distinguishes free/local, subscription, and
  bring-your-own-credential paths.
- A complete migration ledger: imported, rewritten, referenced, or excluded.

## Free-first quick start

Requirements: Node.js 24 or newer. No API key is required for the default
workflow.

```bash
npm install
npm run build
node packages/core/dist/cli.js init
node packages/core/dist/cli.js pulse run --root .
node packages/core/dist/cli.js tickets list
```

Run the MCP server over stdio:

```bash
npm run mcp
```

The database defaults to `.operations-pulse/pulse.sqlite`. Override it with
`OPERATIONS_PULSE_DB`.

## Safety model

Operations Pulse is read-only unless a tool or command clearly says it writes.
Pulse runs do not create tickets unless `--create-tickets` (or the equivalent
MCP argument) is explicitly enabled. Connections are disabled until configured,
credentials are never stored in the catalog, and externally visible or paid
actions require a separate human approval boundary.

## Repository map

- `packages/core` — SQLite ledger and deterministic checks.
- `packages/mcp` — MCP stdio server.
- `skill/operations-pulse` — portable agent skill.
- `agents` — optional role definitions.
- `catalog` — tool and connection explanations shown at launch.
- `docs` — architecture, workflows, connection guide, and launch checklist.
- `migrations` — source inventory and sanitization decisions.
- `vendor` — attributed third-party skill packs, never silently merged.
- `apps/site` — dependency-free project site.

## Status

This repository is being prepared for its first public release. The local-first
core is the supported baseline; remote connectors are capability declarations
until their individual adapters and authorization flows are verified.

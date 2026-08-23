# Operations Pulse

**A local-first loop orchestrator for useful, explainable operations.**

Operations Pulse turns recurring checks into evidence, evidence into durable
tickets, and tickets into a reviewable operating memory. It runs without a
paid service by default: Node.js, SQLite, Git, local files, and local logs are
enough to get a useful pulse.

It is an [Openly Useful](https://openlyuseful.org) project: useful things,
openly made.

Use the live, credential-safe setup guide at
[operations-pulse-five.vercel.app](https://operations-pulse-five.vercel.app).

## What launches in v0.1

- A SQLite ticket and pulse ledger.
- Read-only local checks for repository state, documentation, and configured
  log files.
- An MCP server with self-describing tools and structured results.
- A portable `operations-pulse` skill for Codex and compatible agents.
- Optional role definitions for operations, signal review, triage, and
  integrations.
- A connection catalog and guided setup that distinguish free/local,
  subscription, host OAuth, self-hosted, and bring-your-own-credential paths.
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

Configure an optional read-only adapter without placing a credential in the
repository, SQLite database, MCP argument, or chat transcript:

```bash
export OPERATIONS_PULSE_GITHUB_TOKEN='stored by your shell or secret manager'
node packages/core/dist/cli.js connections configure \
  --id github --mode env-token \
  --credential-env OPERATIONS_PULSE_GITHUB_TOKEN
node packages/core/dist/cli.js connections test --id github
node packages/core/dist/cli.js pulse run --root . --connections github
```

On a local machine already authenticated with the GitHub CLI, the zero-copy
alternative uses that session only for the read-only check; its token is never
stored or printed:

```bash
gh auth login
node packages/core/dist/cli.js connections configure --id github --mode github-cli
node packages/core/dist/cli.js connections test --id github
```

The browser-based picker at `apps/site` generates these safe setup steps. It
never collects credentials. Host OAuth remains in the host's own consent UI.

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

Connection records retain only an ID, non-secret settings, an endpoint, and an
environment-variable reference. `connections disconnect` removes that reference
from the local ledger. The initial adapters are read-only: IMAP unread-count
metadata, GitHub identity, Linear viewer identity, Sentry project access, and
PostHog project access. No remote mutation adapter ships in v0.1.

## Optional heartbeat

Run a bounded foreground heartbeat anywhere Node can run:

```bash
node packages/core/dist/cli.js heartbeat serve --interval-minutes 30 --root .
```

On macOS, inspect then explicitly install a user-level LaunchAgent:

```bash
node packages/core/dist/cli.js schedule plan --interval-minutes 30 --root .
node packages/core/dist/cli.js schedule install --confirm-install --interval-minutes 30 --root .
```

The scheduler is never installed by an MCP tool, a model response, or a page
load. Removal requires `schedule uninstall --confirm-uninstall`.

## Repository map

- `packages/core` — SQLite ledger and deterministic checks.
- `packages/mcp` — MCP stdio server.
- `skill/operations-pulse` — portable agent skill.
- `plugins/openai/operations-pulse` — generated Codex skill and MCP wrapper.
- `plugins/claude/operations-pulse` — generated Claude Code skill and MCP wrapper.
- `.agents/plugins/marketplace.json` — repository-local Codex marketplace.
- `.claude-plugin/marketplace.json` — repository-local Claude marketplace.
- `mcp-registry/operations-pulse/server.json` — staged official MCP Registry metadata.
- `publisher/publisher.json` — repository consumer mirror of the public publisher authority.
- `agents` — optional role definitions.
- `catalog` — tool and connection explanations shown at launch.
- `docs` — architecture, workflows, connection guide, and launch checklist.
- `migrations` — source inventory and sanitization decisions.
- `vendor` — attributed third-party skill packs, never silently merged.
- `apps/site` — dependency-free project site.

## Status

This repository is being prepared for its first public release. The local-first
core is the supported baseline. IMAP, GitHub, Linear, Sentry, and PostHog have
read-only adapter tests; host OAuth requires a compatible host's native consent
flow, and no remote write adapter is enabled by default.

## Publisher and registration model

Openly Useful is the publisher and developer brand. `openlyuseful.org` is the
open-source, publisher, policy, security, and support surface;
`openlyuseful.com` is the Studio/commercial surface. Openly Useful LLC is the
planned legal entity and is not represented as formed or active. Openly Useful
is currently operated by its founder as an individual, and the founder-owner
has authorized external source and registry publication while formation proceeds.

The repository mirror at `publisher/publisher.json` consumes the published
authority endpoint at <https://openlyuseful.org/publisher/manifest.json>.
Provider manifests derive the public name, contact, namespaces, and policy URLs
from that record. The repository URL in staged provider metadata is the planned
public source at <https://github.com/Openly-Useful/operations-pulse>.

The canonical skill remains `skill/operations-pulse`. Provider wrapper copies
are generated artifacts, not separately editable sources:

```bash
npm run registration:sync
npm run registration:check
```

The wrappers register the portable skill plus the immutable stdio command
`npx --yes @openly-useful/operations-pulse-mcp@0.1.0`. They do not authenticate
an account, install a scheduler, configure adapters, or collect credentials.
The corresponding MCP Registry identity is `org.openlyuseful/operations-pulse`.
After installing or upgrading the plugin, start a new Codex task or restart
Claude Code so the host refreshes its MCP tools. By default the MCP database is
`.operations-pulse/pulse.sqlite` under the host process working directory;
set `OPERATIONS_PULSE_DB` in the host environment to choose an explicit path.

Local generation and validation are allowed. Public repository creation,
package publication, MCP Registry submission, marketplace submission,
installation, authentication, and deployment are separate external actions.
Both publishable workspaces fail closed at `prepublishOnly` unless the exact
founder-owner authorization, publisher identity, policy sources, namespace,
package identity, and repository provenance match the public authority. LLC
formation-pending is not itself an npm artifact blocker because Openly Useful
is founder-operated and the authorization is explicitly effective during
formation. Namespace verification, provider authentication, and provider review
remain separate requirements for the relevant registry or provider workflow.

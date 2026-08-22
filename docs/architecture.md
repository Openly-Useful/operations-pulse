# Architecture

Operations Pulse separates durable state, checks, agent reasoning, and external
connections so each can be replaced without losing the operating memory.

```text
Scheduler or human
       |
       v
Pulse runner ----> deterministic local checks
       |                    |
       v                    v
SQLite ledger <---- evidence and explicit tickets
       |
       +---- MCP read tools ---- guided local setup ---- optional services
       |
       +---- CLI / site / future agent runtime
```

## Core boundary

The core owns SQLite migrations, tickets, pulse runs, events, and deterministic
checks. It does not require a model provider. This keeps the useful baseline
free, inspectable, and runnable offline.

## MCP boundary

The MCP server exposes narrow tools with schemas, annotations, plain-language
help, and structured content. Local stdio is the initial transport. A remote
Streamable HTTP deployment must add standard authorization, tenant isolation,
rate limits, audit logs, and explicit consent before it is called production.

## Agent boundary

Agent definitions are optional operating roles, not hidden daemons. The default
runtime begins with one operations lead. Specialist roles may be invoked when a
task needs their bounded expertise; they do not gain new permissions by being
delegated work.

## Connection boundary

MCP standardizes tools and context. The static project site and CLI provide a
guided setup chooser, while a compatible host owns OAuth, the consent screen,
and its secret store. Operations Pulse publishes connection contracts so a host
or the local picker can render a consistent path:

1. Free/local or hosted.
2. Existing connected account, OAuth, API key, or self-hosted URL.
3. Requested scopes and whether writes are possible.
4. Test connection.
5. Save outside the repository.
6. Show the tools enabled by that connection.

The local connection ledger stores only a connection ID, non-secret settings,
optional endpoint, test state, and a credential environment-variable name. It
does not store, return, or accept credential values through MCP. Read-only
adapters are isolated from remote mutation controls.

## Heartbeat boundary

Foreground heartbeats run in the process that the operator starts. macOS users
can install one named LaunchAgent only after inspecting a generated plan and
passing `--confirm-install`; removal requires its own confirmation. The launch
agent invokes the same CLI as a human, uses the operator-selected workspace and
database, and never creates tickets unless that option is explicit.

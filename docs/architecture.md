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
       +---- MCP tools ---- host connection UI ---- optional services
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

MCP standardizes tools and context, but the host owns the connection picker,
OAuth or credential prompt, consent screen, and secret store. Operations Pulse
publishes connection contracts so a compatible host can render a guided picker:

1. Free/local or hosted.
2. Existing connected account, OAuth, API key, or self-hosted URL.
3. Requested scopes and whether writes are possible.
4. Test connection.
5. Save outside the repository.
6. Show the tools enabled by that connection.

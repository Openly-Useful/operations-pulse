# Connections

Start with Git, SQLite, filesystem, and local logs. These need no paid account.

For optional services, show the operator:

- why the workflow needs the connection;
- free/self-hosted, existing-subscription, and API-key options;
- requested scopes and whether writes are possible;
- where credentials are stored;
- a test and disconnect action;
- the exact tools enabled.

The host should collect credentials through its native connection UI, OAuth, or
secret store. Never accept secrets in ordinary chat, ticket text, or an MCP
argument. Return `connection_required` when a secure setup path is absent.

The local CLI stores a connection ID, non-secret settings, endpoint, test state,
and the name of an environment variable—not its credential value. It supports
read-only IMAP unread-count, GitHub, Linear, Sentry, and PostHog probes. Use
`connections test --id <id>` before selecting an adapter in a pulse, and
`connections disconnect --id <id>` to remove its credential reference.

`host-oauth` is intentionally not a token input. A compatible host must render
and approve its own OAuth flow; Operations Pulse fails closed when that flow is
not available.

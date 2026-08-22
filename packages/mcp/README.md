# Operations Pulse MCP

<!-- mcp-name: org.openlyuseful/operations-pulse -->

`@openly-useful/operations-pulse-mcp` is the local stdio MCP companion for
Operations Pulse. Its official MCP Registry identity is
`org.openlyuseful/operations-pulse`.

The package reads and writes only the configured local Operations Pulse SQLite
database and explicitly selected local workspaces or log files. It does not
ship a hosted service or accept remote credentials. It can include explicitly
selected, preconfigured read-only adapters in a pulse, and exposes only safe
connection and scheduler status through MCP. Configuration, credential setup,
scheduler installation, and scheduler removal remain explicit local CLI actions.

Public publication is blocked while the Openly Useful publisher record remains
`formation-pending`. Repository metadata is staged for local validation only.

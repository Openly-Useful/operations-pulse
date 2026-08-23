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

Openly Useful is founder-operated while Openly Useful LLC remains
`formation-pending`. The founder-owner has authorized external publication
during formation. `prepublishOnly` fails closed unless that authorization and
the exact publisher identity, policy sources, npm/MCP identities, version, and
repository provenance match. Provider authentication and review remain separate
MCP Registry steps and do not block npm artifact readiness.

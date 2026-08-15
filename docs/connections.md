# Connections and guided setup

The launch experience should offer free and open-source choices first, while
letting operators use accounts they already pay for.

## Picker contract

Each connection declares:

- capability and provider label;
- availability: available, experimental, or planned;
- cost class: free/open-source, existing subscription, or usage-based;
- authentication modes: none, host OAuth, API key, app password, or local URL;
- scopes and data boundary;
- read/write/destructive behavior;
- test procedure and disconnect behavior;
- tools and workflows it enables.

The MCP server never asks a model to print a credential into chat. A host may
use its native connection UI, OAuth flow, secret store, or standards-based MCP
elicitation. If no secure host flow exists, setup stops with an actionable
instruction instead of accepting a key as ordinary tool input.

## Free-first defaults

SQLite, Git, filesystem checks, and local log scanning ship enabled or ready to
enable. PostHog may be self-hosted. Email may use standards-based IMAP. A local
model can be offered when an agentic interpretation layer is desired. Hosted
vendors remain optional adapters.

## Capability response

When a workflow needs a missing connection, return a structured
`connection_required` response with the connection ID, reason, scopes, cost
class, and safe alternatives. This allows hosts to render a dropdown or setup
button without coupling the core to one vendor's UI.

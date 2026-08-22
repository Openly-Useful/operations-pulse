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
use its native connection UI, OAuth flow, and secret store. The project site's
picker generates a CLI plan without accepting a secret. If no secure host flow
exists, setup stops with an actionable instruction instead of accepting a key
as ordinary tool input.

## Free-first defaults

SQLite, Git, filesystem checks, and local log scanning ship enabled or ready to
enable. PostHog may be self-hosted. Email may use standards-based IMAP. A local
model can be offered when an agentic interpretation layer is desired. Hosted
vendors remain optional adapters.

## Available read-only adapters

The first release supports these real probes:

- IMAP: connects read-only, counts unread mail in the selected mailbox, and
  records no message bodies or subjects.
- GitHub: validates the authenticated identity and granted scopes.
- Linear: validates the authenticated viewer through its GraphQL endpoint.
- Sentry: validates access to the selected organization's projects.
- PostHog: validates access to the selected organization/project.

Each credential is supplied through a named environment variable. IMAP uses a
JSON environment value containing `password` or `accessToken`; all other
adapters use their provider's bearer or API token. None is saved to SQLite.

```bash
# Stores only the environment variable *name* and non-secret provider settings.
operations-pulse connections configure --id sentry --mode env-token \
  --credential-env OPERATIONS_PULSE_SENTRY_TOKEN \
  --setting organization=your-organization
operations-pulse connections test --id sentry
operations-pulse connections disconnect --id sentry
```

`host-oauth` is a configuration state, not a token-exchange workaround. A
compatible host must complete its own approval flow; Operations Pulse fails
closed rather than requesting the token through MCP.

## Capability response

When a workflow needs a missing connection, return a structured
`connection_required` response with the connection ID, reason, scopes, cost
class, and safe alternatives. This allows hosts to render a dropdown or setup
button without coupling the core to one vendor's UI.

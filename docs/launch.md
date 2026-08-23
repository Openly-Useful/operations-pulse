# Launch checklist

## Required before the first public release

- All source inventory entries have an explicit disposition and rationale.
- Vendored work retains its license and copyright notice.
- Secret scanning, dependency review, build, tests, and schema validation pass.
- Every exposed tool appears in `catalog/tools.json` with an example, cost,
  data boundary, write behavior, and approval rule.
- The default quick start works with no API key and no paid service.
- The skill validates and its OpenAI interface metadata is generated.
- Codex and Claude marketplace catalogs point to generated, drift-free wrappers
  derived from `skill/operations-pulse`.
- `packages/mcp/package.json` and the official MCP Registry `server.json` agree
  on `org.openlyuseful/operations-pulse`, package name, and version.
- Both publishable npm workspaces use the repository's fail-closed
  `prepublishOnly` assertion.
- MCP stdio emits protocol data only on stdout; diagnostics use stderr.
- Site claims match implemented status. Planned adapters are labeled planned.
- Openly Useful's canonical mark is reused unchanged.
- Repository creation, public push, site link, and deployment happen only after
  the sanitized tree is reviewed.

## External activation boundary

Openly Useful is founder-operated while the single planned LLC remains
formation-pending. Formation is not a publication gate: the founder-owner has
directly authorized source, package, registry, and provider publication. Each
external action still requires its own identity, account, namespace, policy,
and release validation before it is executed.

External activation requires all of the following to be recorded first:

- the current operator remains truthfully identified as the founder-individual;
- publisher authorization is explicitly `granted` with the
  `founder-owner-direct` basis;
- `externalPublicationAllowed` is `true`;
- namespace and required provider verification are complete;
- privacy, terms, security, support, and publisher URLs are publicly reachable;
- the public repository exists and has passed the sanitized-tree review;
- remaining provider-specific requirements are satisfied for the action; and
- the specific external publication or submission is separately authorized.

The public Codex and Claude marketplace manifests are live. npm package and MCP
Registry state must still be verified independently before either is described
as published.

## Post-launch connector gate

Each connector needs a threat model, least-privilege scopes, disconnect path,
credential-storage documentation, mocked tests, and a live canary against a
non-production account before its status changes from planned.

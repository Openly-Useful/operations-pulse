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

Repository-local generation, build, packaging, and tests are allowed while the
publisher is formation-pending. Do not publish either npm workspace, submit the
MCP Registry entry, add a hosted marketplace, install a plugin, authenticate a
provider account, create or push a remote, or deploy from this checklist.

External activation requires all of the following to be recorded first:

- Openly Useful LLC is formed and its active name is verified;
- publisher authorization is explicitly `authorized`;
- `externalPublicationAllowed` is `true`;
- namespace and required provider verification are complete;
- privacy, terms, security, support, and publisher URLs are publicly reachable;
- the planned public repository exists and has passed the sanitized-tree review;
- `blockingRequirements` is empty; and
- the specific external publication or submission is separately authorized.

The staged provider and registry files do not claim that any external action has
occurred.

## Post-launch connector gate

Each connector needs a threat model, least-privilege scopes, disconnect path,
credential-storage documentation, mocked tests, and a live canary against a
non-production account before its status changes from planned.

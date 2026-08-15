# Launch checklist

## Required before the first public release

- All source inventory entries have an explicit disposition and rationale.
- Vendored work retains its license and copyright notice.
- Secret scanning, dependency review, build, tests, and schema validation pass.
- Every exposed tool appears in `catalog/tools.json` with an example, cost,
  data boundary, write behavior, and approval rule.
- The default quick start works with no API key and no paid service.
- The skill validates and its OpenAI interface metadata is generated.
- MCP stdio emits protocol data only on stdout; diagnostics use stderr.
- Site claims match implemented status. Planned adapters are labeled planned.
- Openly Useful's canonical mark is reused unchanged.
- Repository creation, public push, site link, and deployment happen only after
  the sanitized tree is reviewed.

## Post-launch connector gate

Each connector needs a threat model, least-privilege scopes, disconnect path,
credential-storage documentation, mocked tests, and a live canary against a
non-production account before its status changes from planned.

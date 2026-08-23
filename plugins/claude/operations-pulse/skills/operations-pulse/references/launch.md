# Launch and deployment

Before publishing, run the repository build, tests, catalog validation, skill
validation, dependency audit, and secret scan. Confirm every imported file has
license/provenance coverage and every site claim matches implementation.

The initial supported deployment is local stdio MCP. Treat remote MCP as a
separate security milestone requiring authorization, tenant isolation, rate
limits, audit logs, and explicit user consent.

Do not publish a repository, release, package, site change, or deployment until
the sanitized diff and target organization are confirmed.

The public Codex and Claude marketplace catalogs are live and independently
installable. Openly Useful remains founder-operated while the single planned
LLC is `formation-pending`; formation is not a publication gate because the
founder-owner directly authorizes external publication. Before publishing an
npm package, MCP Registry record, or deployment, independently verify the exact
artifact, account, namespace, public policies, and action-specific approval.

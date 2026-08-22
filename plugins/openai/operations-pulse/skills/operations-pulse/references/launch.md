# Launch and deployment

Before publishing, run the repository build, tests, catalog validation, skill
validation, dependency audit, and secret scan. Confirm every imported file has
license/provenance coverage and every site claim matches implementation.

The initial supported deployment is local stdio MCP. Treat remote MCP as a
separate security milestone requiring authorization, tenant isolation, rate
limits, audit logs, and explicit user consent.

Do not publish a repository, release, package, site change, or deployment until
the sanitized diff and target organization are confirmed.

Repository-local marketplace catalogs and provider wrappers are staging
artifacts, not evidence of installation or publication. While the Openly Useful
publisher record is `formation-pending`, external package publication, MCP
Registry submission, marketplace submission, and deployment remain blocked.

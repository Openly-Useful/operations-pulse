# Security policy

## Report a vulnerability

Do not open a public issue for secrets, credential exposure, authorization
bypass, or destructive-action vulnerabilities. Use GitHub's private security
advisory flow for the repository.

## Trust boundaries

- The SQLite database may contain operational metadata. Keep it out of Git.
- Credentials belong in the host's secret store or environment, never in the
  repository, catalog, ticket body, or MCP result.
- Connector descriptions and MCP annotations are informative, not authority.
- Any network write, paid action, deployment, account change, or destructive
  operation must cross an explicit human approval boundary.
- Imported private material must be rewritten from concepts, not copied with
  identifiers, paths, customer data, or credentials.

## Supported baseline

The supported baseline is local stdio MCP plus local SQLite. Remote HTTP and
OAuth deployment are not considered production-ready until threat-model and
authorization tests are published.

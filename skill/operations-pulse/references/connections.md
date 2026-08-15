# Connections

Start with Git, SQLite, filesystem, and local logs. These need no paid account.

For optional services, show the operator:

- why the workflow needs the connection;
- free/self-hosted, existing-subscription, and API-key options;
- requested scopes and whether writes are possible;
- where credentials are stored;
- a test and disconnect action;
- the exact tools enabled.

The host should collect credentials through its native connection UI, OAuth,
secret store, or MCP elicitation. Never accept secrets in ordinary chat or
ticket text. Return `connection_required` when a secure setup path is absent.

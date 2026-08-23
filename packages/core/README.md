# Operations Pulse Core

`@openly-useful/operations-pulse-core` provides the local SQLite ticket ledger,
deterministic pulse checks, and command-line interface used by Operations Pulse.

It also includes optional read-only connection probes for IMAP, GitHub, Linear,
Sentry, and PostHog. Credentials are read from an operator-chosen environment
variable at runtime and are never written to the SQLite ledger. The macOS
heartbeat scheduler is opt-in and requires a reviewed plan plus an explicit CLI
confirmation.

Openly Useful is founder-operated while Openly Useful LLC remains
`formation-pending`. The founder-owner has authorized external publication
during formation. `prepublishOnly` fails closed unless that authorization and
the exact publisher identity, policy sources, npm identity, version, and
repository provenance match. Provider authentication and review remain separate
provider workflow steps and do not block npm artifact readiness.

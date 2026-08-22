# Operations Pulse Core

`@openly-useful/operations-pulse-core` provides the local SQLite ticket ledger,
deterministic pulse checks, and command-line interface used by Operations Pulse.

It also includes optional read-only connection probes for IMAP, GitHub, Linear,
Sentry, and PostHog. Credentials are read from an operator-chosen environment
variable at runtime and are never written to the SQLite ledger. The macOS
heartbeat scheduler is opt-in and requires a reviewed plan plus an explicit CLI
confirmation.

Public publication is blocked while the Openly Useful publisher record remains
`formation-pending`. Repository metadata is staged for local validation only.

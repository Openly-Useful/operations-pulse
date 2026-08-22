# Operator workflows

## Start a pulse

1. Describe the checks, paths, and connections that will be used.
2. Confirm the pulse is read-only unless ticket creation is explicitly enabled.
3. Query related open and historical tickets.
4. Run deterministic checks and retain compact evidence.
5. Separate verified findings from suggestions.
6. Create or update tickets only within the selected policy.
7. Report new signals, repeated noise, blockers, and recommended human actions.

## Schedule a heartbeat

1. Run `schedule plan` with the exact workspace, interval, log paths, selected
   read-only connections, and ticket policy.
2. Review the generated command and the only user-level file it would write.
3. Install only with `--confirm-install`; this is a local operator action, never
   an MCP request or model-generated confirmation.
4. Use `schedule status` and pulse history to verify real execution.
5. Remove only with `schedule uninstall --confirm-uninstall` when the heartbeat
   is no longer intended.

## Staff a ticket

1. Load the ticket and search related prior tickets.
2. Distill reusable context without copying secrets or irrelevant personal data.
3. Identify the smallest responsible role and its tool boundary.
4. Check dependencies and approval gates.
5. Execute, collect evidence, and update the ticket.
6. Record a decision when the work changes architecture or operating policy.

## Triage agent-authored ideas

Agent-authored tickets always enter `backlog` with source `pulse` or `agent`.
They are proposals, not authorization. A human may accept, edit, defer, merge,
or close them. Paid, destructive, externally visible, or account-changing work
requires a fresh bounded approval at execution time.

## Review recurring noise

Use pulse history to identify repeated events. Prefer fixing the underlying
signal or tuning a narrow check over suppressing an entire class of evidence.
Record the reason and review date for every suppression.

# Pulse workflows

## On-demand pulse

1. Resolve the workspace and configuration.
2. Describe enabled checks and whether tickets may be created.
3. Query open and recent tickets for related terms.
4. Run checks; retain paths, commands, counts, and timestamps as evidence.
5. Deduplicate against existing tickets.
6. If creation is enabled, create backlog tickets with source `pulse`.
7. Summarize findings, uncertainty, noise, and next actions.

## Scheduled pulse

Use an OS scheduler, CI schedule, or existing automation host to invoke the CLI.
The scheduler is infrastructure; the pulse policy stays in the repository. Keep
network connectors disabled until their authorization and failure behavior are
tested. Alert only on state changes or actionable thresholds to avoid noise.

## Ticket staffing

Search previous tickets, confirm the current evidence is fresh, select the
smallest responsible role, verify gates, perform the bounded work, and attach
verification. Close only when outcome evidence—not narrative confidence—shows
the acceptance criteria are met.

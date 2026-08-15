# Phase 4: Roadmap Status Capture

## Entry 7: roadmap-status-capture skill lands (2026-07-26)

**What**: Added the `roadmap-status-capture` skill and released v1.3.0. Three
parallel evidence agents (Linear, git/GitHub, session context) reconciled in
the main thread into a QA'd status report; read-only; NOT_CONFIGURED fallback
proposes a dependency-ordered phasing when Linear isn't set up.

**Why**: The skill was reviewed in a prior Claude Code session; this session
landed the reviewed version so any project can run a trustworthy "where does
the initiative stand" capture. First planned run: the Gloatroom initiative —
deliberately ON HOLD until the owner gives the go.

**Decisions**: DEC-003 (ships in handoff, not project-scoped).

**Files**: `skills/roadmap-status-capture/SKILL.md`, `README.md` (commit
9d779d3); `CHANGELOG.md`, `.claude-plugin/plugin.json` (commit 7b1b18d).

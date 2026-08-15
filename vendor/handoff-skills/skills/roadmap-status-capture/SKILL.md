---
name: roadmap-status-capture
description: Full roadmap status capture for the current initiative. Cross-references Linear, git/GitHub history, and session context into a reconciled status report with QA'd discrepancies. Use when the user asks for roadmap status, a status capture, or where the initiative stands.
---

# Roadmap Status Capture

Target initiative: $ARGUMENTS
If no argument is given, infer the initiative from the current repo and session context, state the assumption in one line, and proceed.

Read-only operation. Do not modify Linear issues, commit, push, or change any files.

## Phase 1: Parallel evidence gathering

Launch three subagents in parallel via the Task tool. Each returns a structured list, not prose.

**Agent A: Linear.** Pull every issue for the initiative (project, cycle, or label as applicable). For each: ID, title, current state, assignee, last updated, and any blocked/blocking relations. If Linear has no project, cycle, or label configured for this initiative, return NOT_CONFIGURED plus any loose issues that appear related.

**Agent B: Git/GitHub.** Scan branches, merged PRs, and commits (lookback: initiative start date, or 30 days if unknown). Extract: references to Linear IDs in commit messages, PR titles, and branch names; plus substantive work with no Linear reference.

**Agent C: Session context.** Review the current Claude Code thread and any plan/TODO files in the repo for tasks discussed, started, completed, or blocked that may not appear in Linear or git.

## Phase 2: Reconciliation (main thread)

Build one master task list. Merge sources on Linear ID where present; otherwise match by title/branch similarity.

Map every task to exactly one status:
- **Complete**: Linear Done, or merged PR whose scope covers the task
- **In Progress**: Linear In Progress / In Review, or active branch with recent commits
- **Blocked**: Linear blocked relation, or explicitly flagged blocked in session or commits
- **Not Started**: exists in Linear or the plan with no code or activity evidence

QA pass. Flag every discrepancy:
1. Done in Linear but no merged code evidence
2. Merged/pushed code but Linear state not updated
3. In Progress with no activity in 7+ days (stale)
4. Work found in commits with no Linear issue (untracked)

Never silently resolve a conflict between sources. Report both signals and state which one you trust and why. If a subagent result is ambiguous, spawn a follow-up agent to verify before reporting.

## Phase 3: Report

Output in chat as plain markdown. No HTML, no generated files unless asked.

1. **Summary line**: counts per status plus discrepancy count.
2. **Four tables**, one per status, columns: Linear ID | Task | Evidence (PR/commit/state) | Notes. Tasks with no Linear ID show `--` and are flagged untracked.
3. **Discrepancies**: numbered list, each with a one-line recommended fix.
4. **Linear coverage**:
   - If Linear is configured for this initiative: one line confirming which grouping (project/cycle/label) was used.
   - If NOT: state explicitly "Linear is not set up for this initiative," then provide a recommended phasing of all tasks (Phase 1/2/3, ordered by dependency then priority) as the grouping substitute.

Accuracy over speed. Completeness over brevity in the evidence column; brevity everywhere else.

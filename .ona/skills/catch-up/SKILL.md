---
name: catch-up
description: Orient to the current state of the ValueOS codebase after a gap. Use when starting a new session, resuming after a break, asked to "catch up", "what's changed", "where are we", or "what's the current state". Reads recent git history, open debt, and architectural decisions to build context before acting.
---

# Catch Up

Build orientation context before starting work in a session with a gap since last activity.

## Steps

1. **Recent git history** — understand what changed and when
   ```bash
   git log --oneline -20
   git log --oneline --since="7 days ago" --all
   ```

2. **Current branch and uncommitted state**
   ```bash
   git branch --show-current
   git status --short
   ```

3. **Open PRs on this branch** — check if work is already in review
   Use the GitHub tool to list open PRs filtered to the current branch.

4. **Read debt.md** — identify open stubs and known gaps
   Read `.ona/context/debt.md`. Before treating any item as open, read the referenced source file to confirm it hasn't been resolved.

5. **Read decisions.md** — surface any recent architectural decisions
   Read `.ona/context/decisions.md`, focusing on entries added since the last known session.

6. **Check any ratchet** — confirm current `any` counts are within ceilings
   ```bash
   bash scripts/check-any-count.sh
   ```

7. **Summarise** — produce a short orientation summary:
   - What was last worked on (from git log)
   - Any uncommitted or in-review changes
   - Top 3 open debt items relevant to the likely next task
   - Any architectural decisions that affect the work ahead

## Anti-patterns

- Do not read every context file in full — scan for recency and relevance
- Do not treat debt.md entries as open without verifying the source file
- Do not propose work based on stale `any` counts — re-measure first
- Do not summarise more than is needed to orient for the immediate task

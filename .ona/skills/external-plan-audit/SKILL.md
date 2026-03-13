---
name: external-plan-audit
description: |
  Audit an external sprint plan, roadmap, or technical assessment document against
  the ValueOS codebase before accepting its claims or scheduling work. Use when
  given a document from an outside source (consultant, AI audit tool, external
  reviewer, or another agent) that proposes sprint tasks, identifies bugs, or
  claims gaps exist in the codebase. Triggers on phrases like "audit this plan",
  "verify these findings", "is this sprint plan accurate", "check these claims
  against the codebase", "review this assessment", or when a document is pasted
  that contains task IDs (e.g. SEC-001, QUAL-003, INFRA-002) or sprint
  recommendations. The workflow produces a two-part output: (1) a claim-by-claim
  accuracy table showing what is already resolved, what is partially valid, and
  what is genuinely open, and (2) a corrected sprint plan that schedules only
  verified-open work.
---

# External Plan Audit

Audits an external document's claims against the codebase before scheduling
any work. Prevents wasted sprint capacity on already-resolved items.

## Workflow

### Step 1 — Extract claims from the external document

Parse the input document into a flat list of claims. Each claim has:
- An ID (e.g. SEC-002, QUAL-001) or a sequential number if none given
- A category (Security, Code Quality, Testing, Infrastructure, Documentation, Operations)
- A one-line description of what the document says is broken or missing

Do not evaluate claims yet. Just list them.

### Step 2 — Read the context layer

Read these files in order. Stop when you have what you need.

| File | What to extract |
|---|---|
| `.ona/context/debt.md` | Resolved section (bottom) — all items already fixed |
| `.ona/context/debt.md` | P0 and P1 open items — confirm they match the external claims |
| `.ona/context/traceability.md` | ✅ rows — confirm stages the document claims are missing |
| `.ona/context/user-stories.md` | ✅ stories — confirm features the document claims are absent |
| `.ona/context/decisions.md` | ADR list — confirm ADRs the document claims are missing |
| `docs/sprint-plan-*.md` (latest) | Deferred items — confirm what is intentionally out of scope |

See [references/verification-patterns.md](references/verification-patterns.md)
for the grep commands to use at each step.

### Step 3 — Verify each claim against the codebase

For every claim, run the appropriate verification check from
[references/verification-patterns.md](references/verification-patterns.md).

Classify each claim as one of:

| Classification | Meaning |
|---|---|
| **Already resolved** | Code, migration, or doc exists and matches the claim's desired state |
| **Partially valid** | The gap is real but the document's description is inaccurate (wrong file, wrong count, wrong severity) |
| **Genuinely open** | Verified gap — nothing in the codebase or docs addresses it |
| **Unverifiable** | The claim names no specific file or artifact; cannot confirm or deny |

Do not schedule work for "Already resolved" or "Unverifiable" claims.

### Step 4 — Produce the accuracy table

Output a markdown table with one row per claim:

```markdown
| Claim ID | Category | Document Says | Actual State | Classification |
|---|---|---|---|---|
| SEC-003 | Security | Add MFA startup assertion | `server.ts` lines 580–589 enforce this already | Already resolved |
| DOCS-001 | Documentation | OpenAPI covers 1 endpoint | 516-line spec covers Projects; value cases missing | Partially valid |
| INFRA-001 | Infrastructure | 44 of 79 migrations lack rollbacks | 22 rollbacks for 117 migrations — gap is real, counts differ | Partially valid |
```

### Step 5 — Produce the corrected sprint plan

Using only "Genuinely open" and "Partially valid" claims, write a sprint plan
following the structure in [references/output-structure.md](references/output-structure.md).

Rules:
- Sequence sprints by the dependency rules from the `sprint-okr-planning` skill
  (DB before backend, backend before frontend, P0 before P1)
- Anchor every KR to a verified gap — cite the file path or grep result
- Do not include KRs for "Already resolved" claims
- For "Partially valid" claims, use the corrected description (actual file,
  actual count, actual severity) — not the document's version
- For "Unverifiable" claims, note them in a separate section at the end asking
  for clarification before scheduling

### Step 6 — State what was excluded and why

After the corrected plan, include a brief section:

```markdown
## Excluded from Plan

The following claims from the external document were not scheduled because
they are already resolved in the codebase:

| Claim ID | Resolution evidence |
|---|---|
| SEC-003 | `server.ts` lines 580–589 |
| QUAL-002 | `debt.md` Resolved section; ADR-0017 |
```

This makes the exclusions auditable and prevents the same claims from being
re-raised in future audits.

---

## Anti-patterns

| Pattern | Fix |
|---|---|
| Accepting a claim without checking the codebase | Always grep before classifying |
| Scheduling work for a resolved debt item | Read `debt.md` Resolved section first |
| Using the document's file counts without re-measuring | Re-measure with grep; document counts go stale |
| Classifying a claim as "Unverifiable" without asking for the specific file | Ask for the file path before excluding |
| Writing a corrected KR that still uses the document's inaccurate numbers | Use the re-measured actual, not the document's figure |
| Scheduling "Partially valid" claims at the document's stated severity | Re-assess severity based on actual codebase state |

# Output Structure

Templates for the two required outputs: the accuracy table and the corrected
sprint plan. Use these exactly — do not invent new sections.

---

## Part 1 — Accuracy Table

Produce this before writing any sprint plan. It is the evidence base for
every scheduling decision that follows.

```markdown
## Audit Accuracy Assessment

### Claims that are already resolved (do not schedule)

| Claim ID | Document Says | Resolution Evidence |
|---|---|---|
| SEC-003 | Add MFA startup assertion | `server.ts` lines 580–589: `mfaEnabled` check + `MFA_PRODUCTION_OVERRIDE` escape hatch |
| QUAL-002 | De-duplicate ValueTreeService | `debt.md` Resolved section; ADR-0017 documents intentional distinction |

### Claims that are partially valid

| Claim ID | Document Says | Actual State | Correction |
|---|---|---|---|
| DOCS-001 | OpenAPI covers only 1 endpoint | 516-line spec covers Projects API (not 1 endpoint) | Gap is real: value cases, agents, commitments undocumented |
| INFRA-001 | 44 of 79 migrations lack rollbacks | 22 rollbacks for 117 migrations | Gap is real; document's counts are stale |

### Claims that are genuinely open

| Claim ID | Category | Verified Gap | Evidence |
|---|---|---|---|
| INFRA-002 | Infrastructure | No DR validation workflow exists | `ls .github/workflows/` — no `dr-validation.yml` |
| DOCS-002 | Documentation | No agent API endpoints in OpenAPI spec | `grep "^  /agent" packages/backend/openapi.yaml` returns nothing |

### Claims that are unverifiable (need clarification)

| Claim ID | Document Says | What is needed to verify |
|---|---|---|
| SEC-002 | Remove 8+ dead auth files | Document names no specific files; provide file paths to verify |
```

---

## Part 2 — Corrected Sprint Plan

Only schedule "Genuinely open" and corrected "Partially valid" items.

### Document header

```markdown
# Sprint Plan — Sprints N–N+2: [Theme]

**Author:** Ona
**Date:** YYYY-MM-DD
**Baseline:** Post-Sprint [N-1]. [One sentence on what the prior sprint delivered.]
**Source audit:** [Name/date of the external document being corrected]

---

## Baseline

### What is complete
[Bullet list of ✅ items from traceability.md and debt.md Resolved section
that are relevant to this planning horizon. Be specific — name the artifact.]

### What is open (verified)
[Bullet list of genuinely open items, each with a grep result or file
reference as evidence. Do not include items from the accuracy table's
"Already resolved" section.]

### What is deferred
[Items explicitly out of scope — from prior sprint deferred lists or
product decisions. One line each.]
```

### Sprint block

```markdown
## Sprint N — [Theme Title] (Weeks X–Y)

**Objective:** [One outcome statement. What is true at the end that was not
true at the start? Not a list of tasks.]

**Success statement:** [One or two sentences describing the observable
end state. Include a specific command or query that proves it.]

**Depends on:** [Prior sprint or external prerequisite, if any.]

**Architectural rationale:** [Why this sprint is ordered here. Name the
specific dependency chain. If applicable, name the competitor capability
this addresses.]

### KR N-1 — [Short title]

**Ref:** [Claim ID from accuracy table; debt item ID; file path]

**Acceptance criteria:**
- [Specific deliverable with file path]
- [Specific deliverable]
- Acceptance: [condition] → [observable outcome]
- Acceptance: [condition] → [observable outcome]

### KR N-2 — [Short title]
...

### KR N-3 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- [Any sprint-specific regression check]

**Risk flags:**
- **Risk:** [Specific risk]
  **Contingency:** [Specific fallback — not "investigate"]
```

### Excluded claims section

Always include this after the last sprint block.

```markdown
## Excluded from Plan

The following claims from the external document were not scheduled because
they are already resolved in the codebase. Include this section so the
same claims are not re-raised in future audits.

| Claim ID | Resolution evidence |
|---|---|
| SEC-003 | `server.ts` lines 580–589 |
| QUAL-002 | `debt.md` Resolved section; ADR-0017 |
| TEST-001 | `ci.yml` line 73: `--coverage.thresholds.lines=75 ...` |

The following claims require clarification before scheduling:

| Claim ID | What is needed |
|---|---|
| SEC-002 | Specific file paths for the "dead auth files" |
```

### Cross-sprint invariants table

Copy from `AGENTS.md` — do not invent new rules.

```markdown
## Cross-Sprint Invariants

Source: `AGENTS.md`. Applies to every PR across all sprints.

| Rule | Requirement |
|---|---|
| Tenant isolation | Every DB query includes `organization_id` or `tenant_id` |
| LLM calls | All production agent LLM calls use `this.secureInvoke()` |
| `service_role` | Used only in AuthService, tenant provisioning, cron jobs |
| No cross-tenant transfer | No operation copies, moves, or exports data between tenants |
| TypeScript strict | No `any`. Use `unknown` + type guards |
| Named exports | No default exports |
| Express request properties | Access `req.tenantId` directly — never `(req as any).tenantId` |
| Audit trail | Every CUD/export/approve/reject/grant/revoke action logged |
| Test gates | `pnpm test` and `pnpm run test:rls` must pass before merging |
```

---

## Sizing rules

| Sprint type | Max KRs | Signal that scope is too large |
|---|---|---|
| Documentation + rollback scripts | 3–4 | > 20 files to create |
| Operational execution (DR drill, load test) + `any` reduction | 3–4 | DR drill + > 2 other KRs |
| New endpoint + UI | 4–5 | > 3 new routes in one sprint |

If the verified open items exceed three sprints of work, defer the lowest-priority
items explicitly rather than cramming them in.

---

## Accuracy table classification rules

Apply these in order. Stop at the first match.

1. **Already resolved** — `debt.md` Resolved section contains the item, OR
   the specific file/config the document says is missing exists and contains
   the described content.

2. **Partially valid** — The gap category is real but at least one of these
   is wrong in the document: file path, line count, severity, affected
   component, or proposed fix.

3. **Genuinely open** — No file, migration, config, or doc addresses the gap.
   Grep returns nothing. The traceability map shows ❌.

4. **Unverifiable** — The claim names no specific artifact (file, table,
   endpoint, config key). Cannot confirm or deny without more information.
   Do not schedule; ask for specifics.

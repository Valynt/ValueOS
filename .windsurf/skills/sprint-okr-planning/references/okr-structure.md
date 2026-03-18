# OKR Document Structure

Annotated template for a single sprint block. Repeat for each sprint in the
planning horizon. Minimum four sprints per document.

---

## Document Header

```markdown
# ValueOS — Sprint OKR Planning Document
**Baseline:** Post-Sprint N (one-line description of what Sprint N delivered)
**Horizon:** Sprints N+1–N+4 (X weeks)
**Author:** Lead Architect
**Date:** YYYY-MM
```

---

## Strategic Arc (document-level, written once)

One paragraph per sprint summarising the dependency chain and the competitive
positioning logic. Answer: why this sequence and not another?

Structure:
- Sprint N+1: closes the last functional gap in [capability]
- Sprint N+2: makes the platform [enterprise-ready for X]
- Sprint N+3: builds [compounding layer]
- Sprint N+4: hardens for [procurement gate / GA]

Anchor competitive claims to specific named competitors and specific capability
gaps. ValueOS competitive context:
- **Mediafly**: content management and presentation polish — no adversarial
  claim review, no financial provenance
- **Gainsight**: CS workflow depth and health scoring — not pre-sale, not
  financially quantified
- **Vivun**: pipeline influence and deal-room collaboration — no value
  realization tracking, no hypothesis-first loop

---

## Sprint Block Template

````markdown
## Sprint N — [Theme Title]
**Weeks X–Y**
**Theme:** One sentence describing the sprint's character.

### Objective
One outcome statement. Not a list of tasks. Answers: what is true at the end
of this sprint that was not true at the start? Reference the competitive
differentiator if applicable.

### Key Results

**KR1 — [Short title]**
- [Specific deliverable with file path or artifact name]
- [Specific deliverable]
- Acceptance: [condition] → [observable outcome]; [condition] → [observable outcome]

**KR2 — [Short title]**
...

**KR3 — [Short title]**
...

[3–5 KRs total. At least one must be a test gate.]

### Architectural Rationale
Why this sprint is ordered here. Cover:
- Which prior sprint's output this sprint depends on (hard dependency)
- Which debt items or traceability gaps this sprint resolves
- Why this sprint is ordered before the next one
- Which competitor capability this sprint addresses (if applicable)

### Cross-Functional Dependencies
For each external team, state what they need and when.

| Team | What they need | When |
|---|---|---|
| GTM / PMM | [artifact or demo] | Sprint N close |
| Customer Success | [runbook or training] | Sprint N close |
| Sales | [one-pager or demo script] | Sprint N close |

### Risk Flags
- **Risk:** [specific risk statement]
  **Contingency:** [specific fallback — must be actionable, not "investigate"]

- **Risk:** [specific risk statement]
  **Contingency:** [specific fallback]

- **Debt consideration:** [debt item that will be touched but not fully resolved]
````

---

## Key Result Writing Rules

### Acceptance criteria format

Every KR must have at least one acceptance criterion in this form:

```
Acceptance: [condition] → [observable outcome]
```

Examples of well-formed criteria:
- `Acceptance: running TargetAgent writes nodes to value_tree_nodes → DB query returns rows`
- `Acceptance: SLACK_WEBHOOK_URL set → Slack message sent on HIGH/CRITICAL events`
- `Acceptance: cross-tenant read attempt → returns 403`
- `Acceptance: pnpm run test:rls passes for all three new tables`

Examples of poorly-formed criteria (do not use):
- "The feature works correctly" — not observable
- "Tests pass" — too vague; name the test suite
- "Performance is improved" — no threshold

### Debt anchoring

Every KR that resolves a debt item must cite it:

```markdown
- DEBT-003 resolved: `integrity_outputs` table, `IntegrityOutputRepository`,
  and `GET /api/v1/value-cases/:caseId/integrity` are all live
- Acceptance: issue #1344 closed; IntegrityStage renders real data after agent run
```

### Test gate KR

Every sprint must include at least one KR that is purely a validation gate.
Acceptable forms:

```markdown
**KR5 — Test suite green**
- `pnpm test` passes with 0 failed suites
- `pnpm run test:rls` passes for all new tables
- No new `any` introduced; CI ratchet does not regress
- Acceptance: CI green on the sprint's final PR
```

### TypeScript `any` burn-down

Include a `any` reduction KR in every sprint. Use the baseline from
`debt.md` and the monthly target:

```markdown
**KR5 — TypeScript `any` count reduced by ≥ N usages**
- Net −N across files touched in this sprint
- No new `any` introduced
- Acceptance: `ts-any-baseline.json` updated; CI ratchet does not regress
```

---

## Cross-Sprint Invariants Table

Include once at the end of the document, after all sprint blocks.

```markdown
## Cross-Sprint Architecture Invariants

| Invariant | Enforcement |
|---|---|
| Every DB query includes `organization_id` or `tenant_id` | Code review + `test:rls` in CI |
| All agent LLM calls use `this.secureInvoke()` | ESLint rule in `.windsurf/rules/agents.md` |
| `service_role` only in AuthService, tenant provisioning, cron jobs | Code review |
| TypeScript strict mode — no `any`, use `unknown` + type guards | ESLint `no-explicit-any` + CI ratchet |
| Named exports only | ESLint `import/no-default-export` |
| New agents: extend `BaseAgent`, Zod schema with `hallucination_check`, Handlebars prompts | Agent onboarding skill checklist |
| No hardcoded demo data in UI components | Code review; "Acme Corp" string banned by lint rule |
| Saga compensation function required for every new state mutation | PR template checklist |
```

Do not add invariants that are not in `AGENTS.md`. This table is a reminder,
not a new policy.

---

## Sprint Milestone Summary Table

Include once after the invariants table.

```markdown
## Sprint Milestone Summary

| Sprint | Closes When | Enterprise Signal |
|---|---|---|
| **N+1** | [one-line completion condition] | [what this enables for enterprise deals] |
| **N+2** | [one-line completion condition] | [what this enables] |
| **N+3** | [one-line completion condition] | [what this enables] |
| **N+4** | [one-line completion condition] | [what this enables] |
```

---

## Deferred Items List

Include at the end. Source from:
- Items marked "Deferred" or "Post-Sprint N" in prior sprint plans
- P2 debt items not scheduled in any sprint in this horizon
- Features in `spec.md` or the Architectural Design Brief with no traceability row

```markdown
## Deferred (Post-Sprint N+4)

- **[Feature name]** — [one-line reason for deferral]
- **[Feature name]** — [one-line reason for deferral]
```

---

## Sizing Heuristics

Use these to sanity-check sprint scope before publishing.

| Sprint type | Typical KR count | Typical PR count |
|---|---|---|
| Full-stack stage completion (DB + backend + frontend) | 4–5 KRs | 6–10 PRs |
| New agent + persistence | 3–4 KRs | 4–6 PRs |
| Integration (CRM, external API) | 3–4 KRs | 3–5 PRs |
| Hardening (performance, SOC 2, export) | 4–5 KRs | 4–6 PRs |
| Compounding intelligence (memory, analytics) | 4–5 KRs | 5–8 PRs |

If a sprint has >5 KRs, split it into two sprints or demote lower-priority KRs
to the deferred list. A sprint with >10 PRs is almost certainly over-scoped.

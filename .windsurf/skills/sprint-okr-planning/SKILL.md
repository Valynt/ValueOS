---
name: sprint-okr-planning
description: |
  Produce sprint OKR planning documents grounded in the ValueOS codebase. Use
  when asked to plan sprints, define OKRs, write a sprint roadmap, recommend
  engineering priorities, or produce a planning document for upcoming sprints.
  Triggers on requests like "plan the next sprints", "write sprint OKRs",
  "what should we build next", "recommend sprint priorities", "create a sprint
  roadmap", or "define key results for the next quarter". Covers reading the
  context layer to establish current state, anchoring KRs to specific debt
  items and GitHub issues, sequencing sprints by technical dependency, and
  structuring cross-functional handoff requirements and risk flags.
---

# Sprint OKR Planning

Produces a formal sprint planning document covering ≥4 sprints. Each sprint
has one Objective, 3–5 Key Results, architectural rationale, cross-functional
dependencies, and risk flags.

## Workflow

### Step 1 — Read the context layer

Read these files in order. Stop reading a file once you have extracted what is
listed. Do not bulk-load all files at once.

See [references/context-files.md](references/context-files.md) for what to
extract from each file and which grep patterns to use.

| File | Extract |
|---|---|
| `.windsurf/context/debt.md` | All P0 and P1 items with file paths and issue numbers |
| `.windsurf/context/traceability.md` | All ❌ and ⚠️ rows — missing DB tables, repos, endpoints, hooks, UI |
| `.windsurf/context/user-stories.md` | All stories with ❌ or ⚠️ status |
| `sprint-roadmap.md` | The most recent sprint number and its success statement |
| `docs/sprint-plan-*.md` | The most recent sprint plan file — read the last sprint's acceptance criteria |
| `.windsurf/context/decisions.md` | Undocumented decisions and known bugs (e.g. wrong LLM provider) |

Only read `docs/architecture/` files if the planning horizon involves a new
architectural layer (e.g. adding a new runtime service, changing the memory
subsystem, or introducing a new integration pattern).

### Step 2 — Establish the baseline

Before writing any sprint, state:

1. **Current sprint number** (from `sprint-roadmap.md`)
2. **What is complete** — stages with full ✅ traceability rows
3. **What is broken** — P0 debt items; these must appear in Sprint N (the first sprint)
4. **What is incomplete** — P1 debt items and ❌ traceability rows; sequence these by dependency
5. **What is deferred** — P2 items and anything explicitly listed as post-sprint in prior plans

### Step 3 — Sequence sprints by dependency

Apply these rules in order:

1. **P0 blockers first.** Any debt item that causes a runtime throw or a 404
   on a mounted route belongs in Sprint N, KR 1 or 2. Do not defer P0s.
2. **Persistence before UI.** A stage cannot be wired in the frontend until
   its DB table, repository, and API endpoint exist. Sequence DB → backend →
   frontend within a sprint or across adjacent sprints.
3. **Agent before persistence.** An agent must exist before its output can be
   persisted. If an agent is missing (❌ in traceability), it belongs in the
   same sprint as its DB table.
4. **Memory before compounding.** Cross-case learning and expansion signal
   detection require durable semantic memory. Do not schedule compounding
   intelligence sprints before the memory subsystem is confirmed live.
5. **Enterprise gates last.** SOC 2 evidence, performance SLOs, and export
   features are Sprint N+3 or later — they require a complete, real product
   to be meaningful.

### Step 4 — Write each sprint

Follow the structure in [references/okr-structure.md](references/okr-structure.md).

Rules for Key Results:
- Each KR maps to ≥1 debt item (cite `DEBT-NNN`) or traceability gap (cite
  the stage and layer: e.g. "Stage 3 Integrity — DB table missing")
- Include the GitHub issue number where one exists (e.g. `issue #1344`)
- Acceptance criteria use the form: `[condition] → [observable outcome]`
- At least one KR per sprint must be a test/validation gate:
  `pnpm test` green, `pnpm run test:rls` green, or a named integration test
- Do not write KRs for work that is already ✅ in traceability

Rules for architectural rationale:
- Explain why this sprint is ordered before the next one (dependency chain)
- Name the specific competitor capability this sprint addresses or surpasses,
  if applicable (Mediafly: content/presentation; Gainsight: health scoring/CS
  workflow; Vivun: pipeline influence/deal rooms)
- State which prior sprint's output this sprint depends on

Rules for risk flags:
- Every risk must have a contingency
- If a risk involves a missing environment credential (OAuth, API key), the
  contingency must include a mock/stub fallback that preserves the frontend flow
- Flag any debt item that will be touched but not fully resolved

### Step 5 — Write the cross-sprint invariants table

Always include a table of the non-negotiable rules from `AGENTS.md` that apply
to every PR across all sprints. Do not invent new rules — copy from AGENTS.md.

### Step 6 — Write the deferred items list

List everything explicitly excluded from the planning horizon. Source from:
- Items marked "Deferred" in prior sprint plans
- P2 debt items not scheduled in any sprint
- Features mentioned in `spec.md` or `docs/Architectural Design Brief*.md`
  that have no traceability row yet

---

## Anti-patterns

| Pattern | Fix |
|---|---|
| KR with no acceptance criteria | Add `[condition] → [observable outcome]` |
| Sprint that skips a P0 debt item | Move P0 to Sprint N KR 1 |
| UI wiring sprint before DB migration sprint | Reorder: DB → backend → frontend |
| KR referencing a feature already ✅ in traceability | Remove it |
| Risk flag with no contingency | Add contingency before publishing |
| Competitive claim with no architectural basis | Remove or qualify with "positioned to" |
| Sprint objective that is a list of tasks | Rewrite as a single outcome statement |

# Context Files Reference

What to extract from each `.windsurf/context/` file and `sprint-roadmap.md` when
planning sprints. Read only the sections listed — do not load entire files
unless the file is short (<100 lines).

---

## `.windsurf/context/debt.md`

**Purpose:** Prioritised inventory of known gaps, stubs, and broken paths.

**Extract:**

- All **P0** items: file path, issue number, one-line description of the break
- All **P1** items: file path, issue number, one-line description of the gap
- The **TypeScript `any` baseline count** and monthly burn-down targets
- The **Resolved** section — do not schedule work that is already resolved

**Key signals:**

- P0 items that cause runtime throws → Sprint N, KR 1 or 2 (non-negotiable)
- P1 items with issue numbers → anchor KRs to those issue numbers
- TODO stubs in service files → flag as risk if the service is on the critical path

**Grep pattern to find all debt items quickly:**

```bash
grep -n "^### DEBT-" .windsurf/context/debt.md
```

---

## `.windsurf/context/traceability.md`

**Purpose:** Full-stack slice for every lifecycle stage. The authoritative map
of what exists and what is missing at each layer.

**Extract:**

- Every row marked ❌ (missing) — note the stage, layer, and artifact name
- Every row marked ⚠️ (partial/stub) — note what is present and what is absent
- The **confirmed gaps** noted in prose below each stage table
- The **cross-cutting agent invocation path** — check for ⚠️ markers

**Key signals:**

- ❌ DB table → migration required before any other layer in that stage
- ❌ Repository → backend work required before API endpoint
- ❌ API endpoint → backend work required before frontend hook
- ❌ Frontend hook → frontend work required before UI wiring
- ⚠️ UI component with hardcoded data → frontend wiring sprint

**Grep pattern to find all missing/partial items:**

```bash
grep -n "❌\|⚠️" .windsurf/context/traceability.md
```

**Stage → Sprint mapping heuristic:**

Each ❌ stage typically requires one sprint to complete all layers (DB →
repository → service → API → hook → UI). If a stage has both a missing agent
and missing DB persistence, budget the full stack in one sprint. If only the
frontend layer is missing, it can be bundled with another stage's frontend work.

---

## `.windsurf/context/user-stories.md`

**Purpose:** Acceptance criteria and implementation status for each user story.

**Extract:**

- All stories with status ❌ — these are unimplemented features
- All stories with status ⚠️ — these are partially implemented; read the Gap line
- The **Personas** table — use these when writing cross-functional dependencies
  (VE = Value Engineer, Buyer, Admin, Platform)

**Key signals:**

- A story with ❌ status and a debt reference → the debt item is the blocker;
  resolving the debt item closes the story
- A story with ⚠️ status and a CRM gap → Salesforce/HubSpot integration sprint
- A story with ⚠️ status and a memory gap → memory subsystem sprint

**Grep pattern:**

```bash
grep -n "^**Status:**" .windsurf/context/user-stories.md
```

---

## `sprint-roadmap.md`

**Purpose:** Historical sprint record. Establishes the current sprint number
and what the most recent sprint delivered.

**Extract:**

- The most recent sprint number (look for the highest "Sprint N" heading)
- The success statement of the most recent sprint
- Any items explicitly listed as "Non-Goals" or "Out of scope" in the most
  recent sprint — these are candidates for the next sprint

**Key signals:**

- "Sprint 10 complete" → next planning horizon starts at Sprint 11
- Non-goals from the last sprint → first candidates for Sprint N

**Grep pattern:**

```bash
grep -n "^## Sprint\|Non-Goal\|Out of scope\|Deferred" sprint-roadmap.md | tail -30
```

---

## `docs/sprint-plan-*.md`

**Purpose:** Detailed sprint plans for the most recent planning horizon.
Contains acceptance criteria that may already be partially complete.

**Extract:**

- The last sprint's acceptance criteria checklist — identify which items are
  checked (✅) vs unchecked
- Any "Deferred (Post-Sprint N)" section — these are explicit carry-overs
- Cross-sprint milestones table — use to anchor the new planning horizon

**Key signals:**

- Unchecked acceptance criteria from the last sprint → carry into Sprint N
- "Deferred" items → Sprint N+2 or N+3 depending on dependency

**File discovery:**

```bash
ls docs/sprint-plan-*.md | sort | tail -1
```

---

## `.windsurf/context/decisions.md`

**Purpose:** ADR digest and undocumented architectural decisions.

**Extract:**

- The **Undocumented decisions** section — these contain known bugs and
  constraints that affect sprint planning (e.g. wrong LLM provider, deprecated
  packages)
- Any decision marked with a risk note (⚠️) — these may need ADR promotion

**Key signals:**

- "known bug" in an undocumented decision → P0 debt item; verify it appears
  in `debt.md`; if not, it must be added to Sprint N
- "deprecated" packages → do not schedule work that extends them

---

## `.windsurf/context/memory.md`

**Purpose:** Lessons learned and anti-patterns. Read this before scheduling
any sprint that touches agent code, DB queries, or UI components.

**Extract:**

- The **Anti-patterns** section — use these to write the anti-patterns table
  in each sprint's risk flags
- The **Recurring Review Checklist** — use this as the acceptance criteria
  template for any sprint that ships a new agent

**Key signals:**

- "Hardcoding 'Acme Corp'" anti-pattern → any sprint wiring a UI stage must
  include a KR that bans hardcoded demo data
- "Agent persistence: always write to DB" pattern → any sprint shipping an
  agent must include a KR for DB persistence, not memory-only output
- "Mounting a router without verifying the path" anti-pattern → any sprint
  adding API endpoints must include a KR that verifies the mount in `server.ts`

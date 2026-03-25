# Technical Debt — Context Register

Prioritised inventory of known gaps, stubs, and debt. Update when debt is resolved or discovered.
Source of truth for sprint planning. Linked GitHub issues where they exist.

---

## P0 — Blocking (production path broken)

_No active items._

---

## P1 — High (lifecycle loop incomplete, visible to users)

_No active items._

---

## P2 — Medium (feature completeness)

_No active items._

---

## Ongoing — TypeScript `any` debt

_Resolved. All production `any` usages eliminated. See resolved table below._

---

## Resolved debt (for reference)

| Item | Resolution | Date |
| --- | --- | --- |
| DEBT-001: Direct-mode agent uses wrong LLM provider | `provider: "openai"` → `provider: "together"` in `getDirectFactory()`. | Sprint 11 |
| DEBT-002: Direct-mode MemorySystem persistence disabled | `enable_persistence: false` → `true` + `SupabaseMemoryBackend` wired. | Sprint 11 |
| DEBT-valueCasesRouter: not mounted in server.ts | Mounted at `/api/v1/cases` and `/api/v1/value-cases`. | 2026-07-01 |
| DEBT-003: IntegrityStage renders hardcoded demo data | Migration + repository + hook + stage wired to real data. | Sprint 11 |
| DEBT-004: RealizationStage renders hardcoded demo data | `realization_reports` table, repository, hook, stage wired. | Sprint 11 |
| DEBT-005: NarrativeAgent does not exist | `NarrativeAgent.ts` implemented; narrative endpoints + hook wired. | Sprint 11 |
| DEBT-006: ValueCaseCanvas hardcodes case title | Uses `useCase(caseId)` hook; renders `case.title`. | Sprint 11 |
| DEBT-007: ValueCommitmentTrackingService — 12+ TODO stubs | All stub methods replaced with `apiClient` calls. Issue #1348. | Sprint 20 |
| DEBT-ANY-BURNDOWN: TypeScript `any` cast burn-down (Audit Rec #9, #13) | All 207 production `any` usages eliminated across 6 packages/apps. Dead-code directories deleted (`sdui/examples/`, `components/_archive/`). CI scripts updated (comment-aware counting, `__benchmarks__` exclusion, `VOSAcademy` removed, `agentic-ui-pro` added). Ratchet baseline reset to 0. Dashboard shows 0 globally. | 2026-03-25 |

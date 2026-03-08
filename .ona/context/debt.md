# Technical Debt — Context Register

Prioritised inventory of known gaps, stubs, and debt. Update when debt is resolved or discovered.
Source of truth for sprint planning. Linked GitHub issues where they exist.

---

## P0 — Blocking (production path broken)

### DEBT-001: Direct-mode agent execution uses wrong LLM provider
**File:** `packages/backend/src/services/UnifiedAgentOrchestrator.ts:414`
**File:** `packages/backend/src/routes/agents.ts` (getDirectFactory)
**Issue:** [#1343](https://github.com/Valynt/ValueOS/issues/1343)

`LLMGateway` only implements `provider: "together"`. Both `UnifiedAgentOrchestrator` and `getDirectFactory()` instantiate it with `provider: "openai"`, causing every direct-mode agent invocation to throw `'Provider not implemented'`.

**Fix:** Change `provider: "openai"` → `provider: "together"` in both locations.

### DEBT-002: Direct-mode MemorySystem has persistence disabled
**File:** `packages/backend/src/routes/agents.ts` (getDirectFactory)

`MemorySystem` is instantiated with `enable_persistence: false` for direct-mode execution. Agent-to-agent memory handoffs fail because memories are lost between HTTP requests.

**Fix:** Set `enable_persistence: true` or wire to `SupabaseMemoryBackend`.

---

## P1 — High (lifecycle loop incomplete, visible to users)

### DEBT-003: IntegrityStage renders hardcoded demo data
**File:** `apps/ValyntApp/src/` (IntegrityStage component)
**Issue:** [#1344](https://github.com/Valynt/ValueOS/issues/1344)

No `integrity_outputs` table, no repository, no API endpoint. `IntegrityAgent` stores output in `MemorySystem` only — lost on restart.

**Fix:** Migration + `IntegrityOutputRepository` + `GET /api/v1/value-cases/:id/integrity` + frontend hook.

### DEBT-004: RealizationStage renders hardcoded demo data
**File:** `apps/ValyntApp/src/` (RealizationStage component)
**Issue:** [#1345](https://github.com/Valynt/ValueOS/issues/1345)

Same pattern as DEBT-003. No `realization_outputs` table, no repository, no endpoint.

### DEBT-005: NarrativeAgent does not exist
**Issue:** [#1346](https://github.com/Valynt/ValueOS/issues/1346)

`NarrativeStage` UI exists but there is no `NarrativeAgent.ts` in `packages/backend/src/lib/agent-fabric/agents/`. Only an `AgentServiceAdapter` wrapper exists. The stage has no backend.

### DEBT-006: ValueCaseCanvas hardcodes case title
**File:** `apps/ValyntApp/src/` (ValueCaseCanvas)
**Issue:** [#1347](https://github.com/Valynt/ValueOS/issues/1347)

Canvas header always shows "Acme Corp — Enterprise Platform Migration" regardless of the actual case.

**Fix:** Replace with `useCase(caseId)` hook, render `case.title` and `case.organization_name`.

### DEBT-007: ValueCommitmentTrackingService — 12+ TODO stubs
**File:** `apps/ValyntApp/src/services/ValueCommitmentTrackingService.ts`
**Ticket:** VOS-DEBT-1427
**Issue:** [#1348](https://github.com/Valynt/ValueOS/issues/1348)

Every DB operation is a TODO comment returning mock data. Milestones, metrics, risks, stakeholders, audit entries — all non-functional. The entire commitment tracking feature is scaffolded but inert.

---

## P2 — Medium (feature completeness)

### DEBT-008: Enterprise integrations are empty stubs
**File:** `packages/integrations/src/`
**Issue:** [#1349](https://github.com/Valynt/ValueOS/issues/1349)

Salesforce, ServiceNow, Slack, and SharePoint adapters have empty method bodies. Only HubSpot has a real implementation. CRM integration falls back to mock "Acme Corp" data in dev.

### DEBT-009: ExpansionAgent has no DB persistence
Same pattern as DEBT-003/004. No `expansion_outputs` table, no repository, no endpoint.

### DEBT-010: SecurityMonitor alert channels are stubs
**File:** `packages/backend/src/services/security/SecurityMonitor.ts:470-502`
**Ticket:** VOS-DEBT-1427

Email, Slack, PagerDuty, and management escalation methods are all TODO comments. Security alerts are logged but not delivered.

### DEBT-011: SandboxedExecutor uses placeholder E2B SDK calls
**File:** `packages/backend/src/services/SandboxedExecutor.ts`

Code execution sandbox is scaffolded with placeholder `fetch` calls instead of the real E2B SDK.

### DEBT-012: VOSAcademy content loader returns mock data
`loadContentFromJson()` and `loadContentFromApi()` return hardcoded module structures. Curriculum content is not wired to any real data source.

---

## Ongoing — TypeScript `any` debt

**Baseline (2026-02-13):** 1,977 `any` usages across the codebase. Target: <100.

| Module | Count | Monthly target |
|---|---|---|
| `apps/ValyntApp` | 839 | -26/month |
| `packages/backend` | 712 | -22/month |
| `packages/sdui` | 133 | -4/month |
| `packages/mcp` | 96 | -3/month |
| `apps/VOSAcademy` | 67 | -3/month |

**Rule:** Do not introduce new `any`. Use `unknown` + type guards. Replace `any` in files you touch.
Dashboard: `docs/debt/ts-any-dashboard.md`

---

## Resolved debt (for reference)

| Item | Resolution | Date |
|---|---|---|
| Standalone agents in `packages/agents/` used in production | Superseded by agent-fabric; deprecated | 2026-02 |
| Missing `workflow_checkpoints` migration | Migration added | 2026-02 |
| Missing `financial_model_snapshots` migration | Migration added | 2026-02 |

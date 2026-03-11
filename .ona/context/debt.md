# Technical Debt — Context Register

Prioritised inventory of known gaps, stubs, and debt. Update when debt is resolved or discovered.
Source of truth for sprint planning. Linked GitHub issues where they exist.

---

## P0 — Blocking (production path broken)

~~### DEBT-001: Direct-mode agent execution uses wrong LLM provider~~
**Resolved in Sprint 11.** `provider: "openai"` → `provider: "together"` in `getDirectFactory()` (`packages/backend/src/api/agents.ts`). Regression test: `src/api/__tests__/agents.factory.test.ts`.

~~### DEBT-002: Direct-mode MemorySystem has persistence disabled~~
**Resolved in Sprint 11.** `enable_persistence: false` → `true` + `SupabaseMemoryBackend` wired in `getDirectFactory()`. Regression test: `src/api/__tests__/agents.factory.test.ts`.

---

## P1 — High (lifecycle loop incomplete, visible to users)

~~### DEBT-003: IntegrityStage renders hardcoded demo data~~
**Resolved in Sprint 11.** Migration `20260325000000_integrity_outputs.sql`, `IntegrityOutputRepository`, `GET /api/v1/cases/:caseId/integrity`, `useIntegrityOutput` hook, `IntegrityStage` wired to real data.

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

### DEBT-008: Enterprise integrations — ServiceNow, Slack, SharePoint not implemented
**File:** `packages/integrations/`
**Issue:** [#1349](https://github.com/Valynt/ValueOS/issues/1349)

HubSpot and Salesforce are the only active adapters. ServiceNow, Slack, and SharePoint are scaffolded but all methods throw `Error("... not implemented")` and are excluded from the package's public exports. They are not wired into any production path. Implement when integration depth becomes a product priority post-GA.

### DEBT-009: ExpansionAgent has no DB persistence
Same pattern as DEBT-003/004. No `expansion_outputs` table, no repository, no endpoint.

### DEBT-010: SecurityMonitor alert channels are stubs
**File:** `packages/backend/src/services/security/SecurityMonitor.ts:470-502`
**Ticket:** VOS-DEBT-1427

Email, Slack, PagerDuty, and management escalation methods are all TODO comments. Security alerts are logged but not delivered.

### DEBT-011: SandboxedExecutor uses placeholder E2B SDK calls
**File:** `packages/backend/src/services/SandboxedExecutor.ts`

Code execution sandbox is scaffolded with placeholder `fetch` calls instead of the real E2B SDK.

### DEBT-012: VOSAcademy content loader not implemented
`loadContentFromJson()` and `loadContentFromApi()` now throw `Error("... not implemented")` explicitly. Curriculum content source is a product decision, not an engineering blocker. Implement when the content strategy is defined.

---

## Ongoing — TypeScript `any` debt

**Baseline (2026-02-13):** 1,977 `any` usages across the codebase. Target: <100.
**Updated (2026-03-11):** `packages/backend` reduced from 712 → ~680 (AuditLogService, ToolRegistry, auditHooks cleaned in PR #1422).

| Module | Count | Monthly target |
|---|---|---|
| `apps/ValyntApp` | 839 | -26/month |
| `packages/backend` | ~680 | -22/month |
| `packages/sdui` | 133 | -4/month |
| `packages/mcp` | 96 | -3/month |
| `apps/VOSAcademy` | 67 | -3/month |

**Highest-density remaining files (backend):**
- `config/secrets/InputValidator.ts` (21) — custom validation logic, replace with Zod
- `api/referrals.ts` (20), `api/admin.ts` (20) — request body types
- `services/collaboration/AgentCollaborationService.ts` (17) — agent message payloads

**Rule:** Do not introduce new `any`. Use `unknown` + type guards. Replace `any` in files you touch.
Dashboard: `docs/debt/ts-any-dashboard.md`

---

## Resolved debt (for reference)

| Item | Resolution | Date |
|---|---|---|
| Standalone agents in `packages/agents/` used in production | Superseded by agent-fabric; deprecated | 2026-02 |
| Missing `workflow_checkpoints` migration | Migration added | 2026-02 |
| Missing `financial_model_snapshots` migration | Migration added | 2026-02 |
| SEC-02: Placeholder secrets committed to git | Removed from tracking; `.gitignore` updated (PR #1422) | 2026-03 |
| SEC-01: Checkpoint routes unauthenticated | `requireAuth` + `requirePermission` added (PR #1422) | 2026-03 |
| SEC-06: `POST /usage/persist` missing input validation | Zod schema added (PR #1422) | 2026-03 |
| CQA-01: Redis-based WorkflowExecutionStore dead code | Deleted; broken imports fixed (PR #1422) | 2026-03 |
| CQA-02: Root MySQL/Drizzle schema dead code | `drizzle/` dir and `drizzle.config.ts` deleted (PR #1422) | 2026-03 |
| EH-01: Silent catch in server.ts telemetry block | Error detail now logged (PR #1422) | 2026-03 |
| EH-02: `tenantId` absent from logger context | `tenantContextMiddleware` calls `runWithContext` (PR #1422) | 2026-03 |
| EH-03: Sentry stubs were no-ops | Real `@sentry/node` + `@sentry/react` wired (PR #1422) | 2026-03 |
| EH-A-04: No audit trail on teams/usage mutations | `auditOperation`/`auditRoleAssignment`/`auditBulkDelete` added (PR #1422) | 2026-03 |
| INF-01: Legacy `health.ts` with hardcoded responses | Deleted; server uses `health/index.ts` with real checks (PR #1422) | 2026-03 |
| CQA-04 (partial): `any` in AuditLogService, ToolRegistry, auditHooks | Replaced with typed alternatives (PR #1422) | 2026-03 |

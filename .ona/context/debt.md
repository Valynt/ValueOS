# Technical Debt — Context Register

Prioritised inventory of known gaps, stubs, and debt. Update when debt is resolved or discovered.
Source of truth for sprint planning. Linked GitHub issues where they exist.

---

## P0 — Blocking (production path broken)

~~### DEBT-001: Direct-mode agent execution uses wrong LLM provider~~
**Resolved in Sprint 11.** `provider: "openai"` → `provider: "together"` in `getDirectFactory()` (`packages/backend/src/api/agents.ts`). Regression test: `src/api/__tests__/agents.factory.test.ts`.

~~### DEBT-002: Direct-mode MemorySystem has persistence disabled~~
**Resolved in Sprint 11.** `enable_persistence: false` → `true` + `SupabaseMemoryBackend` wired in `getDirectFactory()`. Regression test: `src/api/__tests__/agents.factory.test.ts`.

~~### DEBT-valueCasesRouter: `valueCasesRouter` not mounted in `server.ts`~~
**Resolved (2026-07-01).** Mounted at `/api/v1/cases` and `/api/v1/value-cases` in `server.ts`. All `/api/v1/value-cases/...` endpoints now reachable. `traceability.md` updated.

---

## P1 — High (lifecycle loop incomplete, visible to users)

~~### DEBT-003: IntegrityStage renders hardcoded demo data~~
**Resolved in Sprint 11.** Migration `20260325000000_integrity_outputs.sql`, `IntegrityOutputRepository`, `GET /api/v1/cases/:caseId/integrity`, `useIntegrityOutput` hook, `IntegrityStage` wired to real data.

~~### DEBT-004: RealizationStage renders hardcoded demo data~~
**Resolved outside sprint cadence.** `realization_reports` table (migration `20260321000000_back_half_tables.sql`), `RealizationReportRepository`, `GET /api/v1/cases/:caseId/realization`, `useRealization` hook, `RealizationStage` wired to real data.

~~### DEBT-005: NarrativeAgent does not exist~~
**Resolved outside sprint cadence.** `NarrativeAgent.ts` implemented in agent-fabric, `narrative_drafts` table (migration `20260321000000_back_half_tables.sql`), `NarrativeDraftRepository`, `GET /api/v1/cases/:caseId/narrative` + `POST .../narrative/run`, `useNarrative` hook, `NarrativeStage` wired to real data.

~~### DEBT-006: ValueCaseCanvas hardcodes case title~~
**Resolved outside sprint cadence.** `ValueCaseCanvas.tsx` uses `useCase(caseId)` hook; renders `case.title` and `case.organization_name`.

~~### DEBT-007: ValueCommitmentTrackingService — 12+ TODO stubs~~
**Resolved in Sprint 20.**
- DB migration `20260718000000_commitment_tracking_tables.sql` creates `value_commitments`, `commitment_milestones`, `commitment_metrics`, `commitment_risks`, `commitment_stakeholders`, `commitment_notes`, `commitment_audits` with RLS.
- `ValueCommitmentBackendService` extended with milestone, metric, risk, stakeholder, progress, and at-risk methods.
- `valueCommitmentsRouter` extended with 10 sub-resource endpoints.
- Frontend `ValueCommitmentTrackingService` fully migrated — all stub methods replaced with `apiClient` calls. No TODO stubs remain.
Issue [#1348](https://github.com/Valynt/ValueOS/issues/1348).

---

## P2 — Medium (feature completeness)

~~### DEBT-008: Enterprise integrations — ServiceNow, Slack, SharePoint not implemented~~
**Resolved.** All three adapters fully implemented using their respective REST APIs (ServiceNow Table API, Slack Web API, Microsoft Graph API). Tenant isolation via `credentials.tenantId` on all normalized entities. Error mapping, rate limiting, and timeout handling consistent with HubSpot/Salesforce adapters.

~~### DEBT-009: ExpansionAgent has no DB persistence~~
**Resolved outside sprint cadence.** `expansion_opportunities` table (migration `20260322000000_persistent_memory_tables.sql`), `ExpansionOpportunityRepository`, `GET /api/v1/cases/:caseId/expansion` + `POST .../expansion/run`, `useExpansion` hook, `ExpansionStage` wired to real data, registered in `LifecycleStageNav`.

### DEBT-010: SecurityMonitor alert channels are stubs
**File:** `packages/backend/src/services/security/SecurityMonitor.ts:470-502`
**Ticket:** VOS-DEBT-1427

Email, Slack, PagerDuty, and management escalation methods are all TODO comments. Security alerts are logged but not delivered.

~~### DEBT-011: SandboxedExecutor uses placeholder E2B SDK calls~~
**Resolved.** Replaced placeholder `fetch` calls with the `@e2b/code-interpreter` SDK (`Sandbox.create` + `runCode` + `kill`). `E2B_API_KEY` documented in `.env.local.example`.

~~### DEBT-012: VOSAcademy content loader not implemented~~
**Resolved.** `loadContentFromJson()` fetches a static JSON asset by URL path (place file in `public/`); `loadContentFromApi()` fetches from an API endpoint with optional `pillarId`/`role` query params. Both validate the response with Zod before returning.

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
| Missing `sessions`, `messages`, `agent_audit_logs` migrations (GDPR Art.17 gap) | Migration `20260331000000_p1_missing_tables.sql` | 2026-03 |
| Missing `workflow_executions`, `prompt_executions`, `agent_predictions`, `active_sessions` migrations | Migration `20260331010000_deferred_tables.sql` | 2026-03 |
| Deferred performance indexes with no target tables | Tables created; indexes promoted in `20260331020000_promote_deferred_indexes.sql` | 2026-03 |
| `AuditLogService.ts` — all `audit_logs` queries cast as `any` | `AuditLogEntry` type added; all casts removed | 2026-03 |
| `pnpm run test:rls` was a no-op (documented but not wired) | Script wired in `package.json` | 2026-03 |
| `value_cases` queries used `tenant_id` only, missing rows with only `organization_id` set | `ValueCaseService.ts` queries updated to `.or(tenant_id,organization_id)` | 2026-03 |
| `semantic_memory` had no `embedding_model` column — stale vectors undetectable after model change | Column + index added in `20260331040000_semantic_memory_embedding_model.sql` | 2026-03 |
| DEBT-004: RealizationStage hardcoded demo data | `realization_reports` table + `RealizationReportRepository` + API + hook + stage wired | 2026-06 |
| DEBT-005: NarrativeAgent did not exist | `NarrativeAgent.ts` + `narrative_drafts` table + `NarrativeDraftRepository` + API + hook + stage wired | 2026-06 |
| DEBT-006: ValueCaseCanvas hardcoded title | `ValueCaseCanvas.tsx` uses `useCase(caseId)` hook | 2026-06 |
| DEBT-007: ValueCommitmentTrackingService stubs | DB migration + `ValueCommitmentBackendService` sub-resources + 10 router endpoints + frontend migration | 2026-07 |
| DEBT-009: ExpansionAgent had no DB persistence | `expansion_opportunities` table + `ExpansionOpportunityRepository` + API + hook + `ExpansionStage` wired | 2026-06 |
| No `created_by`/`updated_by` actor columns on mutable tables | Added to `value_cases`, `hypothesis_outputs`, `integrity_outputs`, `narrative_drafts`, `realization_reports` in `20260331030000_actor_columns.sql` | 2026-03 |
| `usage_ledger`, `rated_ledger`, `saga_transitions`, `value_loop_events` — no partitioning | Converted to monthly `PARTITION BY RANGE` in `20260401000000`; `create_next_monthly_partitions()` function added | 2026-04 |
| `claims`, `kpis`, `milestones`, `risks` buried in jsonb — unindexable for aggregation | Scalar count columns promoted on `integrity_outputs` and `realization_reports` in `20260401010000` | 2026-04 |
| `crm_connections` had no active migration (only in archived monolith) | Migration `20260401020000_crm_connections.sql` added | 2026-04 |
| Key rotation incomplete — no job to re-encrypt existing ciphertext | `TokenReEncryptionJob.ts` + `POST /admin/crm/re-encrypt-tokens` | 2026-04 |
| No tenant deletion workflow (offboarding path undefined) | `TenantDeletionService.ts` (3-phase) + 4 admin endpoints + `20260401030000_tenant_deletion_columns.sql` | 2026-04 |
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

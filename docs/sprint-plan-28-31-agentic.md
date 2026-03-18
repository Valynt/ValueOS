# Sprint Plan — Sprints 28–31: Services Cleanup, Agentic Wiring, and Export

**Author:** Ona (AI Engineering Agent)
**Date:** 2026-03-12 (revised after codebase audit)
**Baseline:** Post-Sprint 27

---

## Baseline (Post-Sprint 27)

### What is complete

- All six lifecycle stages — full stack slices live (Stages 1–6)
- Six runtime services wired: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine
- `realtime/MessageBus` `CommunicationEvent` carries `tenant_id` (Sprint 24)
- All four skip-marked security bugs resolved (Sprint 25)
- Partition scheduler wired; RBAC runbook exists (Sprint 26)
- `packages/backend` `any` < 664; `packages/sdui` < 50; `apps/ValyntApp` < 207 (Sprints 26–27)
- `TenantContextIngestionService` exists with Zod-validated input and tenant-scoped memory storage (Sprint 27)
- Refactor Phases 1–5 complete (ADRs 0010–0014): canonical `LifecycleStage`, DI container deleted, single `CircuitBreaker`, two-layer memory, self-HTTP-loop fixed
- `CacheService.ts` deleted; `services/` has domain subdirectories (`agents/`, `billing/`, `auth/`, `security/`, `workflow/`, `tenant/`, `memory/`, `cache/`, `crm/`, and more); `services/post-v1/` exists
- `ValueCaseSaga`, `EvidenceTiering`, `ConfidenceScorer`, `IdempotencyGuard`, `DeadLetterQueue` implemented at `packages/backend/src/lib/agents/core/`
- `HypothesisLoop` implemented at `packages/backend/src/lib/agents/orchestration/`
- `SagaEvent` types in `packages/shared/src/types/events.ts`; `saga_transitions` table has active migration (20260323000000)
- `ProvenanceTracker` and `ProvenanceStore` interface implemented in `packages/memory/provenance/index.ts`; `SupabaseProvenanceStore` in `services/workflows/SagaAdapters.ts`
- `PdfExportService` exists; `POST /api/v1/cases/:id/export/pdf` endpoint live in `backHalf.ts`

### What is open (sequenced into this horizon)

**Services flat-root cleanup (48 files remain at `services/` root):**
- `CircuitBreaker.ts`, `CircuitBreakerManager.ts`, `CircuitBreakerManager.categorized.ts` — re-export shims, not yet moved to `services/agents/resilience/` barrel
- `UnifiedAgentAPI.ts`, `ValueCaseService.ts`, `HypothesisOutputService.ts`, `ValueTreeService.ts`, `ValueCommitmentTrackingService.ts` — V1 services not yet grouped under domain subdirs
- `PdfExportService.ts`, `SemanticMemory.ts`, `VectorSearchService.ts`, `ToolRegistry.ts` and ~40 others — still at flat root

**Frontend raw `fetch()` (8 remaining call sites):**
- `useAuditLog.ts` — audit log export
- `useOpportunityBrief.ts` — uses `fetchJSON` wrapper (bypasses `UnifiedApiClient`)
- `useProjects.ts` — 4 raw `fetch()` calls
- `useWebVitals.ts`, `lib/llm/client.ts`, `lib/securityHeaders.ts`, `OrganizationUsers.tsx` — 4 more

**Agentic wiring gaps:**
- `workflow_states` table has no active migration — `SupabaseSagaPersistence.saveState()` writes to it but the table does not exist; `ValueCaseSaga` cannot persist state
- `ValueLifecycleOrchestrator` (in `services/post-v1/`) is not imported anywhere in the live API path — `HypothesisLoop` is unreachable from any route
- No `/api/admin/dlq` endpoint — `DeadLetterQueue` has no admin surface
- No tests for `ValueCaseSaga`, `HypothesisLoop`, `EvidenceTiering`, `ConfidenceScorer`, or `ProvenanceTracker`

**Evidence tiering and provenance wiring gaps:**
- `IntegrityAgent` does not call `EvidenceTiering` or `ConfidenceScorer` — `evidence_tier` and `confidence_score` exist only inside the `claims` jsonb column, not as outputs from the tiering classes
- `TargetAgent` and `FinancialModelingAgent` do not call `ProvenanceTracker.record()` — no provenance records are written on value tree node creation
- No `GET /api/v1/cases/:caseId/provenance/:claimId` endpoint

**PPTX export:**
- PDF export exists (`POST /api/v1/cases/:id/export/pdf`); PPTX does not — `artifact.ts` explicitly excludes it: `"pptx" is excluded — no PPTX rendering pipeline exists`
- No "Export" button in `ValueCaseCanvas` toolbar; `useExport()` in `utils/export.ts` handles DOM-to-PDF/PNG only, not the backend export endpoint

### What is deferred (post-Sprint 31)

- US-007 — Tenant onboarding UI (backend service exists; UI is next horizon)
- `packages/mcp` `any` reduction (96 usages)
- `apps/VOSAcademy` `any` reduction (85 usages)
- Kafka rollout
- Grafana alerting rules wired to runbooks
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- ADR-0005 Theme Precedence (proposed, not accepted)

---

## Sprint 28 — Services Root Cleanup and Frontend Fetch Migration (Weeks 1–2)

**Objective:** The `services/` flat root is reduced to ≤ 20 files. All 8 remaining raw `fetch()` call sites in `apps/ValyntApp` are migrated to `UnifiedApiClient`. An ESLint rule blocks new raw calls.

**Success statement:** `find packages/backend/src/services -maxdepth 1 -name "*.ts" | wc -l` returns ≤ 20. `grep -rl 'fetch.*['"'"'"`]/api/' apps/ValyntApp/src` returns 0 results. `pnpm test` and `pnpm run lint` pass.

**Depends on:** Sprint 27 complete.

**Architectural rationale:** The domain subdirectories exist but 48 files remain at the flat root, defeating the purpose of the reorganisation. The remaining raw `fetch()` sites are small in number (8) but include auth-sensitive paths (`OrganizationUsers.tsx`, `useAuditLog.ts`) where missing auth headers cause silent 401s. Both are low-risk, high-value cleanup tasks that unblock the agentic wiring sprint by ensuring new services land in the correct location and new hooks use the correct client.

### KR 28-1 — V1 services moved to domain subdirectories

**Ref:** `refactor-spec.md` R7; `packages/backend/src/config/v1-service-scope.ts`

**Acceptance criteria:**
- `UnifiedAgentAPI.ts`, `ValueCaseService.ts`, `HypothesisOutputService.ts`, `ValueTreeService.ts`, `ValueCommitmentTrackingService.ts` moved to `services/value/` or appropriate domain subdir
- `PdfExportService.ts` moved to `services/export/`
- `SemanticMemory.ts`, `VectorSearchService.ts` moved to `services/memory/`
- `ToolRegistry.ts` moved to `services/tools/` (subdir already exists)
- `CircuitBreaker.ts`, `CircuitBreakerManager.ts`, `CircuitBreakerManager.categorized.ts` re-export shims moved to `services/agents/resilience/`
- Each moved file's original path re-exported via barrel `index.ts` at the old location to preserve existing imports
- `find packages/backend/src/services -maxdepth 1 -name "*.ts" | wc -l` ≤ 20
- `pnpm run lint` passes; `pnpm test` green

### KR 28-2 — Remaining raw `fetch()` call sites migrated

**Ref:** `refactor-spec.md` R8; 8 confirmed call sites

**Acceptance criteria:**
- `useProjects.ts` (4 calls), `useAuditLog.ts`, `OrganizationUsers.tsx` migrated to `UnifiedApiClient`
- `useWebVitals.ts`, `lib/llm/client.ts`, `lib/securityHeaders.ts` migrated or confirmed as legitimate exceptions (e.g. CSP violation reporting) with inline comment explaining the exception
- `useOpportunityBrief.ts` `fetchJSON` wrapper replaced with `UnifiedApiClient` call
- `grep -rl 'fetch.*['"'"'"`]/api/' apps/ValyntApp/src` returns 0 results
- `pnpm test` green for all migrated hook test files

### KR 28-3 — ESLint rule blocking new raw `fetch()` calls

**Ref:** `refactor-spec.md` R8

**Acceptance criteria:**
- ESLint rule added to `apps/ValyntApp` config flagging `fetch(` calls where the URL starts with `/api/`
- Rule is `error` severity — new violations fail CI
- Scoped to `src/hooks/`, `src/views/`, `src/features/`; excludes `src/lib/` and `src/utils/`
- `pnpm run lint` passes with the rule active

### KR 28-4 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- `find packages/backend/src/services -maxdepth 1 -name "*.ts" | wc -l` ≤ 20
- `grep -rl 'fetch.*['"'"'"`]/api/' apps/ValyntApp/src` returns 0 results

**Risk flags:**
- Barrel re-exports may create circular import chains if a moved file imports from the same domain subdir. Contingency: run `pnpm run lint` after each file move; fix circular imports before proceeding.
- `lib/securityHeaders.ts` sends CSP violation reports to `/api/security/csp-violation` — this may be intentionally a raw `fetch` to avoid circular dependency with the auth client. Contingency: if migrating causes a circular import, add it to the ESLint rule's ignore list and document in a comment.

---

## Sprint 29 — `workflow_states` Migration and Agentic Loop Wiring (Weeks 3–4)

**Objective:** `workflow_states` table exists with an active migration. `ValueLifecycleOrchestrator.runHypothesisLoop()` is reachable from a live API route. The DLQ has an admin endpoint. `pnpm test` includes suites for `ValueCaseSaga` and `HypothesisLoop`.

**Success statement:** `POST /api/v1/cases/:caseId/run-loop` triggers `HypothesisLoop` end-to-end. Saga state is persisted to `workflow_states`. Failed steps land in the DLQ. `GET /api/admin/dlq` returns queued entries. `pnpm test` green including new suites.

**Depends on:** Sprint 28 complete.

**Architectural rationale:** `ValueCaseSaga`, `HypothesisLoop`, `IdempotencyGuard`, and `DeadLetterQueue` are fully implemented but unreachable — `ValueLifecycleOrchestrator` is in `post-v1/` and not imported anywhere in the live path, and `workflow_states` has no active migration so `SupabaseSagaPersistence.saveState()` throws at runtime. The implementation work is done; this sprint is purely wiring and the missing DB table.

**Competitor context:** Vivun's deal room and Gainsight's playbook engine both operate on domain-specific state machines reachable from their core API. An implemented but unwired state machine provides no product value.

### KR 29-1 — `workflow_states` migration

**Acceptance criteria:**
- Migration `20260801000000_workflow_states.sql` creates `public.workflow_states`:
  - Columns: `id uuid PK`, `case_id uuid NOT NULL REFERENCES value_cases(id) ON DELETE CASCADE`, `organization_id uuid NOT NULL`, `current_stage text NOT NULL CHECK (current_stage IN ('INITIATED','DRAFTING','VALIDATING','COMPOSING','REFINING','FINALIZED'))`, `status text NOT NULL DEFAULT 'running'`, `state_data jsonb NOT NULL DEFAULT '{}'`, `started_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`
  - Unique constraint on `(case_id, organization_id)` for upsert semantics
  - RLS enabled; four standard policies using `security.user_has_tenant_access`
- Paired rollback `20260801000000_workflow_states.rollback.sql`
- `pnpm run test:rls` green

### KR 29-2 — `POST /api/v1/cases/:caseId/run-loop` endpoint

**Acceptance criteria:**
- Endpoint added to `packages/backend/src/api/valueCases/backHalf.ts`
- Validates `organization_id` from `req.tenantId`; returns 403 if mismatch
- Instantiates `ValueLifecycleOrchestrator` with `SupabaseSagaPersistence`, `DomainSagaEventEmitter`, `SagaAuditTrailLogger`, and `AgentServiceAdapter` (all implemented in `services/workflows/`)
- Calls `orchestrator.runHypothesisLoop(caseId, tenantId, sse)` — streams progress via SSE
- Returns `{ success, finalState, revisionCount, error? }` on completion
- Audit log entry created: `action: 'run_hypothesis_loop'`, `resource_id: caseId`

### KR 29-3 — DLQ admin endpoint

**Ref:** `spec.md` R6; `packages/backend/src/lib/agents/core/DeadLetterQueue.ts`

**Acceptance criteria:**
- `GET /api/admin/dlq` (admin-only, `requirePermission('admin')`) lists DLQ entries from Redis `dlq:agent_tasks`; supports `?limit=` and `?offset=`
- `POST /api/admin/dlq/:taskId/retry` re-queues a DLQ entry
- Both endpoints added to `packages/backend/src/api/admin.ts`
- Integration test: enqueue a DLQ entry → GET returns it → POST retry removes it from the list

### KR 29-4 — Unit tests for `ValueCaseSaga` and `HypothesisLoop`

**Acceptance criteria:**
- `packages/backend/src/lib/agents/core/__tests__/ValueCaseSaga.test.ts`:
  - Valid transitions pass; invalid transitions throw with message listing valid triggers
  - Compensation handlers return `success: true` for each state
  - `initialize()` emits `saga.state.transitioned` event and calls `auditLogger.log`
- `packages/backend/src/lib/agents/orchestration/__tests__/HypothesisLoop.test.ts`:
  - Full loop from `INITIATED` to `FINALIZED` with mocked agents completes successfully
  - Critical objection triggers revision cycle; max 3 cycles enforced
  - Failed step routes to DLQ and returns `success: false`
  - Idempotency key present on every step
- `pnpm test` green for both suites

### KR 29-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green for `workflow_states`
- `pnpm run lint` passes

**Risk flags:**
- `ValueLifecycleOrchestrator` is in `post-v1/` — moving it to the active path requires verifying it is not guarded by a feature flag. Contingency: if it is feature-flagged, enable the flag in the endpoint handler and document the flag name in `debt.md`.
- `AgentServiceAdapter` requires an `LLMGateway` instance. Use the module-level singleton from `lib/agent-fabric/LLMGateway.ts` per ADR-0011.

---

## Sprint 30 — Evidence Tiering Wiring and Provenance API (Weeks 5–6)

**Objective:** `IntegrityAgent` calls `EvidenceTiering` and `ConfidenceScorer` on each claim. `TargetAgent` and `FinancialModelingAgent` write `ProvenanceRecord` entries on every value tree node. `GET /api/v1/cases/:caseId/provenance/:claimId` returns the full lineage chain.

**Success statement:** Running `IntegrityAgent` on a case produces `integrity_outputs` rows where each claim in the `claims` jsonb has `evidence_tier` and `confidence_score` populated by the tiering classes. Running `TargetAgent` produces `ProvenanceRecord` entries in `agent_memory`. The provenance endpoint returns the lineage chain for a claim. `pnpm test` green including new suites.

**Depends on:** Sprint 29 complete.

**Architectural rationale:** `EvidenceTiering`, `ConfidenceScorer`, and `ProvenanceTracker` are fully implemented but not called from any agent. The `integrity_outputs` schema already stores `evidence_tier` and `confidence_score` inside the `claims` jsonb — the tiering classes just need to be the source of those values rather than the agent computing them ad hoc. Provenance has a `SupabaseProvenanceStore` implementation but no API endpoint and no agent write path.

**Competitor context:** Gainsight's health scoring provides confidence indicators at the account level. Claim-level evidence tiering with provenance lineage is a direct differentiator — a CFO can trace every number to its source.

### KR 30-1 — `IntegrityAgent` wired to `EvidenceTiering` and `ConfidenceScorer`

**Ref:** `spec.md` R4; `packages/backend/src/lib/agent-fabric/agents/IntegrityAgent.ts`

**Acceptance criteria:**
- `IntegrityAgent` imports `EvidenceClassifier` from `lib/agents/core/EvidenceTiering.js` and `ConfidenceScorer` from `lib/agents/core/ConfidenceScorer.js`
- For each claim in the LLM response, `EvidenceClassifier.classify()` determines `evidence_tier`; `ConfidenceScorer.compute()` determines `confidence_score`
- Both values written into the `claims` jsonb array alongside existing fields (`claim_id`, `text`, `flagged`, `flag_reason`)
- Unit test: `IntegrityAgent` with mocked LLM response → assert each claim has `evidence_tier` in `[1,2,3]` and `confidence_score` in `[0,1]`
- `pnpm test` green for `IntegrityAgent` suite

### KR 30-2 — `TargetAgent` and `FinancialModelingAgent` write provenance records

**Ref:** `spec.md` R8; `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts`, `FinancialModelingAgent.ts`

**Acceptance criteria:**
- Both agents accept an optional `ProvenanceTracker` via `LifecycleContext` or module-level singleton
- After writing to `value_tree_nodes`, each agent calls `provenanceTracker.record()` with `claimId: nodeId`, `agentId`, `agentVersion`, `evidenceTier`, `confidenceScore`, `formula` (where available)
- Tenant isolation: `ProvenanceTracker` uses `SupabaseProvenanceStore` scoped to `organization_id`
- Unit tests: agent run with mocked `ProvenanceTracker` → assert `record()` called once per node
- `pnpm test` green for both agent suites

### KR 30-3 — `GET /api/v1/cases/:caseId/provenance/:claimId` endpoint

**Ref:** `spec.md` R8

**Acceptance criteria:**
- Endpoint added to `packages/backend/src/api/valueCases/backHalf.ts`
- Validates `organization_id` from `req.tenantId`; returns 403 if mismatch
- Calls `ProvenanceTracker.getLineage(caseId, claimId)`; returns `{ data: ProvenanceChain[] }`
- Returns `{ data: [] }` (not 404) when no records exist for the claim
- Recursion capped at depth 10; response includes `truncated: true` if chain is deeper
- Integration test: write provenance records → GET returns correct chain
- `pnpm test` green; `pnpm run test:rls` green

### KR 30-4 — Tests for `EvidenceTiering`, `ConfidenceScorer`, `ProvenanceTracker`

**Acceptance criteria:**
- `packages/backend/src/lib/agents/core/__tests__/EvidenceTiering.test.ts`: tier classification for known source types; boundary values; unknown source type defaults to Tier 3
- `packages/backend/src/lib/agents/core/__tests__/ConfidenceScorer.test.ts`: score formula; freshness decay; output clamped to [0,1]
- `packages/memory/provenance/__tests__/ProvenanceTracker.test.ts`: `record()` validates schema; `getLineage()` builds chain correctly; append-only (no update path)
- `pnpm test` green for all three suites

### KR 30-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes

**Risk flags:**
- `TargetAgent` and `FinancialModelingAgent` constructors may not accept `ProvenanceTracker` today. Inject via `LifecycleContext` rather than constructor to avoid breaking `AgentFactory`. Contingency: if `LifecycleContext` cannot carry it, use a module-level singleton `getProvenanceTracker()` per ADR-0011.
- `SupabaseProvenanceStore` writes to `agent_memory` with `memory_type: 'provenance'`. Confirm `agent_memory` table exists in active migrations before implementing. If absent, add a migration in this sprint.

---

## Sprint 31 — PPTX Export and ValueCaseCanvas Export Button (Weeks 7–8)

**Objective:** VEs can export a value case as a PPTX presentation from the `ValueCaseCanvas` toolbar. The export endpoint generates slides from live case data. The frontend hook calls the backend endpoint (not the DOM-to-PDF path).

**Success statement:** `POST /api/v1/cases/:caseId/export/pptx` returns a downloadable PPTX file. An "Export" button in `ValueCaseCanvas` triggers the endpoint. `pnpm test` green including `ExportService` unit tests.

**Depends on:** Sprint 30 complete. `NarrativeAgent` and `IntegrityAgent` outputs stable.

**Architectural rationale:** PDF export exists (`PdfExportService`, `POST /api/v1/cases/:id/export/pdf`) but uses Puppeteer to render a page — it requires a running frontend and a valid `renderUrl`. PPTX export reads structured data directly from the DB and generates slides programmatically, making it more reliable in CI and staging environments. The `artifact.ts` comment explicitly notes PPTX is excluded pending a rendering pipeline — this sprint provides that pipeline. The existing `useExport()` hook handles DOM exports only; a new `useCaseExport()` hook is needed for the backend-driven path.

**Competitor context:** Mediafly's content delivery platform is the primary competitor for presentation export. A PPTX that reads live case data (not a screenshot) is more defensible in enterprise sales reviews.

### KR 31-1 — `ExportService` PPTX generation

**Acceptance criteria:**
- `packages/backend/src/services/export/ExportService.ts` created (in the `services/export/` subdir created in Sprint 28 for `PdfExportService`)
- `pptxgenjs` added to `packages/backend/package.json`; license (MIT) verified
- `ExportService.generatePptx(caseId, organizationId)` reads from: `narrative_drafts` (executive summary), `value_tree_nodes` (value tree), `integrity_outputs` (scorecard), `realization_reports` (plan)
- Slide structure: title slide, executive summary, value tree, integrity scorecard, realization plan
- All DB reads include `organization_id` filter (tenant isolation)
- Missing stage data (e.g. no realization report yet) produces a placeholder slide rather than throwing
- Returns `Buffer` (PPTX binary)
- Unit tests: mock DB reads → assert slide count and slide titles match expected structure
- `pnpm test` green for `ExportService` suite

### KR 31-2 — `POST /api/v1/cases/:caseId/export/pptx` endpoint

**Acceptance criteria:**
- Endpoint added to `packages/backend/src/api/valueCases/backHalf.ts`
- Validates `organization_id` from `req.tenantId`; returns 403 if mismatch
- Returns `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation` with `Content-Disposition: attachment; filename="value-case-{caseId}.pptx"`
- Audit log entry on every export: `action: 'export'`, `resource_id: caseId`, `actor_id`, `organization_id`
- Returns 404 with `{ error: 'Case not found' }` if case does not belong to tenant
- Integration test: POST → assert response content-type and non-empty body
- `pnpm test` green

### KR 31-3 — Frontend `useCaseExport` hook and `ValueCaseCanvas` export button

**Acceptance criteria:**
- `apps/ValyntApp/src/hooks/useCaseExport.ts` created: `exportPptx(caseId)` calls `POST /api/v1/cases/:caseId/export/pptx` via `UnifiedApiClient`; triggers browser download on success; exposes `isExporting` and `error` state
- "Export PPTX" button added to `ValueCaseCanvas` toolbar
- Button disabled while `isExporting`; shows error toast on failure
- Uses `UnifiedApiClient` — not raw `fetch()` and not the DOM-to-PDF `useExport()` hook from `utils/export.ts`
- `pnpm test` green for `useCaseExport` suite

### KR 31-4 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- `packages/backend/src/services/export/ExportService.ts` exists and is not a stub
- Regression: `find packages/backend/src/services -maxdepth 1 -name "*.ts" | wc -l` ≤ 20 (Sprint 28 target holds)
- Regression: `grep -rl 'fetch.*['"'"'"`]/api/' apps/ValyntApp/src` returns 0 results (Sprint 28 target holds)

**Risk flags:**
- `pptxgenjs` adds ~2 MB to the backend bundle. Contingency: lazy-import `pptxgenjs` inside `generatePptx()` so it is not loaded at startup.
- `value_tree_nodes` may be empty for cases that have not run `TargetAgent`. Contingency: `ExportService` generates the slide with an "awaiting model data" placeholder rather than throwing.

---

## Cross-Sprint Invariants

Source: `AGENTS.md`. Applies to every PR across all four sprints.

| Rule | Requirement |
|---|---|
| Tenant isolation | Every DB query includes `organization_id` or `tenant_id`. Every memory query includes `{ metadata: { tenant_id: orgId } }`. |
| LLM calls | All production agent LLM calls use `this.secureInvoke()`. No direct `llmGateway.complete()` calls. |
| `service_role` | Used only in AuthService, tenant provisioning, and cron jobs. |
| No cross-tenant transfer | No operation copies, moves, or exports data between tenants. |
| TypeScript strict | No `any`. Use `unknown` + type guards. Replace `any` in every file touched. |
| Named exports | No default exports anywhere. |
| Audit trail | Every create/update/delete/export/approve/reject/grant/revoke action logged with `actor_id`, `organization_id`, `action`, `resource_id`, `timestamp`. |
| Test gates | `pnpm test` and `pnpm run test:rls` must pass before merging any PR. |
| DAG topology | Workflows are DAGs. Cycles are forbidden. Every state mutation has a compensation function. |

---

## Sprint Dependency Chain

```
Sprint 28: Services root cleanup + frontend fetch migration
    ↓ (clean directory; all hooks on UnifiedApiClient)
Sprint 29: workflow_states migration + HypothesisLoop wired to live API + DLQ endpoint + tests
    ↓ (agentic loop reachable and testable end-to-end)
Sprint 30: EvidenceTiering + ConfidenceScorer wired into IntegrityAgent
         + ProvenanceTracker wired into TargetAgent/FinancialModelingAgent
         + provenance API endpoint + tests
    ↓ (every claim has a tier and score; every value tree node has provenance)
Sprint 31: PPTX ExportService + endpoint + ValueCaseCanvas export button
```

Each sprint is independently shippable and must pass `pnpm test` and `pnpm run lint` before the next sprint begins.

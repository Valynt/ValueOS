# Spec Backlog — Unimplemented Work

**Generated:** 2026-07-15  
**Method:** Cross-referenced all spec files, sprint plans, and context layer against codebase state.  
**Sources scanned:** `spec.md`, `spec-auth-hardening.md`, `spec-production-readiness.md`, `refactor-spec.md`, `docs/features/billing-v2-implementation-plan.md`, `docs/sprint-plan-*.md`, `.ona/context/user-stories.md`, `.ona/context/debt.md`

Items marked ✅ were found implemented in the codebase and are excluded. Items below are confirmed open.

---

## Sprint 32 — Auth Hardening (from `spec-auth-hardening.md`)

**Objective:** Clean up dead auth files, add missing test coverage, align role constants.

> AuthCallback already redirects to `/dashboard` (R1 done). Dead files and tests remain. `computePermissions` still maps only `ADMIN`/`ANALYST`.

### R2 — Delete dead auth files

Files confirmed present and unreachable:

| File | Status |
|---|---|
| `apps/ValyntApp/src/app/routes/index.tsx` | Confirm unreachable, delete |
| `apps/ValyntApp/src/pages/auth/LoginPage.tsx` | Confirm unreachable, delete |
| `apps/ValyntApp/src/pages/auth/SignupPage.tsx` | Confirm unreachable, delete |
| `apps/ValyntApp/src/pages/auth/ResetPasswordPage.tsx` | Confirm unreachable, delete |
| `apps/ValyntApp/src/pages/auth/SetupPage.tsx` | Confirm unreachable, delete |
| `apps/ValyntApp/src/pages/auth/index.ts` | Confirm unreachable, delete |
| `apps/ValyntApp/src/views/Auth/SignupPage.tsx` | Confirm unreachable, delete |
| `apps/ValyntApp/src/lib/authPersistence.ts` | Confirm unreachable, delete |
| `apps/ValyntApp/src/lib/sessionManager.ts` | Confirm unreachable, delete |
| `apps/ValyntApp/src/__tests__/useAuth.localstorage.test.tsx` | Delete (tests non-existent hook) |

**Acceptance:** `pnpm run typecheck` passes after deletions.

### R4 — AuthContext unit tests

Create `apps/ValyntApp/src/contexts/__tests__/AuthContext.test.tsx` covering:
- `login` success/error paths
- `signup` with and without session
- `logout` clears state
- `resetPassword`, `signInWithProvider`
- `onAuthStateChange SIGNED_OUT` / `SIGNED_IN`
- `isAuthenticated` true/false

Mock `supabase`, `secureTokenManager`, `analyticsClient`.

### R5 — ProtectedRoute unit tests

Create `apps/ValyntApp/src/app/routes/__tests__/ProtectedRoute.test.tsx`:
- Unauthenticated → redirects to `/login` with `state.from`
- Authenticated → renders `<Outlet />`
- Loading → renders "Authenticating..." without redirect

### R6 — Auth lifecycle integration test

Create `apps/ValyntApp/src/contexts/__tests__/auth.integration.test.tsx`:
- login → `isAuthenticated` true → logout → false
- OAuth callback → session → user state populated
- Expired session → clears optimistic state

Mock `lib/supabase`, `lib/auth/SecureTokenManager`, `lib/env`, `lib/analyticsClient`.

### R7 — Align `computePermissions` role constants

**File:** `apps/ValyntApp/src/types/security.ts`

Current: only maps `ADMIN` and `ANALYST`. Missing all tenant roles and RBAC roles.

Target mapping:

| Role | Permissions |
|---|---|
| `owner` / `ROLE_ADMIN` | `admin`, `read`, `write`, `delete` |
| `admin` / `ROLE_EDITOR` | `read`, `write`, `delete` |
| `member` / `ROLE_OPERATOR` | `read`, `write` |
| `viewer` / `ROLE_AUDITOR` / `ROLE_VIEWER` | `read` |

Legacy `ADMIN` → `owner` equivalent, `ANALYST` → `member` equivalent (keep during transition).

**Acceptance:** `pnpm test` passes; `computePermissions(['owner'])` returns `['admin','read','write','delete']`.

---

## Sprint 33 — Services Cleanup and Frontend Fetch Migration (from `refactor-spec.md` R7–R8, `sprint-plan-28-31-agentic.md` Sprint 28)

**Objective:** `services/` flat root ≤ 20 files. All raw `fetch()` calls to `/api/` migrated. ESLint rule blocks new ones.

> `services/post-v1/` exists. Domain subdirs exist. ~40 files remain at flat root. 8 raw `fetch()` call sites confirmed in `apps/ValyntApp`.

### KR 33-1 — Move remaining V1 services to domain subdirs

Files to move (confirmed at flat root):

- `UnifiedAgentAPI.ts`, `ValueCaseService.ts`, `HypothesisOutputService.ts`, `ValueTreeService.ts`, `ValueCommitmentTrackingService.ts` → `services/value/`
- `PdfExportService.ts` → `services/export/` (create subdir)
- `SemanticMemory.ts`, `VectorSearchService.ts` → `services/memory/`
- `ToolRegistry.ts` → `services/tools/`
- `CircuitBreaker.ts`, `CircuitBreakerManager.ts`, `CircuitBreakerManager.categorized.ts` → `services/agents/resilience/`

Each original path gets a barrel re-export to preserve existing imports.

**Acceptance:** `find packages/backend/src/services -maxdepth 1 -name "*.ts" | wc -l` ≤ 20.

### KR 33-2 — Migrate raw `fetch()` call sites

Confirmed sites:
- `useProjects.ts` (4 calls)
- `useAuditLog.ts`
- `OrganizationUsers.tsx`
- `useOpportunityBrief.ts` (`fetchJSON` wrapper)
- `useWebVitals.ts`, `lib/llm/client.ts`, `lib/securityHeaders.ts` — migrate or document as legitimate exceptions with inline comment

**Acceptance:** `grep -rl 'fetch.*["`'"'"']/api/' apps/ValyntApp/src` returns 0 results (or only documented exceptions).

### KR 33-3 — ESLint rule blocking new raw `fetch()` calls

Add rule to `apps/ValyntApp` ESLint config flagging `fetch(` where URL starts with `/api/`. Error severity. Scoped to `src/hooks/`, `src/views/`, `src/features/`.

### KR 33-4 — Delete `CacheService.ts` (refactor-spec.md R6)

- Audit `CacheService` usage in `UnifiedAgentAPI` and `CanvasSchemaService`
- Port required features (pattern invalidation, dependency tracking) to `ReadThroughCacheService`
- Migrate callers
- Delete `packages/backend/src/services/CacheService.ts`

**Acceptance:** File does not exist; `pnpm test` passes.

---

## Sprint 34 — Agentic Loop Wiring (from `sprint-plan-28-31-agentic.md` Sprint 29)

**Objective:** `workflow_states` table exists. `HypothesisLoop` reachable from a live API route. DLQ has an admin endpoint. Tests for `ValueCaseSaga` and `HypothesisLoop`.

> `ValueCaseSaga`, `HypothesisLoop`, `DeadLetterQueue` are implemented. `workflow_states` migration is missing. `ValueLifecycleOrchestrator.runHypothesisLoop()` exists in `post-v1/` but is not wired to any route. No DLQ admin endpoint. No unit tests for `ValueCaseSaga` or `HypothesisLoop`.

### KR 34-1 — `workflow_states` migration

**File:** `infra/supabase/supabase/migrations/20260901000000_workflow_states.sql`

```sql
CREATE TABLE public.workflow_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  current_stage text NOT NULL CHECK (current_stage IN (
    'INITIATED','DRAFTING','VALIDATING','COMPOSING','REFINING','FINALIZED'
  )),
  status text NOT NULL DEFAULT 'running',
  state_data jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, organization_id)
);
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;
```

Four standard RLS policies using `security.user_has_tenant_access`. Paired rollback file.

**Acceptance:** `pnpm run test:rls` green.

### KR 34-2 — `POST /api/v1/cases/:caseId/run-loop` endpoint

**File:** `packages/backend/src/api/valueCases/backHalf.ts`

- Validates `organization_id` from `req.tenantId`; returns 403 on mismatch
- Instantiates `ValueLifecycleOrchestrator` with `SupabaseSagaPersistence`, `DomainSagaEventEmitter`, `SagaAuditTrailLogger`, `AgentServiceAdapter`
- Calls `orchestrator.runHypothesisLoop(caseId, tenantId, sse)` — streams progress via SSE
- Returns `{ success, finalState, revisionCount, error? }`
- Audit log entry: `action: 'run_hypothesis_loop'`, `resource_id: caseId`

### KR 34-3 — DLQ admin endpoints

**File:** `packages/backend/src/api/admin.ts`

- `GET /api/admin/dlq` — lists entries from Redis `dlq:agent_tasks`; `?limit=` and `?offset=`; requires `requirePermission('admin')`
- `POST /api/admin/dlq/:taskId/retry` — re-queues entry
- Integration test: enqueue → GET returns it → POST retry removes it

### KR 34-4 — Unit tests for `ValueCaseSaga` and `HypothesisLoop`

**Files:**
- `packages/backend/src/lib/agents/core/__tests__/ValueCaseSaga.test.ts`
  - Valid transitions pass; invalid throw with valid-triggers message
  - Compensation handlers return `success: true`
  - `initialize()` emits `saga.state.transitioned` and calls `auditLogger.log`
- `packages/backend/src/lib/agents/orchestration/__tests__/HypothesisLoop.test.ts`
  - Full loop `INITIATED` → `FINALIZED` with mocked agents
  - Critical objection triggers revision; max 3 cycles enforced
  - Failed step routes to DLQ; returns `success: false`
  - Idempotency key present on every step

---

## Sprint 35 — Evidence Tiering and Provenance Wiring (from `sprint-plan-28-31-agentic.md` Sprint 30)

**Objective:** `IntegrityAgent` uses `EvidenceTiering`/`ConfidenceScorer`. `TargetAgent` and `FinancialModelingAgent` write provenance records. Provenance API endpoint live.

> `EvidenceTiering.ts`, `ConfidenceScorer.ts`, and `packages/memory/provenance/index.ts` all exist. None are called from any agent. No provenance API endpoint exists.

### KR 35-1 — Wire `EvidenceTiering` and `ConfidenceScorer` into `IntegrityAgent`

**File:** `packages/backend/src/lib/agent-fabric/agents/IntegrityAgent.ts`

- Import `EvidenceClassifier` from `lib/agents/core/EvidenceTiering`
- Import `ConfidenceScorer` from `lib/agents/core/ConfidenceScorer`
- For each claim in LLM response: call `EvidenceClassifier.classify()` → `evidence_tier`; call `ConfidenceScorer.compute()` → `confidence_score`
- Write both into the `claims` jsonb array alongside existing fields
- Unit test: mocked LLM response → each claim has `evidence_tier` in `[1,2,3]` and `confidence_score` in `[0,1]`

### KR 35-2 — Wire `ProvenanceTracker` into `TargetAgent` and `FinancialModelingAgent`

**Files:** `TargetAgent.ts`, `FinancialModelingAgent.ts`

- After writing to `value_tree_nodes`, call `provenanceTracker.record()` with `claimId: nodeId`, `agentId`, `agentVersion`, `evidenceTier`, `confidenceScore`, `formula`
- Inject via `LifecycleContext` or module-level singleton per ADR-0011
- Tenant isolation: `SupabaseProvenanceStore` scoped to `organization_id`
- Unit tests: agent run with mocked `ProvenanceTracker` → `record()` called once per node

### KR 35-3 — `GET /api/v1/cases/:caseId/provenance/:claimId`

**File:** `packages/backend/src/api/valueCases/backHalf.ts`

- Validates `organization_id` from `req.tenantId`; returns 403 on mismatch
- Calls `ProvenanceTracker.getLineage(caseId, claimId)`
- Returns `{ data: ProvenanceChain[] }` or `{ data: [] }` (not 404) when empty
- Recursion capped at depth 10; `truncated: true` if deeper
- Integration test: write records → GET returns correct chain

### KR 35-4 — Tests for `EvidenceTiering`, `ConfidenceScorer`, `ProvenanceTracker`

- `lib/agents/core/__tests__/EvidenceTiering.test.ts`: tier classification; boundary values; unknown source → Tier 3
- `lib/agents/core/__tests__/ConfidenceScorer.test.ts`: score formula; freshness decay; output clamped to `[0,1]`
- `packages/memory/provenance/__tests__/ProvenanceTracker.test.ts`: `record()` validates schema; `getLineage()` builds chain; append-only

---

## Sprint 36 — PPTX Export (from `sprint-plan-28-31-agentic.md` Sprint 31)

**Objective:** VEs can export a value case as PPTX from the `ValueCaseCanvas` toolbar.

> PDF export exists (`PdfExportService`, `POST /api/v1/cases/:id/export/pdf`). PPTX export does not exist anywhere in the codebase.

### KR 36-1 — `ExportService` PPTX generation

**File:** `packages/backend/src/services/export/ExportService.ts`

- Add `pptxgenjs` to `packages/backend/package.json` (MIT license)
- `generatePptx(caseId, organizationId)` reads from: `narrative_drafts`, `value_tree_nodes`, `integrity_outputs`, `realization_reports`
- Slide structure: title, executive summary, value tree, integrity scorecard, realization plan
- All DB reads include `organization_id` filter
- Missing stage data → placeholder slide (no throw)
- Returns `Buffer`
- Unit tests: mock DB reads → assert slide count and titles

### KR 36-2 — `POST /api/v1/cases/:caseId/export/pptx`

**File:** `packages/backend/src/api/valueCases/backHalf.ts`

- Validates `organization_id`; returns 403 on mismatch
- `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `Content-Disposition: attachment; filename="value-case-{caseId}.pptx"`
- Audit log: `action: 'export'`, `resource_id: caseId`
- Returns 404 if case not found for tenant

### KR 36-3 — Frontend `useCaseExport` hook and export button

**Files:** `apps/ValyntApp/src/hooks/useCaseExport.ts`, `ValueCaseCanvas.tsx`

- `exportPptx(caseId)` calls `POST /api/v1/cases/:caseId/export/pptx` via `UnifiedApiClient`; triggers browser download
- Exposes `isExporting` and `error` state
- "Export PPTX" button in `ValueCaseCanvas` toolbar; disabled while exporting; error toast on failure
- Must use `UnifiedApiClient` — not raw `fetch()`, not `useExport()` from `utils/export.ts`

---

## Sprint 37 — Production Readiness: P0 and P1 Tasks (from `spec-production-readiness.md`)

**Objective:** Close remaining launch-blocking and high-priority production readiness gaps.

> TASK-001 (`versioning.ts`) is already fixed. TASK-003/004/005 are verified-only tasks. TASK-010/011 are resolved per `debt.md`. Items below are confirmed open.

### TASK-002 — MFA env-var enforcement

**Files:** `packages/backend/src/config/environment.ts`, `packages/backend/src/services/AuthService.ts`, `.env.example`, `DEPLOY.md`

- Startup assertion: if `NODE_ENV === 'production'` and `MFA_ENABLED !== 'true'`, emit `WARN` and surface in health check
- Document `MFA_ENABLED=true` as required in `.env.example` and `DEPLOY.md`

### TASK-007 — Un-skip `TEST-E2E-CRITICAL-003`

**File:** `tests/e2e/critical-user-flow.spec.ts` line 149

- Implement using `page.route('/api/**', route => route.fulfill({ status: 500 }))` to simulate API failure
- Assert error state UI shown; assert retry works
- Remove `test.skip()` and remove R1-SKIP-002 from `config/release-risk/release-1.0-skip-waivers.json`

### TASK-008 — Tenant isolation in `getBenchmarks()` and `getOntologyStats()`

**File:** `packages/backend/src/services/ValueFabricService.ts`

- Confirm no frontend caller invokes these without `organizationId`
- Fix any call sites that omit tenant scoping
- Unit tests asserting cross-tenant reads return empty

### TASK-012 — Raise CI coverage thresholds

**File:** `ci.yml` / `quality-baselines.json`

Current: lines=60, functions=50, branches=50, statements=60.  
Target: lines=75, functions=70, branches=70, statements=75.

- Run suite to confirm actual coverage before raising
- Update `quality-baselines.json`

### TASK-013 — Remove `console.log` from backend production code

- Replace all `console.log` in `packages/backend/src` (non-test) with `logger`
- Enable ESLint `no-console` rule for `packages/backend/src`

### TASK-015 — Database backup and PITR documentation

**File to create:** `docs/operations/backup-and-recovery.md`

- Schedule, retention policy, PITR window, restore procedure, RTO ≤4h / RPO ≤1h
- Link from `docs/operations/README.md`

### TASK-017 — Load test baselines

**Files to create:** `tests/load/` or `scripts/load/`

- k6 or autocannon scripts for `POST /api/llm` and `POST /api/v1/cases`
- 50 concurrent users, 5 minutes against staging
- Record p50/p95/p99 and error rate in `docs/operations/load-test-baselines.md`

### TASK-018 — Chaos tests for DB and Redis failure

**Files to create:** `tests/chaos/`

- Postgres connection failure → structured error (not 500 stack trace)
- Redis unavailability → BullMQ jobs not silently dropped
- `README` explaining how to run

### TASK-019 — Rollback scripts for release-critical migrations

- Identify migrations since `20260101000000` touching `value_cases`, `workflow_states`, `agent_runs`, `organizations`, `users` that lack rollback scripts
- Write paired `.rollback.sql` files
- CI check: new migration without rollback fails build

### TASK-020 — HPA scale-down window

**File:** `infra/k8s/base/worker-hpa.yaml`

- Change `scaleDown.stabilizationWindowSeconds` from 300 to 150
- Add comment: BullMQ jobs take up to 3 min; 150s gives 50% buffer

### TASK-023 — Expand OpenAPI spec

**File:** `packages/backend/openapi.yaml`

Currently covers only `/api/v1/projects`. Add path definitions for: cases, agents, workflows, auth, value-fabric, integrity, narrative, realization, expansion.

### TASK-024 — ADRs for undocumented decisions

**Directory:** `docs/engineering/adr/`

Three ADRs needed (ADR-0015/0016/0017 exist; these are the remaining gaps):
1. CI security gate design (guard scripts, waiver system) — if not already covered by ADR-0016
2. Service de-duplication approach — if not already covered by ADR-0017
3. Any remaining undocumented decisions from `decisions.md` marked as gaps

Update `decisions.md` with digest entries.

### TASK-025 — SLO/SLI documentation and alerting rules

**Files to create:** `docs/operations/slo-sli.md`, `infra/k8s/monitoring/slo-alerts.yaml`

- SLOs: API availability 99.9%, case creation p95 ≤2s, agent invocation p95 ≤10s
- Map each to a Prometheus metric (SLI)
- At least one alerting rule firing on SLO burn rate

---

## Sprint 38 — RBAC Runbook and Remaining Infrastructure (from `sprint-plan-24-27.md`)

**Objective:** RBAC degraded-security runbook exists. Worker HPA is documented.

> `partition-maintenance.md` exists. `rbac-redis-unavailable.md` does not exist. Worker HPA config exists but is undocumented.

### KR 38-1 — RBAC degraded-security runbook

**File to create:** `docs/runbooks/rbac-redis-unavailable.md`

- Detection: `rbac_redis_unavailable_total` counter; alert after 5 min sustained increments
- Diagnosis: check Redis connectivity; check `rbacInvalidation.ts` logs
- Impact: stale permissions possible for up to `RBAC_CACHE_TTL_SECONDS` (default 300s)
- Remediation A: restore Redis
- Remediation B: set `RBAC_CACHE_TTL_SECONDS=0` (performance cost documented)
- Escalation: restart instances after 15 min if unresolved
- Document `RBAC_CACHE_TTL_SECONDS` in `.env.example`

### KR 38-2 — Worker HPA documentation

**File:** `docs/operations/deployment-guide.md`

- Document HPA scaling behavior: `minReplicas: 2`, `maxReplicas: 12`, queue-depth metrics
- Confirm `prometheus-adapter-rules.yaml` exposes both BullMQ queue metrics

---

## Sprint 39 — Tenant Onboarding UI (from `user-stories.md` US-007)

**Objective:** Admin can provide company context once; all future cases are pre-seeded with it.

> `TenantContextIngestionService` exists with Zod-validated input and tenant-scoped memory storage. The onboarding UI and `POST /api/v1/tenant/context` endpoint are missing.

### KR 39-1 — `POST /api/v1/tenant/context` endpoint

- Accepts: company website URL, product docs, ICP definitions, competitor list
- Calls `TenantContextIngestionService.ingest(tenantId, payload)`
- Validates `organization_id` from `req.tenantId`
- Returns `{ success, memoryEntriesCreated }`
- Audit log: `action: 'tenant_context_updated'`

### KR 39-2 — Tenant onboarding UI

- Admin settings page section: "Company Context"
- Fields: website URL, product docs upload/link, ICP definitions, competitor list
- Calls `POST /api/v1/tenant/context` on submit
- Shows last-updated timestamp and entry count
- Empty state with prompt to configure

---

## Sprint 40 — Billing V2 Phase 3: Enterprise and Reconciliation (from `billing-v2-implementation-plan.md`)

**Objective:** Custom pricing per tenant, temporary cap increase workflows, finance export endpoints.

> Billing V2 Phases 0–2 are implemented (services, enforcement, invoice engine, Stripe mirroring all confirmed present). Phase 3 is not started.

### 3.1 — Custom pricing per tenant

- `billing_overrides` table for temporary cap increases
- Contract mode: custom `billing_price_versions` per tenant
- Migration + RLS

### 3.2 — Temporary cap increase approval workflow

- Approval-gated temporary cap increases with `effective_end`
- Wired to existing `BillingApprovalService`

### 3.3 — Finance reconciliation exports

- Reconciliation dashboard data endpoints
- Export format: CSV or JSON with period, tenant, meter, usage, billed amount

---

## Deferred (explicit product decisions pending)

These items appear in specs but are blocked on non-engineering decisions. Do not schedule until unblocked.

| Item | Source | Blocker |
|---|---|---|
| Salesforce OAuth adapter | `user-stories.md` US-008 | OAuth scope decision pending |
| ServiceNow / Slack / SharePoint adapters | `debt.md` DEBT-008 | Product decision pending (note: `debt.md` marks these resolved — verify actual state before scheduling) |
| SandboxedExecutor E2B SDK | `debt.md` DEBT-011 | Product decision pending |
| VOSAcademy content loader | `debt.md` DEBT-012 | Content strategy pending |
| Kafka rollout | Multiple sprint plans | Infrastructure decision pending |
| `DeviceFingerprintService` GeoIP / threat intelligence | Sprint 24–27 deferred list | Product decision pending |
| `EnhancedParallelExecutor` WebSocket progress | Sprint 24–27 deferred list | Product decision pending |
| ADR-0005 Theme Precedence | `decisions.md` | Proposed, not accepted |
| DR drill execution | TASK-016 | Requires staging environment access |
| Production launch checklist execution | TASK-021 | Requires production credentials |

---

## TypeScript `any` Burn-Down (ongoing, not sprint-gated)

Targets from `debt.md` (post-Sprint 28 baseline):

| Module | Baseline | Target |
|---|---|---|
| `packages/backend` | 810 | < 700 by Sprint 31 |
| `apps/ValyntApp` | 409 | < 100 |
| `packages/sdui` | 221 | < 20 |
| `apps/VOSAcademy` | 99 | < 50 |
| `packages/mcp` | 0 | maintain 0 |

**Rule:** Re-measure with grep before scheduling. Do not trust table values as current.

```bash
grep -rnE ":[[:space:]]*\bany\b|as[[:space:]]+\bany\b|<any>" <path> \
  --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__\|\.test\.\|\.spec\." | wc -l
```

Highest-density files to target first:
- `apps/ValyntApp/src/mcp-ground-truth/core/IntegratedMCPServer.ts` (39)
- `packages/sdui/src/engine/renderPage.ts` (16), `realtime/WebSocketDataSource.ts` (14), `DataBindingResolver.ts` (14)
- `services/post-v1/PlaygroundAutoSave.ts` (13), `services/post-v1/OfflineEvaluation.ts` (13)
- `apps/VOSAcademy/src/lib/icons.tsx` (40), `data/routers.d.ts` (18)

---

## Sprint Dependency Chain

```
Sprint 32: Auth hardening (dead files, tests, role constants)
Sprint 33: Services cleanup + frontend fetch migration + CacheService deletion
Sprint 34: workflow_states migration + HypothesisLoop wired + DLQ endpoint + tests
Sprint 35: EvidenceTiering/ConfidenceScorer wired + ProvenanceTracker wired + provenance API
Sprint 36: PPTX ExportService + endpoint + ValueCaseCanvas export button
Sprint 37: Production readiness P0/P1 (MFA, E2E test, coverage, load tests, chaos tests, OpenAPI, SLOs)
Sprint 38: RBAC runbook + worker HPA docs
Sprint 39: Tenant onboarding UI (US-007)
Sprint 40: Billing V2 Phase 3 (custom pricing, reconciliation)
```

Sprints 32–36 are sequentially dependent on each other only where noted. Sprints 37–40 can run in parallel with 34–36 if capacity allows.

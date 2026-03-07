# Sprint Roadmap — Agentic Value-Case Workflow: Demo to Real

---

## Sprint 4 (Weeks 7–8): Complete the Core Path

**Goal:** A user can create a case, run the core agent flow without Kafka, persist value tree and financial model output, open ModelStage and see real stored data, refresh and still see the same result.

**Sprint success statement:**
> "We can create a case, run the core agentic path without Kafka, persist generated value drivers and financial results, load them into the model stage, and recover them after refresh. This is a real workflow, not a mock."

---

### Problem Statement

Sprint 1–2 wired the Hypothesis stage and ModelStage UI to real APIs, but ModelStage always shows an empty state because no agent ever writes to `value_tree_nodes` or `financial_model_snapshots`. Two gaps remain:

1. **TargetAgent** produces a `value_driver_tree` in memory but never persists it to `value_tree_nodes`.
2. **FinancialModelingAgent** computes ROI/NPV/payback but never writes to `financial_model_snapshots`.
3. **Agent invoke endpoint** returns 503 in any environment without Kafka — making "Run Stage" non-functional in dev/staging.

---

### Non-Goals for This Sprint

- IntegrityStage, NarrativeStage, RealizationStage end-to-end wiring
- NarrativeAgent implementation
- Export generation or version history
- Kafka rollout or replacement
- Performance tuning
- Agent architecture redesign

---

### PR-01 — Schema: value_tree_nodes and financial_model_snapshots

**Goal:** Durable schema for the core persistence path.

**Changes:**
- Add `value_tree_nodes` table with columns: `id`, `tenant_id`, `case_id`, `parent_node_id`, `node_key`, `label`, `description`, `driver_type`, `impact_estimate`, `confidence`, `sort_order`, `source_agent`, `metadata_json`, `created_at`, `updated_at`
- Add `financial_model_snapshots` table with columns: `id`, `tenant_id`, `case_id`, `snapshot_version`, `roi`, `npv`, `payback_period_months`, `assumptions_json`, `outputs_json`, `source_agent`, `created_at`
- Indexes on `(case_id, tenant_id)` for both tables
- RLS policies using `security.user_has_tenant_access()` consistent with existing tenant model
- Paired rollback SQL

**Files:** `infra/supabase/supabase/migrations/20260317000000_value_tree_and_model_snapshots.sql`, rollback file

**Acceptance criteria:**
- [ ] Migration applies cleanly against local Supabase
- [ ] RLS blocks cross-tenant reads and writes
- [ ] Rollback script restores prior state
- [ ] `pnpm run test:rls` passes

---

### PR-02 — Backend: ValueTreeRepository

**Goal:** Clean persistence layer so agents don't write raw SQL inline.

**Changes:**
- Add `packages/backend/src/repositories/ValueTreeRepository.ts`
- Methods: `replaceNodesForCase(caseId, tenantId, nodes[])`, `getNodesForCase(caseId, tenantId)`, `deleteNodesForCase(caseId, tenantId)`
- Replace semantics: a new agent run replaces all generated nodes for the case
- All writes scoped by `tenant_id` and `case_id`
- Parent/child relationships preserved via `parent_node_id`
- Co-located unit test

**Files:** `packages/backend/src/repositories/ValueTreeRepository.ts`, `ValueTreeRepository.test.ts`

**Acceptance criteria:**
- [ ] Can write a full tree and read it back in sort order
- [ ] Replace semantics are deterministic (old nodes deleted, new nodes inserted atomically)
- [ ] Tenant isolation enforced — cross-tenant read returns empty

---

### PR-03 — Backend: FinancialModelSnapshotRepository

**Goal:** Append-only snapshot store for financial model outputs.

**Changes:**
- Add `packages/backend/src/repositories/FinancialModelSnapshotRepository.ts`
- Methods: `createSnapshot(caseId, tenantId, payload)`, `getLatestSnapshotForCase(caseId, tenantId)`, `listSnapshotsForCase(caseId, tenantId)`
- Snapshot creation is append-only; historical snapshots remain intact
- `snapshot_version` auto-incremented per case
- Co-located unit test

**Files:** `packages/backend/src/repositories/FinancialModelSnapshotRepository.ts`, `FinancialModelSnapshotRepository.test.ts`

**Acceptance criteria:**
- [ ] Can create and fetch latest snapshot
- [ ] Historical snapshots are not overwritten
- [ ] Tenant scoping enforced

---

### PR-04 — Backend: TargetAgent persists value_tree_nodes

**Goal:** Move TargetAgent from in-memory output to durable output.

**Changes:**
- After `storeTargetsInMemory`, call `ValueTreeRepository.replaceNodesForCase` with the `value_driver_tree` output
- Map `ValueDriverSchema` fields to `value_tree_nodes` columns (`node_key`, `label`, `driver_type`, `impact_estimate`, `confidence`, `sort_order`, `source_agent: "TargetAgent"`)
- Require `case_id` and `tenant_id` from context; skip persistence with a warning log if absent
- Add structured audit log entry on success/failure

**Files:** `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts`

**Acceptance criteria:**
- [ ] Running TargetAgent writes nodes to `value_tree_nodes`
- [ ] Re-running replaces prior nodes for the same case
- [ ] Audit log records the write with `case_id`, `tenant_id`, node count
- [ ] Missing context skips persistence without throwing

---

### PR-05 — Backend: FinancialModelingAgent persists financial_model_snapshots

**Goal:** Make financial calculations durable and reloadable.

**Changes:**
- After `storeModelsInMemory`, call `FinancialModelSnapshotRepository.createSnapshot` with computed ROI, NPV, payback period, assumptions, and full output payload
- Store `key_assumptions` in `assumptions_json`, full `result` in `outputs_json`
- Set `source_agent: "FinancialModelingAgent"`
- Add structured audit log entry on success/failure

**Files:** `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts`

**Acceptance criteria:**
- [ ] Running FinancialModelingAgent creates a snapshot row
- [ ] Latest snapshot retrievable by case
- [ ] Refreshing the UI loads the same values from persistence

---

### PR-06 — Backend: Direct execution fallback for agent invoke endpoint

**Goal:** Make the core path runnable without Kafka.

**Changes:**
- In `POST /api/agents/:agentId/invoke`: when `isKafkaEnabled()` is false, execute the agent directly via `UnifiedAgentOrchestrator` (or `AgentFactory` + agent `.execute()`) instead of returning 503
- Return a consistent response shape in both paths:
  ```ts
  {
    mode: "async" | "direct",
    jobId: string,        // correlationId for async; generated uuid for direct
    status: "queued" | "completed" | "failed",
    resultPreview?: unknown,
    error?: string,
  }
  ```
- Keep existing Kafka path intact and unchanged
- Direct execution is synchronous; response includes `status: "completed"` and `resultPreview` on success

**Files:** `packages/backend/src/api/agents.ts`, shared API types

**Acceptance criteria:**
- [ ] In non-Kafka env, invoke endpoint executes and returns `status: "completed"`
- [ ] In Kafka env, existing queue/job behavior unchanged
- [ ] Response contract is identical shape in both modes
- [ ] `pnpm run typecheck` passes

---

### PR-07 — Backend: Read APIs for value tree and latest model snapshot

**Goal:** Give the frontend a real source of truth for ModelStage.

**Changes:**
- `GET /api/v1/value-cases/:caseId/value-tree` — already exists; verify it reads from `value_tree_nodes` (not the legacy `ValueTreeService`)
- `GET /api/v1/value-cases/:caseId/model-snapshots/latest` — new endpoint returning latest `financial_model_snapshots` row or `{ data: null }` if none
- Both validate tenant access via `req.tenantId`
- Return explicit empty responses (`[]` / `null`) when no data exists

**Files:** `packages/backend/src/api/valueCases/index.ts`

**Acceptance criteria:**
- [ ] Endpoints return persisted data only — no fabricated fallbacks
- [ ] Empty state responses are `{ data: null }` or `{ data: [] }`, not errors
- [ ] Cross-tenant access returns 401/403

---

### PR-08 — Frontend: useLatestModelSnapshot hook + ModelStage financial panel

**Goal:** ModelStage renders real financial model data when available.

**Changes:**
- Add `apps/ValyntApp/src/hooks/useModelSnapshot.ts` — `useLatestModelSnapshot(caseId)` fetches `GET /api/v1/value-cases/:caseId/model-snapshots/latest`
- Add financial summary panel to ModelStage: ROI, NPV, payback period loaded from snapshot
- Show empty state ("Run the Target and Financial Modeling agents to generate a model") when snapshot is null
- No hardcoded financial figures anywhere in ModelStage

**Files:** `apps/ValyntApp/src/hooks/useModelSnapshot.ts`, `apps/ValyntApp/src/views/canvas/ModelStage.tsx`

**Acceptance criteria:**
- [ ] Fresh case shows truthful empty state
- [ ] Case with snapshot renders real ROI/NPV/payback
- [ ] Refresh preserves data
- [ ] No inline hardcoded model arrays remain

---

### PR-09 — Frontend: Run Stage wiring for Target + Financial Modeling flow

**Goal:** "Run Stage" in ModelStage triggers the real agent chain.

**Changes:**
- Add "Run Model" button to ModelStage that POSTs to `/api/agents/target/invoke` then `/api/agents/financial-modeling/invoke`
- Handle `mode: "direct"` (immediate completion) and `mode: "async"` (poll via `useAgentJob`) from PR-06 response contract
- On completion, invalidate `useValueTree` and `useLatestModelSnapshot` queries
- Show loading/running/completed/failed states truthfully — no simulated progress

**Files:** `apps/ValyntApp/src/views/canvas/ModelStage.tsx`, `apps/ValyntApp/src/hooks/useValueTree.ts`

**Acceptance criteria:**
- [ ] Button triggers real backend invocation
- [ ] Direct mode: UI updates immediately after response
- [ ] Async mode: UI polls and updates on completion
- [ ] No hardcoded success path

---

### PR-10 — Frontend: Truthful AgentThread status for direct and async modes

**Goal:** AgentThread reflects the PR-06 unified response contract.

**Changes:**
- Update `useAgentJob` to handle `mode: "direct"` responses (no polling needed — result is in the initial response)
- Update AgentThread to show `mode` label: "Direct execution" vs "Queued (async)"
- Remove any remaining simulated orchestration state

**Files:** `apps/ValyntApp/src/hooks/useAgentJob.ts`, `apps/ValyntApp/src/views/canvas/AgentThread.tsx`

**Acceptance criteria:**
- [ ] Direct mode shows completion immediately without polling
- [ ] Async mode polls until terminal state
- [ ] Status is always one of: queued, running, completed, failed, streaming-unavailable
- [ ] No simulated live streaming

---

### PR-11 — Integration tests: core persistence path

**Goal:** Prove the feature is real, not just wired optimistically.

**Changes:**
- Backend integration tests (Vitest):
  - invoke TargetAgent directly → assert `value_tree_nodes` rows exist for case
  - invoke FinancialModelingAgent directly → assert `financial_model_snapshots` row exists
  - GET value-tree endpoint → returns persisted nodes
  - GET model-snapshots/latest → returns persisted snapshot
  - Cross-tenant read → returns empty/403
- Frontend: update existing `ModelStage` tests to assert empty state when no data, real data when nodes/snapshot present

**Files:** `packages/backend/src/api/valueCases/__tests__/`, `packages/backend/src/lib/agent-fabric/agents/__tests__/`

**Acceptance criteria:**
- [ ] Tests fail if persistence breaks
- [ ] Tests fail if non-Kafka invoke path regresses
- [ ] Tests prove refresh survival (write → read → same data)
- [ ] `pnpm test` passes

---

### PR-12 — Logging and audit events for the core path

**Goal:** Make failures diagnosable without full observability infrastructure.

**Changes:**
Log the following events with `correlation_id`, `case_id`, `tenant_id`:
- Agent invoke requested (mode selected: async/direct)
- TargetAgent persisted value tree (node count)
- FinancialModelingAgent persisted snapshot (ROI, NPV)
- Read endpoints served empty vs populated result
- Any persistence failure with error message

**Files:** `packages/backend/src/api/agents.ts`, `TargetAgent.ts`, `FinancialModelingAgent.ts`, repository write points

**Acceptance criteria:**
- [ ] A failed run can be traced in logs by `correlation_id`
- [ ] A successful run leaves a durable audit trail entry
- [ ] No PII logged

---

### Implementation Order

```
PR-01  schema
PR-02  ValueTreeRepository
PR-03  FinancialModelSnapshotRepository
PR-06  direct invoke fallback
PR-04  TargetAgent persistence
PR-05  FinancialModelingAgent persistence
PR-07  read APIs
PR-08  useModelSnapshot + ModelStage financial panel
PR-09  Run Stage wiring
PR-10  truthful AgentThread status
PR-11  integration tests
PR-12  logging/audit
```

---

### Sprint 4 Acceptance Criteria (end-to-end)

| # | Criterion | Verified by |
|---|---|---|
| S4-1 | Create case → run Target agent → `value_tree_nodes` rows exist | DB query after run |
| S4-2 | Run Financial Modeling agent → `financial_model_snapshots` row exists | DB query after run |
| S4-3 | ModelStage loads real value tree from API | Network tab: GET /value-tree returns rows |
| S4-4 | ModelStage loads real financial snapshot | Network tab: GET /model-snapshots/latest returns data |
| S4-5 | Refresh page → same data still present | Manual: reload, data unchanged |
| S4-6 | Run Stage works without Kafka (`KAFKA_ENABLED=false`) | Local dev: invoke returns `status: "completed"` |
| S4-7 | AgentThread shows truthful status in both modes | No simulated steps; mode label visible |
| S4-8 | No hardcoded model data in ModelStage | Code review: no inline arrays |
| S4-9 | `pnpm test` passes | CI green |
| S4-10 | `pnpm run test:rls` passes for new tables | CI green |

---

**Theme:** Make the agentic value-case workflow real end-to-end  
**Principle:** Smallest set of changes that transforms the product from demo-grade to real system behavior. A feature is *real* when: UI action → API call → backend execution → persistence → UI reflects result.  
**Cadence:** 2-week sprints  
**Success signal:** Production-credible for paying customers

---

## Problem Statement

ValueOS presents a polished agentic workspace to users. The backend has real agent implementations (OpportunityAgent, TargetAgent, FinancialModelingAgent), real Supabase schema, and a working UnifiedAgentOrchestrator. However, the connection between frontend and backend is systematically absent across the product's most prominent surface — the ValueCaseCanvas.

Specific failures confirmed by audit:

- Every canvas stage component (HypothesisStage, ModelStage, IntegrityStage, NarrativeStage, RealizationStage) uses hardcoded `const` data. No API call is made.
- The "Run Stage" button in ValueCaseCanvas has no `onClick` handler.
- `onSave` callbacks in ModelStage are `() => {}` no-ops — edits are lost on reload.
- `AgentThread.tsx` shows 6 static hardcoded steps; no WebSocket or SSE connection exists.
- `workflow_checkpoints` table does not exist in any active migration, yet `HumanCheckpointService` writes to it.
- `value_tree`, `financial_model`, `claims`, `integrity_results`, `value_case_versions` tables are absent from active migrations (exist only in archived monolith schema).
- The Dashboard QuickStart "Go" button has no `onClick` handler.
- `researchWorker.ts` has a duplicate `const logger` declaration — a compile error preventing the worker from starting.

This sprint focuses on the **core path**: Create Case → Hypothesis Agent runs → Results persisted → Model stage loads those results → User edits assumptions → Model recalculates → Results persist.

---

## Scope

### In scope (Sprint 1 + Sprint 2)

| Area | What becomes real |
|---|---|
| Case creation | Dashboard QuickStart "Go" button wired to `useCreateCase` |
| Hypothesis stage | "Run Stage" invokes OpportunityAgent via `/api/agents/:id/invoke`; results stored and loaded |
| Model stage | TargetAgent/FinancialModelingAgent output populates value tree; edits persist via API |
| Agent streaming | AgentThread connects to real SSE/WebSocket stream from backend |
| Schema | Missing tables (`value_tree_nodes`, `financial_model_snapshots`, `workflow_checkpoints`) added as migrations |
| Worker fix | `researchWorker.ts` duplicate logger declaration removed |

### Out of scope for this sprint

- IntegrityStage, NarrativeStage, RealizationStage wiring (incremental after core path proven)
- CRM integration, version history, evidence drawer
- Performance optimizations (DB indexes, Redis cache, HPA) — addressed in Sprint 3
- Audit trail route registration
- Settings persistence

---

## Requirements

### R1 — Case Creation Entry Point

The Dashboard QuickStart input + "Go" button must call `useCreateCase()` and navigate to the new case on success. The Opportunities page path already works; the Dashboard path must match it.

### R2 — Hypothesis Stage: Agent Invocation

Clicking "Run Stage" in HypothesisStage must:
1. POST to `/api/agents/opportunity/invoke` with `{ caseId, organizationId, context }`.
2. Display real-time agent progress via SSE stream in AgentThread.
3. On completion, persist agent output (hypotheses, KPIs, confidence scores) to Supabase.
4. Reload HypothesisStage from persisted data — not from demo constants.

### R3 — Hypothesis Stage: Schema

A `hypothesis_outputs` table must exist with RLS scoped to `organization_id`:

```sql
CREATE TABLE public.hypothesis_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  agent_run_id uuid,
  hypotheses jsonb NOT NULL DEFAULT '[]',
  kpis jsonb NOT NULL DEFAULT '[]',
  confidence text CHECK (confidence IN ('high','medium','low')),
  reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hypothesis_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.hypothesis_outputs
  USING (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() AND status = 'active' LIMIT 1));
```

### R4 — Model Stage: Value Tree Persistence

A `value_tree_nodes` table must exist. ModelStage `onSave` must PATCH `/api/v1/value-cases/:id/value-tree` and optimistically update local state. On mount, ModelStage must load from this endpoint — not from hardcoded arrays.

```sql
CREATE TABLE public.value_tree_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  parent_id uuid REFERENCES public.value_tree_nodes(id),
  label text NOT NULL,
  value numeric,
  unit text,
  node_type text NOT NULL DEFAULT 'driver',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.value_tree_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.value_tree_nodes
  USING (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() AND status = 'active' LIMIT 1));
```

### R5 — Model Stage: Financial Snapshot Persistence

A `financial_model_snapshots` table must exist. When FinancialModelingAgent completes, its output (ROI, NPV, payback period, sensitivity) is written here. ModelStage loads the latest snapshot on mount.

### R6 — AgentThread: Real Streaming

AgentThread must connect to the backend SSE stream for the active agent run. The 6 hardcoded static steps must be replaced with events from the stream. The existing `RedisStreamBroker` and `AgentOrchestratorAdapter` infrastructure is used — the gap is the frontend consumer.

### R7 — workflow_checkpoints Migration

`HumanCheckpointService` writes to `workflow_checkpoints`. This table must be created with RLS before any agent run can complete without a Supabase error.

### R8 — researchWorker Compile Fix

Remove the duplicate `const logger` declaration at line 24 of `researchWorker.ts`. The worker must start without errors.

### R9 — Tenant Isolation

All new tables and API endpoints must enforce `organization_id` scoping. No query may omit the tenant filter.

---

## Acceptance Criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | Dashboard "Go" button creates a case and navigates to it | Manual test: enter company name, click Go, land on CaseWorkspace |
| AC-2 | "Run Stage" in HypothesisStage triggers a real agent run | Network tab shows POST to `/api/agents/opportunity/invoke` |
| AC-3 | AgentThread shows live steps from the backend stream, not hardcoded | Steps appear incrementally; differ between runs |
| AC-4 | Hypothesis output persists across page reload | Reload CaseWorkspace; HypothesisStage shows same data |
| AC-5 | ModelStage loads value tree from API on mount | Network tab shows GET to `/api/v1/value-cases/:id/value-tree` |
| AC-6 | Editing a value node and saving persists across reload | PATCH request visible; reload shows updated value |
| AC-7 | `pnpm run test:rls` passes for all new tables | CI green |
| AC-8 | `researchWorker.ts` compiles without errors | `pnpm run typecheck` passes in `packages/backend` |
| AC-9 | No hardcoded demo data remains in HypothesisStage or ModelStage | Code review: no `DEMO_` constants, no inline `const` data arrays |
| AC-10 | All new DB queries include `organization_id` filter | Code review + RLS test |

---

## Implementation Approach

### Sprint 1 (Week 1–2): Schema + Backend Wiring

**Goal:** Backend can receive an agent invocation, run it, and persist results. Frontend can trigger it.

1. **Fix researchWorker compile error** — Remove duplicate `const logger` in `packages/backend/src/workers/researchWorker.ts` (line 24). Run `pnpm run typecheck` in `packages/backend` to confirm.

2. **Add missing migrations** — Create a single migration file `infra/supabase/supabase/migrations/20260310000000_core_workflow_tables.sql` containing:
   - `hypothesis_outputs` table + RLS policy (R3)
   - `value_tree_nodes` table + RLS policy (R4)
   - `financial_model_snapshots` table + RLS policy (R5)
   - `workflow_checkpoints` table + RLS policy (R7)
   - Run `pnpm run db:migrate` to apply.

3. **Backend: hypothesis output persistence** — In `OpportunityAgent.ts`, after `secureInvoke` completes, write the structured output to `hypothesis_outputs` via Supabase client with `organization_id`. Add a `GET /api/v1/value-cases/:id/hypothesis` endpoint that returns the latest row.

4. **Backend: value tree API** — Add `GET /api/v1/value-cases/:id/value-tree` and `PATCH /api/v1/value-cases/:id/value-tree` endpoints in `packages/backend/src/api/valueCases/`. The GET returns all `value_tree_nodes` for the case; the PATCH upserts nodes. Both enforce `organization_id`.

5. **Backend: agent invocation endpoint validation** — Verify `POST /api/agents/:agentId/invoke` correctly routes to `OpportunityAgent` and returns a `runId` for SSE polling. Fix any routing gaps in `AgentOrchestratorAdapter`.

6. **Run RLS tests** — `pnpm run test:rls` must pass for all new tables.

---

### Sprint 2 (Week 3–4): Frontend Wiring

**Goal:** The canvas stages call real APIs. AgentThread streams real events. No hardcoded data remains in the core path.

7. **Dashboard QuickStart** — In `HomePage.tsx` (or `Dashboard.tsx`), wire the "Go" button's `onClick` to call `useCreateCase()` with the input value, then `navigate` to `/opportunities/:oppId/cases/:caseId` on success. Match the pattern already used in `Opportunities.tsx`.

8. **HypothesisStage: replace hardcoded data** — Remove all `DEMO_` constants and inline data arrays. On mount, call `GET /api/v1/value-cases/:id/hypothesis` via `useQuery`. If no data exists, show an empty state with a "Run Hypothesis Agent" CTA.

9. **HypothesisStage: wire "Run Stage" button** — Add `onClick` to the "Run Stage" button that POSTs to `/api/agents/opportunity/invoke` with `{ caseId, organizationId }`. Store the returned `runId` in component state. Invalidate the hypothesis query on completion.

10. **AgentThread: real SSE stream** — Replace the 6 hardcoded static steps with a live SSE consumer. Connect to the backend stream using the `runId` from step 9. Use the existing `useAgentStream` hook's real-API path (`USE_MOCK_API = false`). Map incoming `StreamingUpdate` events to the AgentThread step UI.

11. **ModelStage: replace hardcoded data** — Remove all inline `useState` with static arrays. On mount, call `GET /api/v1/value-cases/:id/value-tree` via `useQuery`. Render the returned nodes.

12. **ModelStage: wire onSave** — Replace `onSave={() => {}}` no-ops with a `useMutation` that calls `PATCH /api/v1/value-cases/:id/value-tree`. Optimistically update local state; roll back on error.

13. **End-to-end smoke test** — Manually walk the full path: Dashboard → create case → run hypothesis → view streaming → reload → edit model node → save → reload → confirm persistence. Document result.

---

### Sprint 3 (Week 5–6): Performance Baseline (server/ layer)

**Goal:** The `server/` MySQL layer meets p95 < 200ms for core queries. Addresses the performance roadmap's Sprint 1 critical fixes.

14. **DB indexes** — Create Drizzle migration adding:
    ```sql
    CREATE INDEX idx_conversations_userId ON conversations (userId, deleted, updatedAt);
    CREATE INDEX idx_messages_conversationId ON messages (conversationId, messageTimestamp);
    ```
    Run `pnpm run db:push`.

15. **MySQL connection pool** — Refactor `server/db.ts` `getDb()` to use `mysql2/promise` pool (`connectionLimit: 20`) instead of a single connection string. Verify existing tests still pass.

16. **SEC EDGAR in-memory cache** — In `server/lib/enrichmentService.ts`, cache the `company_tickers.json` response in a module-level `Map` with a 24-hour TTL. Eliminates 500–2000ms per enrichment request.

17. **Rate limiting** — Add `express-rate-limit` middleware to `server/_core/index.ts`:
    - Global: 1000 req/min per IP
    - `/api/chat`: 10 req/min per user
    - Enrichment tRPC procedure: 20 req/min per user

18. **Verify performance** — Run existing `route-load-budgets.spec.ts` Playwright tests. Confirm no regressions.

---

## Key Files

| File | Change |
|---|---|
| `packages/backend/src/workers/researchWorker.ts` | Remove duplicate `const logger` (line 24) |
| `infra/supabase/supabase/migrations/20260310000000_core_workflow_tables.sql` | New: 4 tables + RLS |
| `packages/backend/src/lib/agent-fabric/agents/OpportunityAgent.ts` | Write output to `hypothesis_outputs` |
| `packages/backend/src/api/valueCases/` | Add hypothesis + value-tree endpoints |
| `apps/ValyntApp/src/views/canvas/HypothesisStage.tsx` | Replace hardcoded data; wire Run Stage |
| `apps/ValyntApp/src/views/canvas/ModelStage.tsx` | Replace hardcoded data; wire onSave |
| `apps/ValyntApp/src/views/canvas/AgentThread.tsx` | Replace static steps with SSE stream |
| `apps/ValyntApp/src/pages/valueos/HomePage.tsx` | Wire Dashboard QuickStart Go button |
| `server/db.ts` | Connection pool |
| `server/lib/enrichmentService.ts` | In-memory EDGAR ticker cache |
| `server/_core/index.ts` | Rate limiting middleware |
| `drizzle/` | New migration: conversations + messages indexes |

---

## Non-Negotiable Constraints

- Every new DB query must include `organization_id` or `tenant_id` — no exceptions (AGENTS.md Rule 1).
- All agent LLM calls must use `this.secureInvoke()` — no direct `llmGateway.complete()` calls (AGENTS.md Rule 2).
- `service_role` must not be used for new canvas/model endpoints (AGENTS.md Rule 3).
- TypeScript strict mode: no `any`, use `unknown` + type guards.
- Named exports only.

---

## Implementation Notes

### 1. AgentThread Streaming

Real-time streaming is conditional on Kafka-backed SSE availability.

AgentThread does not need full streaming parity in this sprint. The primary requirement is that agent execution status is **truthful**.

- If `/api/agents/jobs/:jobId/stream` is available and `isKafkaEnabled()` is true, AgentThread may show live SSE updates.
- If Kafka/SSE infrastructure is unavailable, the UI must:
  - fall back to polling the job status endpoint
  - show a clear infrastructure-limited state
  - avoid implying live streaming is active
  - instruct the user what to do next in plain language

**Success criterion:** Users can always determine whether a run is queued, running, completed, failed, or streaming-unavailable. The UI must never simulate live streaming when the backend cannot provide it.

**Implementation status:** Polling fallback implemented via `useAgentJob`. `unavailable` state renders an explanatory message. SSE path available when Kafka is running.

---

### 2. ModelStage Empty State

ModelStage is considered in scope only to the extent that it truthfully reflects persisted state.

- If no `value_tree_nodes` exist for the case, the stage must show an explicit empty state telling the user to run the Hypothesis stage first.
- The stage must not show fabricated model nodes, assumptions, or calculations.
- Wiring `FinancialModelingAgent` to create/populate `value_tree_nodes` is the next incremental step, not a blocker for this sprint.

**Success criterion:** A fresh case with no prior agent run shows a truthful empty state. No hardcoded model data appears. Once real nodes exist, the stage renders them from persistence.

**Implementation status:** Empty state implemented. All hardcoded `useState` arrays removed. `FinancialModelingAgent` → `value_tree_nodes` wiring is a follow-up task.

---

### 3. Out-of-Scope Stage Boundary

IntegrityStage, NarrativeStage, and RealizationStage are not required to be fully wired end-to-end in this sprint. They may remain as existing implementations but must not be expanded or represented as newly completed by this roadmap.

Any misleading hardcoded operational claims in those stages should be removed or clearly labeled if touched incidentally.

**Success criterion:** Sprint completion is not blocked by those stages. Sprint reporting clearly states that only the core path (Hypothesis + Model) was made real.

---

### 4. workflow_checkpoints Schema

The initial `workflow_checkpoints` migration defines `case_id UUID NULL` without a foreign key constraint. This is an intentional transitional decision: `HumanCheckpointService` may create checkpoints before a case exists.

The schema supports checkpoint creation, status transitions, agent association, and later case linkage.

**Follow-up task (backlog):** Add `FOREIGN KEY (case_id) REFERENCES public.value_cases(id)` once `HumanCheckpointService` guarantees case context on all checkpoint creation paths.

**Success criterion:** Checkpoints can be created and updated without migration or runtime failure. The schema decision is documented as temporary.

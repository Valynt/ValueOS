# Sprint Roadmap — Agentic Value-Case Workflow: Demo to Real

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

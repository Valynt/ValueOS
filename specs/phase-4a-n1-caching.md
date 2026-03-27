# Spec: Phase 4a — N+1 Audit + Caching Strategy

**Sprint scope:** Phase 4a only  
**Phase sequence:** 4a (this spec) → 4b (BullMQ idempotency) → 6 (CI flake quarantine)  
**Dependency note:** Phase 4b assumes 4a is complete and merged. Phase 6 assumes both 4a and 4b are complete.

---

## Problem Statement

The ValueOS backend has 55 identified instances of Supabase queries inside loops. Three areas account for the highest-impact N+1 patterns:

1. **`packages/backend/src/api/valueGraph.ts`** — PATCH and DELETE handlers loop over `["vg_capabilities", "vg_metrics", "vg_value_drivers"]` sequentially to resolve which table owns a node. This is a schema-ownership problem disguised as a loop: the application layer is doing work that belongs in the database.

2. **`packages/backend/src/services/realization/PromiseBaselineService.ts`** — `amendBaseline()` loops over KPI targets and inserts each one individually. `scheduleCheckpoints()` has a nested loop (targets × quarters) that inserts each checkpoint row individually.

3. **`packages/backend/src/services/billing/UsageMeteringService.ts`** — `submitPendingAggregates()` loops over aggregates and submits each to Stripe sequentially. This is constrained by the Stripe API (no batch endpoint) and an intentional semaphore-based concurrency cap — it is not a true N+1 and requires documentation, not refactoring.

Additionally, `BenchmarkService` (`packages/backend/src/services/core/BenchmarkService.ts`) uses an in-memory `Map` for percentile caching. This cache is instance-scoped: each worker process has its own copy, and `invalidatePercentileCache()` only clears the local instance, leaving other pods stale.

No query instrumentation exists at the Supabase client wrapper level. There is no per-request query count, no slow-query signal, and no p95 latency baseline for the affected routes.

---

## Requirements

### 4a.1 — Query Instrumentation

**What:** Add a dedicated query metrics module and instrument the shared Supabase client wrapper to emit both Prometheus metrics and structured logs.

#### Prometheus metrics

Create `packages/backend/src/lib/metrics/dbMetrics.ts`, following the pattern of `httpMetrics.ts` and `cacheMetrics.ts`:

| Metric | Type | Labels |
|---|---|---|
| `supabase_query_total` | Counter | `operation`, `table`, `status` |
| `supabase_query_duration_seconds` | Histogram | `operation`, `table` |
| `supabase_query_errors_total` | Counter | `operation`, `table` |

Label constraints:
- `operation`: one of `select`, `insert`, `update`, `delete`, `upsert`, `rpc`
- `table`: logical table/resource name — bounded set, no raw SQL, no user input
- `status`: `ok` or `error`
- No user IDs, request IDs, org IDs, or arbitrary filter values as labels (cardinality control)

#### Structured logs

Emit via the existing `logger` at `debug` level for all queries, `warn` for slow queries (threshold: 500ms), `error` on query failure:

```json
{
  "event": "supabase_query",
  "table": "<string>",
  "operation": "<string>",
  "duration_ms": "<number>",
  "status": "ok | error",
  "trace_id": "<string>",
  "caller": "<string>"
}
```

- `trace_id`: from request context if available
- `caller`: module/service name, statically set at the instrumentation point

#### Where to instrument

`packages/shared/src/lib/supabase.ts` is the canonical shared wrapper. Instrumentation wraps the query execution path once so all callers benefit without per-call changes.

#### Acceptance criteria

- `supabase_query_total`, `supabase_query_duration_seconds`, `supabase_query_errors_total` are registered and exported via the existing Prometheus endpoint
- Slow queries (>500ms) emit a `warn` log with `duration_ms`, `table`, `operation`, `trace_id`
- No high-cardinality labels
- Unit tests cover metric increment on success/error and slow-query log emission

---

### 4a.2 — N+1 Remediation

#### 4a.2a — ValueGraph node ownership (`valueGraph.ts`)

**Problem:** PATCH and DELETE handlers loop over 3 tables to find which one owns a node. Schema-ownership logic belongs in the database, not the application layer.

**Fix:** Create a Supabase database function (RPC) `resolve_value_graph_node(node_id uuid, opportunity_id uuid, organization_id uuid)` that returns the owning record's metadata:

```sql
-- Returns: id, node_type ('capability'|'metric'|'value_driver'), source_table
-- Unions vg_capabilities, vg_metrics, vg_value_drivers with LIMIT 1
-- Enforces organization_id scoping inside the function
```

Migration file: `supabase/migrations/<timestamp>_resolve_value_graph_node.sql`

Update `valueGraph.ts` PATCH and DELETE handlers to:
1. Call the RPC once to resolve `source_table`
2. Dispatch a single targeted query to the resolved table

**Acceptance criteria:**
- PATCH and DELETE each make exactly 2 DB calls (1 resolve RPC + 1 operation) instead of up to 3
- `organization_id` is enforced inside the RPC (tenant isolation invariant preserved — no exceptions per `docs/AGENTS.md`)
- Existing PATCH/DELETE behavior is unchanged for all 3 node types
- Integration test covers all 3 node types for both PATCH and DELETE
- Returns 404 correctly when node does not exist in any table

#### 4a.2b — PromiseBaselineService bulk inserts

**Problem:** `amendBaseline()` inserts KPI targets one-by-one in a loop (line 286). `scheduleCheckpoints()` inserts checkpoints one-by-one in a nested loop (lines 366/370/380).

**Fix:**
- `amendBaseline()`: collect all KPI target rows into an array, then call `supabase.from("promise_kpi_targets").insert(rows)` once
- `scheduleCheckpoints()`: collect all checkpoint rows across all targets and quarters into a flat array, then call `supabase.from("promise_checkpoints").insert(rows)` once

**Acceptance criteria:**
- `amendBaseline()` makes exactly 1 insert call for KPI targets regardless of input size
- `scheduleCheckpoints()` makes exactly 1 insert call for checkpoints regardless of target count or timeline length
- Existing behavior (correct rows, correct `tenant_id` scoping) is preserved
- Unit tests assert single-call behavior via mock call count

#### 4a.2c — UsageMeteringService: document intentional sequential pattern

**Problem:** `submitPendingAggregates()` submits each aggregate to Stripe sequentially inside a loop. This was flagged as an N+1 candidate but is architecturally correct: Stripe's usage record API has no batch endpoint, and the semaphore-based concurrency cap is intentional.

**Fix:** Add an explanatory comment at the loop site. No behavioral change.

**Acceptance criteria:**
- Comment at the loop in `submitPendingAggregates()` explains why sequential submission is correct and intentional (Stripe API constraint + semaphore design)
- No code behavior changes

---

### 4a.3 — Caching Strategy

#### 4a.3a — BenchmarkService: migrate percentile cache to Redis

**Problem:** `BenchmarkService.percentileCache` is an in-memory `Map` (line 74). Each worker process has its own cache. `invalidatePercentileCache()` only clears the local instance, leaving other pods stale.

**Fix:** Replace the in-memory `Map` with the existing `CacheService` (`packages/backend/src/services/CacheService.ts`), which is Redis-backed and already used elsewhere. Use a namespaced key pattern:

```
benchmark:percentiles:{kpiName}:{filterHash}
```

- TTL: preserve the existing 5-minute TTL (`BenchmarkService.CACHE_TTL_MS`)
- `filterHash`: deterministic hash of `{ industry, vertical, company_size, region }` — must not include `organization_id` in the key if benchmark data is not tenant-specific; if it is tenant-specific, include `organization_id` in the key

Cache invalidation must call `CacheService.invalidateNamespace("benchmark:percentiles")` so all pods are invalidated atomically.

**Acceptance criteria:**
- `BenchmarkService` no longer holds an in-memory `Map`
- Cache reads/writes go through `CacheService`
- `invalidatePercentileCache()` invalidates across all pods (Redis namespace invalidation)
- Unit tests mock `CacheService` and verify cache hit, cache miss, and invalidation paths
- Tenant isolation is preserved: if benchmark data is tenant-scoped, `organization_id` is part of the cache key

#### 4a.3b — Document caching boundaries for Value Model computations

**Problem:** ROI model and scenario generation computations are expensive but have no caching layer. Before implementing caching, the boundaries must be defined to avoid incorrect cache key design or stale-data bugs.

**Action:** Add an inline caching decision comment block to the relevant service(s) (e.g., `FinancialModelingAgent` or the service that owns scenario generation). The comment must specify:

- Which computations are candidates for caching
- Proposed cache key structure (must include `organization_id` for tenant isolation per `docs/AGENTS.md`)
- Proposed TTL per computation type
- Invalidation trigger (e.g., scenario update, assumption change, model version bump)
- Any correctness risks (e.g., stale ROI after assumption edit)

This is a documentation task. Actual implementation of Value Model caching is deferred to a follow-on task once the boundaries are reviewed.

**Acceptance criteria:**
- Caching decision comment exists in the relevant service(s)
- Comment specifies key structure (including `organization_id`), TTL, and invalidation trigger for at least 2 computation types
- No production code changes to Value Model services in this task

---

## Phase 4a Exit Criteria

All of the following must be true before Phase 4b begins:

1. `supabase_query_total`, `supabase_query_duration_seconds`, `supabase_query_errors_total` are registered and exported via Prometheus
2. Slow-query structured logs emit on queries >500ms
3. ValueGraph PATCH/DELETE make ≤2 DB calls per operation (verified by test)
4. `PromiseBaselineService.amendBaseline()` makes 1 insert call for KPI targets (verified by test)
5. `PromiseBaselineService.scheduleCheckpoints()` makes 1 insert call for checkpoints (verified by test)
6. `BenchmarkService` percentile cache is Redis-backed; cross-pod invalidation works
7. Value Model caching boundaries are documented in code
8. All existing tests pass (`pnpm test`)
9. No new `ts-any` violations introduced (checked against `ts-any-baseline.json`)

---

## Implementation Order

Steps are ordered to minimize risk: instrumentation first (no behavior change), then targeted N+1 fixes, then caching changes.

1. **`dbMetrics.ts`** — create the metrics module (no behavior change, safe to land first)
2. **Supabase wrapper instrumentation** — add metrics + log emission to `packages/shared/src/lib/supabase.ts`
3. **ValueGraph RPC migration** — write Supabase migration, update `valueGraph.ts` handlers, add integration tests
4. **PromiseBaselineService bulk inserts** — refactor `amendBaseline()` and `scheduleCheckpoints()`, update unit tests
5. **UsageMeteringService comment** — add explanatory comment, no behavior change
6. **BenchmarkService Redis migration** — replace in-memory Map with CacheService, update unit tests
7. **Value Model caching decision comment** — add inline documentation to relevant service(s)
8. **Regression pass** — run `pnpm test`, verify no query explosion on affected routes

---

## Files Expected to Change

| File | Change |
|---|---|
| `packages/backend/src/lib/metrics/dbMetrics.ts` | New — Prometheus metrics for DB queries |
| `packages/shared/src/lib/supabase.ts` | Add instrumentation wrapper |
| `supabase/migrations/<timestamp>_resolve_value_graph_node.sql` | New — RPC for node ownership resolution |
| `packages/backend/src/api/valueGraph.ts` | Use RPC for node resolution in PATCH/DELETE |
| `packages/backend/src/services/realization/PromiseBaselineService.ts` | Bulk inserts in `amendBaseline()` and `scheduleCheckpoints()` |
| `packages/backend/src/services/billing/UsageMeteringService.ts` | Add explanatory comment only |
| `packages/backend/src/services/core/BenchmarkService.ts` | Replace in-memory Map with CacheService |
| Relevant FinancialModeling/scenario service | Add caching decision comment |
| Test files for each changed service | Updated/new unit and integration tests |

---

## Out of Scope (Phase 4a)

- BullMQ job ID determinism → Phase 4b
- DLQ replay validation → Phase 4b
- CI flake quarantine mechanism → Phase 6
- Actual implementation of Value Model / ROI caching → deferred pending boundary doc review
- The remaining ~48 of the 55 N+1 suspects outside the three high-impact areas above

# Agentic System Production Readiness: Performance Engineering Assessment (2026-03-06)

> **Archived on 2026-03-19.** This assessment predates the current split-latency production contract. The authoritative thresholds now live in `packages/backend/src/config/slo.ts`, `docs/security-compliance/production-contract.md`, `infra/testing/load-test.k6.js`, and `infra/k8s/base/hpa.yaml`. Keep this document for historical context only.

## Archive Status

- Historical snapshot retained for the March 6, 2026 readiness review.
- Superseded materially by the split-latency model adopted on 2026-03-19:
  - interactive completion p95 `<= 200ms`
  - orchestration TTFB p95 `<= 200ms`
  - orchestration completion p95 `<= 3000ms`
- Any contradiction between this document and current manifests/configuration should be resolved in favor of the newer sources above.


## Scope and Method

This assessment is a static-readiness review of the ValueOS agentic stack (backend API, agent workers, queueing, Supabase/Postgres access, Redis caching, and Kubernetes scaling configuration). It is based on code/config inspection and existing load-test/alert definitions, not on a fresh production load run.

## Executive Readout

- **p95 < 200ms is currently realistic for non-LLM, cache-friendly API paths**, but **not realistic for LLM-heavy critical paths** with current alerting targets (alerts allow p95 up to 1000ms for `/api/llm` and `/api/billing`).
- **Load elasticity is mixed**: API and most high-frequency agents have HPA policies, low-frequency agents have KEDA scale-to-zero, but the standalone `worker` deployment is fixed at one replica and is a throughput chokepoint.
- **Database posture is generally healthy on pooling and tenant scoping**, but there are still optimization opportunities in query-shape/index alignment, expensive broad semantic retrieval, and instrumentation for query plans.
- **Caching strategy exists but is inconsistent**: strong Redis primitives are present, while some cache implementations still include potentially expensive key scans and non-streaming stats collection.

---

## 1) Current Load Handling Capacity and Bottlenecks

### What capacity is provisioned today

1. **API load profile and SLO harness already define p95 target 200ms under 50 VUs** in the k6 script (`http_req_duration p(95)<200` with default `VUS=50`, `DURATION=2m`).
2. **Backend API autoscaling envelope** is `minReplicas: 2`, `maxReplicas: 10`, with CPU (70%) + memory (80%) metrics.
3. **Agent fleet has differentiated concurrency budgets** via `MAX_CONCURRENT_REQUESTS` (roughly 5–12 depending on agent type).
4. **Queue workers have low-to-moderate built-in concurrency** (e.g., research worker `concurrency: 3`, CRM workers `concurrency: 3/5` plus per-minute limiters).

### Primary bottlenecks

1. **Single replica worker deployment (`replicas: 1`)** creates a hard cap for BullMQ background throughput and can accumulate queue lag under bursty traffic.
2. **Conservative scale-down windows (300s) across HPA/KEDA** can over-provision for several minutes after spikes, raising infra cost.
3. **Queue processing rate limits are static** and may throttle unnecessarily during healthy periods (e.g., 10 jobs/min in research worker).
4. **Critical latency monitoring for `/api/llm` currently tolerates p95 up to 1000ms**, indicating practical production latency is expected to exceed the desired 200ms on LLM routes.

### Production readiness verdict (load)

- **Readiness: Partial**. Baseline architecture is sound, but worker-side horizontal elasticity and queue backpressure controls need strengthening before aggressive production growth.

---

## 2) Database Query Optimization Opportunities

### What is already strong

1. **Tenant-scoped DB access middleware uses pooled Postgres connections** (`max` default 10, with connection/query/statement timeouts).
2. **Tenant isolation is enforced at query/memory interface boundaries** (`organization_id` required in memory retrieval APIs).
3. Existing SQL optimization scripts include many index definitions and bloat/query helper functions.

### Optimization opportunities

1. **Operationalize index strategy**
   - Promote selective indexes from `scripts/database-performance-optimization.sql` into versioned migrations for guaranteed rollout consistency.
   - Ensure leading index keys align with tenant filters (`tenant_id`, `organization_id`) and high-cardinality predicates.
2. **Tighten semantic memory retrieval shape**
   - `SupabaseMemoryBackend.retrieve()` performs semantic search then filters by `agentType` and optional memory type in application code. Push more filtering into SQL/RPC layer where possible to reduce payload size and CPU.
3. **Add plan-level telemetry loop**
   - Enable routine `EXPLAIN (ANALYZE, BUFFERS)` sampling for top p95 queries and tie to SLO dashboards.
4. **Right-size pool limits per pod profile**
   - With autoscaling API pods, default pool max of 10 per pod may oversubscribe DB under scale-out. Introduce environment-tiered pool caps and pgbouncer strategy if connection pressure appears.

### Estimated impact

- **p95 API latency (DB-bound endpoints):** 15–35% reduction.
- **DB CPU/IO cost:** 10–25% reduction through better index usage + reduced over-fetch.

---

## 3) Caching Strategy Effectiveness

### Current state

1. **Unified cache service supports memory/local/session/Redis** with tenant-aware namespacing.
2. **Redis-backed response caching is used in key orchestration paths** (e.g., `UnifiedAgentAPI` reads/writes with `storage: "redis"`).
3. **Dedicated LLM cache exists** with configurable TTL and cost metadata.

### Gaps and risks

1. **Cache clear/stats operations use Redis `KEYS` scans** in `LLMCache`, which can become blocking at scale.
2. **In-memory cache fallback can fragment hit-rates across pods**, reducing effectiveness under high horizontal scale if Redis is unavailable or bypassed.
3. **No explicit stale-while-revalidate strategy** for expensive but mostly stable artifacts; this can cause synchronized cache misses (“thundering herd”).

### Recommended cache improvements

1. Replace `KEYS` with `SCAN` + batched pipelines.
2. Standardize critical-path caches on Redis-only in production (retain memory fallback only for dev/test).
3. Add request coalescing/single-flight for high-cost cache misses.
4. Introduce tiered TTLs by endpoint criticality and expected data volatility.

### Estimated impact

- **p95 on cacheable reads:** 20–45% reduction.
- **LLM/token spend:** 10–30% reduction via higher response cache reuse.

---

## 4) Auto-Scaling Configuration

### Strengths

1. **API HPA** includes CPU + memory metrics and explicit behavior policies.
2. **Agent autoscaling** is mature: core/high-frequency agents use HPA with external queue-depth metrics; low-frequency agents use KEDA scale-to-zero.
3. **Per-agent resource classes** (CPU/memory requests/limits) and max concurrency are tailored by workload type.

### Gaps

1. **Background worker deployment has no HPA/KEDA** and remains singleton.
2. **Scale-down policies are conservative**, prolonging high replica counts after bursts.
3. **No explicit predictive/pre-warm autoscaling** for known recurring demand windows.

### Scaling roadmap (priority)

1. Add queue-depth-driven HPA/KEDA for `worker` deployment.
2. Tune scale-down window from 300s → 120–180s for non-critical tiers after validation.
3. Add scheduled pre-scaling for forecastable peaks.

### Estimated impact

- **Queue latency p95:** 25–50% reduction during spikes.
- **Compute cost efficiency:** 12–22% improvement from faster downscale + right-sized replicas.

---

## 5) Resource Utilization Patterns

### Observed pattern

1. **Resource classes correlate with model complexity** (e.g., realization/opportunity agents provisioned more CPU/memory than lightweight agents).
2. **Concurrency caps inversely correlate with compute intensity** (heavier agents lower max concurrency).
3. **Backend pod sizing (250m/512Mi requests, 1 CPU/1Gi limits)** is reasonable for mixed API workloads but should be stress-tested against LLM gateway + telemetry overhead.

### Utilization risks

1. **Headroom asymmetry** between API autoscaling and singleton workers can shift bottlenecks from HTTP layer to queues.
2. **Potential noisy-neighbor pressure** if many moderate-size agent pods co-schedule without stricter anti-affinity/topology spread controls.

### Recommendations

1. Enforce topology spread constraints across agent tiers.
2. Track per-agent saturation (`queue depth`, `CPU throttling`, `RSS`, `GC pause`) and auto-tune `MAX_CONCURRENT_REQUESTS` monthly.

---

## 6) Latency Benchmarks vs Industry Standard (Target p95 < 200ms)

### Current benchmark posture

1. **Declared target exists** in k6 thresholds: `http_req_duration p(95)<200`.
2. **Critical API alert posture is inconsistent**:
   - `/api/value-cases` pages at p95 > 200ms (aligned).
   - `/api/llm` and `/api/billing` only warn at p95 > 1000ms (misaligned with stated 200ms target).
3. **Vector search benchmark documentation reports p95 < 120ms** for PGVector HNSW paths (good for retrieval tier), but this does not represent end-to-end agent response latency.

### Industry framing

- For interactive SaaS APIs, **p95 < 200ms** is best-practice for CRUD/read endpoints.
- For **LLM-orchestrated endpoints**, p95 < 200ms end-to-end is rarely feasible without asynchronous UX patterns (streaming, async job polling, partial rendering).

### Recommended SLO split

1. **SLO-A (interactive API):** p95 < 200ms.
2. **SLO-B (agent/LLM orchestration):** time-to-first-byte < 200ms (stream open), p95 completion target defined separately (e.g., 1.5–3.0s depending on operation class).
3. **SLO-C (background queue jobs):** queue wait p95 + execution p95 per queue.

---

## Performance Optimization Roadmap (90 Days)

## Phase 0 (Week 0–2): Baseline and Guardrails

- Instrument per-route and per-queue p50/p95/p99 dashboards with tenant and agent dimensions.
- Align alert thresholds with split SLO model (interactive vs LLM).
- Add worker queue lag and saturation alerts.

**Expected impact:** Better incident detection; no direct latency gain but prevents regression and de-risks later tuning.

## Phase 1 (Week 2–5): Remove Throughput Chokepoints

- Add autoscaling to `worker` deployment (queue depth + CPU).
- Raise and adaptive-tune queue concurrency/limiters for healthy tenants.
- Introduce single-flight control for expensive cache misses.

**Expected impact:**
- Queue wait p95: **-25% to -50%**
- End-to-end agent response p95 (burst periods): **-15% to -30%**
- Cost efficiency: **+8% to +15%**

## Phase 2 (Week 5–8): Query + Cache Efficiency

- Migrate high-value index recommendations into audited migrations.
- Push semantic retrieval filters deeper into DB/RPC path.
- Replace Redis `KEYS` usage with `SCAN`/pipeline patterns.
- Enforce Redis-first cache policy in production profiles.

**Expected impact:**
- DB endpoint p95: **-15% to -35%**
- Cache hit latency: **-20% to -45%**
- DB/Redis infra spend: **-10% to -20%**

## Phase 3 (Week 8–12): Cost-Aware Elasticity

- Tune scale-down windows and policies by tier.
- Add predictive pre-scaling for known peak windows.
- Implement monthly auto-tuning for per-agent concurrency/resource settings.

**Expected impact:**
- Overall p95 (mixed traffic): **-10% to -20%** additional
- Compute cost efficiency: **+12% to +22%**

---

## Consolidated Impact Projection (after full roadmap)

- **Interactive API p95:** likely to meet and sustain **<200ms** for most non-LLM routes.
- **LLM/agent perceived latency:** significant improvement via faster queue handling + cache + streaming SLO model (TTFB under 200ms feasible).
- **Infrastructure cost efficiency:** **15–30%** improvement through autoscaling and cache/query optimization.
- **Operational resilience:** higher throughput headroom, clearer SLOs, faster anomaly detection.

---

## Immediate “Top 5” Actions

1. Add autoscaler for singleton `worker` deployment.
2. Align `/api/llm` alerting and SLO model (split interactive vs completion latency).
3. Replace Redis `KEYS` calls in LLM cache maintenance with `SCAN`.
4. Productionize index rollout from optimization SQL into formal migrations.
5. Add queue-depth + queue-wait p95 dashboards and alerting per queue/agent type.

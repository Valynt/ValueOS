---
title: Load Test Baselines
owner: team-sre
review_date: 2026-10-15
status: active
---

# Load Test Baselines

Documented baselines from load test runs against staging. Used to detect regressions and validate SLO compliance before production deployments.

Canonical classification matrix: `docs/operations/slo-sli.md`.

## Latency classes

ValueOS load tests must reuse the canonical class mapping from `docs/operations/slo-sli.md#canonical-classification-and-policy-matrix`.

| Latency class | Source-of-truth target | Allowed exception policy | Route guidance |
|---|---|---|---|
| Interactive completion | Completion latency p95 `< 200 ms` | None. If the route cannot complete within 200 ms p95, it must move to orchestration before rollout. | Readiness, auth/session checks, list/detail reads, and cache-friendly mutations that should finish synchronously for the caller. |
| Orchestration acknowledgment/completion | Acknowledgment latency p95 `< 200 ms` | Completion latency p95 `< 3000 ms` only for routes explicitly labeled orchestration and backed by streaming or async semantics. | Streaming, queue-backed, or provider-mediated routes should acknowledge quickly, then complete under the allowed exception policy. |

### Route classification guidance

- Keep routes in the **interactive completion** class only when the full response is expected to complete within the 200 ms p95 budget.
- Treat `/api/llm/*`, `/api/billing/*`, `/api/queue/*`, and any provider-bound or queue-backed workflow submission as **orchestration acknowledgment/completion** routes.
- Only workloads labeled `scaling.valueos.io/request-path-policy=interactive-allowlisted` may be counted toward interactive route capacity when an agent participates in the request path.
- Scale-to-zero agents labeled `scaling.valueos.io/request-path-policy=async-only` remain orchestration-only; they must never be used to satisfy interactive latency expectations.

## Tool

[k6](https://k6.io) — scripts in `infra/testing/load-test.k6.js`.

```bash
k6 run \
  --env BASE_URL=https://staging.valueos.app \
  --env AUTH_TOKEN=<staging-jwt> \
  --env TENANT_ID=<staging-tenant-uuid> \
  infra/testing/load-test.k6.js
```

---

## Targets (v2.2)

| Route class / endpoint | Load profile | p50 | p95 | p99 | Error rate |
|---|---|---|---|---|---|
| Interactive completion (`GET /health`, `GET /api/health/ready`, auth/session checks, `GET /api/teams`) | 50 VU, 5 min | < 100 ms | < 200 ms | < 400 ms | < 0.1% |
| Orchestration acknowledgment (`POST /api/llm/chat`, `GET /api/billing/summary`, `POST /api/queue/llm`) | 20 VU, 5 min | < 100 ms | < 200 ms | < 400 ms | < 0.1% |
| Orchestration completion exception (`POST /api/llm/chat`, `GET /api/billing/summary`, `POST /api/queue/llm`) | 20 VU, 5 min | < 1500 ms | < 3000 ms | < 5000 ms | < 1% |
| `GET /health` | 100 VU, 5 min | < 50 ms | < 100 ms | < 200 ms | 0% |

---

## Recorded baselines

### 2026-07-15 — staging

| Field | Value |
| --- | --- |
| **Script** | `infra/testing/load-test.k6.js` |
| **Concurrency** | 50 VUs |
| **Duration** | 30s ramp-up → 2m sustained → 30s ramp-down |

| Route class / endpoint | p50 (ms) | p95 (ms) | p99 (ms) | Error Rate | Throughput (req/s) | SLO Met |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Interactive completion aggregate | 18 | 72 | 118 | 0.00% | 193 | ✅ |
| Orchestration acknowledgment aggregate | 41 | 121 | 188 | 0.00% | 47 | ✅ |
| Orchestration completion aggregate | 422 | 1640 | 2488 | 0.02% | 47 | ✅ |
| `GET /health` | 4 | 11 | 18 | 0.00% | 142 | ✅ |
| `GET /api/health/ready` | 6 | 14 | 22 | 0.00% | 138 | ✅ |
| `GET /api/teams` | 22 | 68 | 104 | 0.00% | 51 | ✅ |
| `GET /api/billing/summary` | 87 | 182 | 246 | 0.00% | 16 | ✅ acknowledgment |
| `POST /api/llm/chat` | 133 | 196 | 241 | 0.02% | 8 | ✅ acknowledgment |
| `POST /api/queue/llm` | 38 | 92 | 135 | 0.00% | 23 | ✅ acknowledgment |

**Aggregate:** Interactive completion p95 72 ms (target `< 200 ms` ✅). Orchestration acknowledgment p95 121 ms (target `< 200 ms` ✅). Orchestration completion p95 1640 ms (allowed exception policy `< 3000 ms` ✅).

---

## Run template

```
### YYYY-MM-DD — <environment>

| Route class / endpoint | p50 | p95 | p99 | Error Rate | SLO Met |
| --- | ---: | ---: | ---: | ---: | --- |
| Interactive completion aggregate | | | | | |
| Orchestration acknowledgment aggregate | | | | | |
| Orchestration completion aggregate | | | | | |
| GET /health | | | | | |
| GET /api/health/ready | | | | | |
| GET /api/teams | | | | | |
| GET /api/billing/summary | | | | | |
| POST /api/llm/chat | | | | | |
| POST /api/queue/llm | | | | | |

Notes:
```

If interactive completion p95 exceeds 200 ms, or orchestration acknowledgment p95 exceeds 200 ms, file a debt item in `.windsurf/context/debt.md`.

If orchestration completion p95 exceeds 3000 ms, track it as an orchestration exception-policy regression rather than as a universal API latency regression.

---

## Infrastructure assumptions

- Postgres: Supabase Pro (2 vCPU, 4 GB RAM).
- Redis topology target: **two logical roles** even when both endpoints are backed by the same provider account:
  - `REDIS_CACHE_URL` / cache Redis for latency-sensitive read caches with eviction enabled.
  - `REDIS_CONTROL_PLANE_URL` / control-plane Redis for idempotency, RBAC invalidation, rate limiting, and agent state with `noeviction`.
- Backend: 2 replicas, 1 vCPU / 512 MB each, CDN: Cloudflare.
- HPA guardrails assume interactive completion p95 `< 200 ms`; orchestration routes are scaled and alerted on acknowledgment p95 `< 200 ms`, with completion p95 `< 3000 ms` treated as the only allowed exception policy.
- Warm interactive agents use `180s` scale-down stabilization; backend API uses `90s`; queue workers use `240s`; KEDA scale-to-zero agents keep `180s` cooldown.

Adjust targets if the deployment topology changes significantly.

## Redis dependency classification

### Hard dependency paths

| Feature | Functions / paths | Why it is a hard dependency | Failure mode when Redis is unavailable |
|---|---|---|---|
| Idempotency | `IdempotencyGuard.execute()`, `IdempotencyGuard.hasBeenProcessed()`, `IdempotencyGuard.getCachedResult()` | Duplicate-suppression correctness depends on the shared key existing across retries and pods. | Fail closed. Reject or retry the protected workflow instead of running the side effect twice. |
| Agent state | `SessionContextLedger.appendMessage()`, `appendCalculation()`, `getSessionContext()`, `clearSession()` | Multi-step orchestration expects session scratchpad continuity across pods. | Fail closed for workflows that require prior session context; do not silently continue with partial state. |

### Graceful-degradation paths

| Feature | Functions / paths | Degraded behavior | Notes |
|---|---|---|---|
| Read cache | `ReadThroughCacheService.getOrLoad()`, `ReadThroughCacheService.invalidateEndpoint()`, shared ESO cache | Bypass Redis and serve the loader result; keep per-process near-cache only when present. | This protects correctness and keeps interactive reads available at the cost of higher origin latency. |
| RBAC invalidation | `publishRbacInvalidation()`, `subscribeRbacInvalidation()` | In-process caches continue until TTL expiry; warn and increment `rbac_redis_unavailable_total`. | Security-sensitive because revocations can remain stale up to the local TTL. |
| Rate limiting | `AuthRateLimitStore`, `llmRateLimiter`, `NonceStore.consumeOnce()` when Redis is not required | Fall back to per-pod memory limits or replay cache. | Effective limit becomes `N x per-pod limit`; alerting must stay on. |
| Queue health telemetry | `getQueueHealth()` | Return zeros instead of failing the health endpoint. | Operationally degraded but keeps readiness surfaces responsive. |

## Per-feature Redis fallback policy

| Feature | Redis role | Keyspace characteristics | Fallback policy | Operator action |
|---|---|---|---|---|
| Read cache | Cache Redis | High-churn, eviction-tolerant, TTL-bound (`read-cache:*`, ESO cache keys) | **Graceful degrade.** Bypass Redis, preserve correctness, allow latency regression, and keep near-cache enabled per pod. | Investigate cache latency/hit-rate regressions before they spill into the interactive p95 budget. |
| Idempotency | Control-plane Redis | Low-cardinality, correctness-critical, 24h TTL | **Fail closed.** Do not execute duplicate-prone workflows when Redis cannot be trusted. | Page backend on-call, restore Redis, then replay with the original idempotency key. |
| RBAC invalidation | Control-plane Redis | Small pub/sub channel (`rbac:invalidate`) | **Graceful but security-degraded.** Continue serving traffic, log loudly, and rely on TTL expiry of local permission caches. | If revocations are urgent, set `RBAC_CACHE_TTL_SECONDS=0` or restart pods after Redis is restored. |
| Rate limiting | Control-plane Redis | Many small counters with short TTLs | **Graceful degrade.** Fall back to per-pod memory counters and keep alerts on because aggregate protection weakens. | Reduce per-pod thresholds or scale in if attack traffic is active. |
| Agent state | Control-plane Redis | Session-scoped ledger, moderate TTL, overwrite-heavy | **Fail closed.** New work that requires prior session context should stop rather than continue with missing context. | Drain/retry queued workflows after Redis recovers; do not silently resume with blank state. |

## Capacity targets and alert wiring

The following targets are the Redis capacity SLOs for staging and production. Dashboard and alert wiring lives in:

- `infra/k8s/monitoring/redis-capacity-dashboard-configmap.yaml`
- `infra/k8s/monitoring/redis-capacity-alerts.yaml`

| Signal | Target | Alert threshold | Notes |
|---|---|---|---|
| Cache Redis memory use | `< 70%` of `maxmemory` sustained | Warning at `>= 70%` for 15m, critical at `>= 85%` for 15m | Leave headroom for replication/AOF rewrite and bursty read-cache growth. |
| Control-plane Redis memory use | `< 60%` of `maxmemory` sustained | Warning at `>= 60%` for 15m, critical at `>= 75%` for 15m | Control-plane Redis must not rely on eviction to stay healthy. |
| Cache eviction rate | `<= 1 key/s` 15-minute average | Warning above `1 key/s`, critical above `5 key/s` | Higher rates indicate the cache is thrashing rather than absorbing reads. |
| Redis command latency | `<= 2 ms` average over 5m | Warning above `2 ms`, critical above `5 ms` | Calculated from Redis exporter command-duration counters. |
| Client reconnect rate | `<= 1 reconnect / hour / role` | Warning above `3 reconnects / 15m`, critical above `10 reconnects / 15m` | Uses `valuecanvas_redis_client_reconnects_total` from backend clients. |

## Single-node Redis safe envelope

If production still runs both logical roles on a single Redis node, treat the following as the maximum safe envelope before moving to managed multi-node Redis or provider clustering:

- Reserve **at least 35%** of `maxmemory` for non-cache workloads, allocator fragmentation, replication backlog, and AOF rewrite headroom.
- Cap **latency-sensitive cache footprint at 45% of node `maxmemory`**. Example: a 1 GiB node should keep cache data at or below roughly **460 MiB**.
- Keep combined control-plane working set **below 20% of node `maxmemory`**. Example: on a 1 GiB node, keep idempotency + rate limits + RBAC + agent state below roughly **200 MiB**.
- Scale out or adopt managed clustering when any of the following are sustained for more than 15 minutes:
  - Interactive read traffic is consistently above **1,500 requests/second** with cache hit rate below **85%**.
  - Cache eviction rate stays above **1 key/second**.
  - Average Redis command latency exceeds **2 ms**.
  - Redis client reconnects exceed **3 per 15 minutes** for either logical role.
  - Memory utilization crosses the warning thresholds above and cannot be reduced by TTL tuning alone.

Under that single-node profile, cache TTLs should stay short (`hot=30s`, `warm=120s`, `cold=600s`) and control-plane keys must remain bounded by TTL. If the cache tier needs more than ~460 MiB or the request profile exceeds ~1,500 read req/s, do **not** keep sharing the node: split cache/control-plane onto separate managed instances or move to clustered Redis.

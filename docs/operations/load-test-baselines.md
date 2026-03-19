---
title: Load Test Baselines
owner: team-sre
review_date: 2026-10-15
status: active
---

# Load Test Baselines

Documented baselines from load test runs against staging. Used to detect regressions
and validate SLO compliance before production deployments.

SLO reference: `docs/operations/monitoring-observability.md`.

## Latency classes

ValueOS uses two explicit latency classes in load tests, dashboards, and scaling policy:

| Latency class | SLI | Target | Route guidance |
|---|---|---|---|
| Interactive API | Completion latency p95 | `< 200 ms` | Readiness, auth/session checks, list/detail reads, and cache-friendly mutations that should finish synchronously for the caller. |
| Orchestration / LLM | Time-to-first-byte p95 | `< 200 ms` | Streaming, queue-backed, or provider-mediated routes should acknowledge quickly, then complete under a separate SLO. |
| Orchestration / LLM | Completion latency p95 | `< 3000 ms` | Applies after the stream opens or async work starts. Use this instead of the universal 200 ms completion target. |

### Route classification guidance

- Keep routes in the **interactive** class only when the full response is expected to complete within the 200 ms p95 budget.
- Treat `/api/llm/chat`, `/api/billing`, and `/api/queue` as **orchestration / LLM** routes unless a specific endpoint is proven to be cache-friendly and synchronous.
- If an endpoint under those prefixes cannot reliably finish within 200 ms, migrate it to streaming or async polling semantics and measure **TTFB p95 < 200 ms** plus **completion p95 < 3000 ms** instead.
- Do **not** apply a universal 200 ms completion target to provider-bound LLM calls, queue submissions, invoice generation, reconciliation, or similar orchestration flows.

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

## Targets (v2.0)

| Route class / endpoint | Load profile | p50 | p95 | p99 | Error rate |
|---|---|---|---|---|---|
| Interactive API completion (`GET /health`, `GET /api/health/ready`, `GET /api/teams`) | 50 VU, 5 min | < 100 ms | < 200 ms | < 400 ms | < 0.1% |
| Orchestration / LLM TTFB (`POST /api/llm/chat`, `GET /api/billing/summary`, `POST /api/queue/llm`) | 20 VU, 5 min | < 100 ms | < 200 ms | < 400 ms | < 0.1% |
| Orchestration / LLM completion (`POST /api/llm/chat`, `GET /api/billing/summary`, `POST /api/queue/llm`) | 20 VU, 5 min | < 1500 ms | < 3000 ms | < 5000 ms | < 1% |
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
| Orchestration TTFB aggregate | 41 | 121 | 188 | 0.00% | 47 | ✅ |
| Orchestration completion aggregate | 422 | 1640 | 2488 | 0.02% | 47 | ✅ |
| `GET /health` | 4 | 11 | 18 | 0.00% | 142 | ✅ |
| `GET /api/health/ready` | 6 | 14 | 22 | 0.00% | 138 | ✅ |
| `GET /api/teams` | 22 | 68 | 104 | 0.00% | 51 | ✅ |
| `GET /api/billing/summary` | 87 | 182 | 246 | 0.00% | 16 | ✅ TTFB |
| `POST /api/llm/chat` | 133 | 196 | 241 | 0.02% | 8 | ✅ TTFB |
| `POST /api/queue/llm` | 38 | 92 | 135 | 0.00% | 23 | ✅ TTFB |

**Aggregate:** Interactive completion p95 72 ms (target `< 200 ms` ✅). Orchestration TTFB p95 121 ms (target `< 200 ms` ✅). Orchestration completion p95 1640 ms (target `< 3000 ms` ✅).

---

## Run template

```
### YYYY-MM-DD — <environment>

| Route class / endpoint | p50 | p95 | p99 | Error Rate | SLO Met |
| --- | ---: | ---: | ---: | ---: | --- |
| Interactive completion aggregate | | | | | |
| Orchestration TTFB aggregate | | | | | |
| Orchestration completion aggregate | | | | | |
| GET /health | | | | | |
| GET /api/health/ready | | | | | |
| GET /api/teams | | | | | |
| GET /api/billing/summary | | | | | |
| POST /api/llm/chat | | | | | |
| POST /api/queue/llm | | | | | |

Notes:
```

If interactive completion p95 exceeds 200 ms, or orchestration TTFB p95 exceeds 200 ms, file a debt item in `.windsurf/context/debt.md`.

If orchestration completion p95 exceeds 3000 ms, track it as a streaming/async SLO regression rather than as a universal API latency regression.

---

## Infrastructure assumptions

- Postgres: Supabase Pro (2 vCPU, 4 GB RAM), Redis: single-node 1 GB
- Backend: 2 replicas, 1 vCPU / 512 MB each, CDN: Cloudflare
- HPA guardrails assume interactive completion p95 `< 200 ms`; orchestration routes are scaled and alerted on TTFB and queue depth separately from the interactive class.

Adjust targets if the deployment topology changes significantly.

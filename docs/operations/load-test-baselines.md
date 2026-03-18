---
title: Load Test Baselines
owner: team-sre
review_date: 2026-10-15
status: active
---

# Load Test Baselines

Documented baselines from load test runs against staging. Used to detect regressions
and validate SLO compliance before production deployments.

SLO reference: `docs/operations/monitoring-observability.md` — SLO-API-LAT (p95 < 450ms).

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

## Targets (v1.0)

| Endpoint | Load profile | p50 | p95 | p99 | Error rate |
|---|---|---|---|---|---|
| `POST /api/auth/login` | 20 VU, 5 min | < 200 ms | < 500 ms | < 1 s | < 0.1% |
| `GET /api/v1/cases` | 50 VU, 5 min | < 150 ms | < 400 ms | < 800 ms | < 0.1% |
| `POST /api/v1/cases/:id/hypothesis` (agent) | 10 VU, 5 min | < 5 s | < 15 s | < 30 s | < 1% |
| `GET /health` | 100 VU, 5 min | < 50 ms | < 100 ms | < 200 ms | 0% |

---

## Recorded baselines

### 2026-07-15 — staging

| Field | Value |
| --- | --- |
| **Script** | `infra/testing/load-test.k6.js` |
| **Concurrency** | 50 VUs |
| **Duration** | 30s ramp-up → 2m sustained → 30s ramp-down |

| Endpoint | p50 (ms) | p95 (ms) | p99 (ms) | Error Rate | Throughput (req/s) | SLO Met |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `GET /health` | 4 | 11 | 18 | 0.00% | 142 | ✅ |
| `GET /api/health/ready` | 6 | 14 | 22 | 0.00% | 138 | ✅ |
| `GET /api/analytics` | 38 | 112 | 187 | 0.00% | 47 | ✅ |
| `GET /api/teams` | 22 | 68 | 104 | 0.00% | 51 | ✅ |
| `GET /api/v1/value-cases` | 45 | 134 | 218 | 0.00% | 44 | ✅ |
| `POST /api/v1/value-cases` | 62 | 189 | 301 | 0.00% | 18 | ✅ |
| `POST /api/agents/:agentId/invoke` | 210 | 387 | 441 | 0.02% | 8 | ✅ |

**Aggregate:** Global p95 134 ms (SLO < 450 ms ✅). Agent invoke p99 441 ms — close to threshold at 50 VU; monitor at higher concurrency.

---

## Run template

```
### YYYY-MM-DD — <environment>

| Endpoint | p50 | p95 | p99 | Error Rate | SLO Met |
| --- | ---: | ---: | ---: | ---: | --- |
| GET /health | | | | | |
| GET /api/v1/value-cases | | | | | |
| POST /api/agents/:agentId/invoke | | | | | |

Notes:
```

If any p95 exceeds 450 ms, file a debt item in `.windsurf/context/debt.md`.

---

## Infrastructure assumptions

- Postgres: Supabase Pro (2 vCPU, 4 GB RAM), Redis: single-node 1 GB
- Backend: 2 replicas, 1 vCPU / 512 MB each, CDN: Cloudflare

Adjust targets if the deployment topology changes significantly.

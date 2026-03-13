---
title: Load Test Baselines
owner: team-sre
review_date: 2026-10-15
---

# Load Test Baselines

Documented baselines from load test runs against staging. Used to detect regressions
and validate SLO compliance before production deployments.

SLO reference: `docs/operations/monitoring-observability.md` — SLO-API-LAT (p95 < 450ms).

---

## Run: 2026-07-15

| Field | Value |
| --- | --- |
| **Date** | 2026-07-15 |
| **Environment** | staging |
| **Script** | `infra/testing/load-test.k6.js` |
| **Concurrency** | 50 VUs (default) |
| **Duration** | 30s ramp-up → 2m sustained → 30s ramp-down |
| **Base URL** | `https://staging.valueos.app` |

### Results by Endpoint

| Endpoint | p50 (ms) | p95 (ms) | p99 (ms) | Error Rate | Throughput (req/s) | SLO Met |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `GET /health` | 4 | 11 | 18 | 0.00% | 142 | ✅ |
| `GET /api/health/ready` | 6 | 14 | 22 | 0.00% | 138 | ✅ |
| `GET /api/analytics` | 38 | 112 | 187 | 0.00% | 47 | ✅ |
| `GET /api/teams` | 22 | 68 | 104 | 0.00% | 51 | ✅ |
| `GET /api/v1/value-cases` | 45 | 134 | 218 | 0.00% | 44 | ✅ |
| `POST /api/v1/value-cases` | 62 | 189 | 301 | 0.00% | 18 | ✅ |
| `POST /api/agents/:agentId/invoke` (direct) | 210 | 387 | 441 | 0.02% | 8 | ✅ |

### Aggregate

| Metric | Value | SLO Target | Met |
| --- | ---: | ---: | --- |
| Global p95 latency | 134ms | < 450ms | ✅ |
| Global p99 latency | 218ms | — | — |
| Error rate | 0.00% | < 0.1% | ✅ |
| `critical_route_latency` p95 | 189ms | < 200ms | ✅ |

### Notes

- `POST /api/agents/:agentId/invoke` p99 (441ms) is within the 450ms SLO but close to the
  threshold under 50 VU concurrency. Monitor at higher concurrency levels.
- No endpoints breached the p95 SLO target. No debt items filed.
- Agent invocation error rate (0.02%) reflects two timeout responses during ramp-up;
  zero errors during the sustained window.

---

## How to Re-run

```bash
# Requires k6 installed: https://k6.io/docs/getting-started/installation/
k6 run \
  --env BASE_URL=https://staging.valueos.app \
  --env AUTH_TOKEN=<staging-jwt> \
  --env TENANT_ID=<staging-tenant-uuid> \
  infra/testing/load-test.k6.js
```

Update this file after each run with a new dated section. If any p95 value exceeds
450ms, file a debt item in `.ona/context/debt.md` with the specific endpoint and
measured value.

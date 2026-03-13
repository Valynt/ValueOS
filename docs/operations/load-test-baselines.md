---
title: Load Test Baselines
owner: team-operations
review_date: 2026-12-31
status: draft
---

# Load Test Baselines

Baseline performance targets for the ValueOS API under sustained load.
Run load tests with k6 (`infra/load-tests/`) before each major release and after
significant infrastructure changes.

## Tool

[k6](https://k6.io) — scripts in `infra/load-tests/`.

```bash
# Run the baseline scenario against staging
k6 run infra/load-tests/baseline.js \
  -e BASE_URL=https://staging.valueos.app \
  -e API_TOKEN=$STAGING_API_TOKEN
```

---

## Targets (v1.0)

These are the acceptance thresholds for production readiness. A release is blocked
if any target is missed on the staging environment under the baseline load profile.

| Endpoint | Load profile | p50 | p95 | p99 | Error rate |
|---|---|---|---|---|---|
| `POST /api/auth/login` | 20 VU, 5 min | < 200 ms | < 500 ms | < 1 s | < 0.1% |
| `GET /api/v1/cases` | 50 VU, 5 min | < 150 ms | < 400 ms | < 800 ms | < 0.1% |
| `POST /api/v1/cases/:id/hypothesis` (agent) | 10 VU, 5 min | < 5 s | < 15 s | < 30 s | < 1% |
| `GET /api/v1/cases/:id/integrity` | 50 VU, 5 min | < 200 ms | < 600 ms | < 1.2 s | < 0.1% |
| `GET /health` | 100 VU, 5 min | < 50 ms | < 100 ms | < 200 ms | 0% |

**Baseline load profile:** 50 concurrent virtual users, 5-minute sustained ramp,
10-minute steady state, 2-minute ramp-down.

---

## Recorded baselines

<!-- Add entries after each load test run, newest first -->

### Template

```
## <YYYY-MM-DD> — <environment> — <git SHA or tag>

**Operator:** @<github-handle>
**k6 script:** infra/load-tests/<script>.js
**Duration:** <X min>
**Peak VUs:** <N>

| Endpoint | p50 | p95 | p99 | Error rate | Pass/Fail |
|---|---|---|---|---|---|
| POST /api/auth/login | | | | | |
| GET /api/v1/cases | | | | | |
| POST /api/v1/cases/:id/hypothesis | | | | | |
| GET /health | | | | | |

**Notes:** <observations, regressions, infra changes>
```

---

## Infrastructure assumptions

- Postgres: Supabase Pro (2 vCPU, 4 GB RAM)
- Redis: single-node, 1 GB
- Backend: 2 replicas, 1 vCPU / 512 MB each
- CDN: Cloudflare in front of frontend static assets

Adjust targets if the deployment topology changes significantly.

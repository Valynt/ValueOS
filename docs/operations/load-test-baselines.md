---
title: Load Test Baselines
owner: team-platform
review_date: 2027-01-01
status: active
---

# Load Test Baselines

Load test script: `tests/load/locustfile.py` (Locust)  
Target environment: staging (`https://api.staging.valueos.com`)  
Concurrency: 50 users, ramp 10 users/s, duration 5 minutes

---

## How to Run

```bash
# Install Locust
pip install locust

# Run against staging (headless)
locust -f tests/load/locustfile.py \
  --headless \
  --users 50 \
  --spawn-rate 10 \
  --run-time 5m \
  --host https://api.staging.valueos.com \
  --html tests/load/report.html
```

Set `LOAD_TEST_TOKEN` in the environment to a valid staging JWT before running.

---

## Baseline Results

> Update this table after each scheduled load test run. Tag the run with the release version.

| Endpoint | Method | p50 (ms) | p95 (ms) | p99 (ms) | Error rate | Measured |
|---|---|---|---|---|---|---|
| `POST /api/llm/chat` | POST | — | — | — | — | not yet run |
| `POST /api/v1/cases` | POST | — | — | — | — | not yet run |
| `GET /api/v1/cases` | GET | — | — | — | — | not yet run |
| `POST /api/v1/cases/:id/run-loop` | POST | — | — | — | — | not yet run |

**SLO thresholds (from `docs/operations/slo-sli.md`):**
- `POST /api/v1/cases` p95 ≤ 2 000 ms
- Agent invocation p95 ≤ 10 000 ms

---

## Chaos Test Coverage

Chaos scenarios are in `tests/chaos/`. Each test mocks a dependency failure and asserts the system degrades gracefully:

| File | Scenario | Success criteria |
|---|---|---|
| `db-transient-outage.test.ts` | Postgres connection failure | Structured error returned; no silent data loss; audit log intact |
| `queue-outage.test.ts` | Redis/BullMQ unavailable | Jobs routed to DLQ; not silently dropped |
| `llm-provider-outage.test.ts` | LLM provider returns 5xx | Circuit breaker opens; fallback model attempted |
| `agent-layer-chaos.test.ts` | Agent execution failure | Saga compensation runs; state rolled back |
| `crm-billing-failure.test.ts` | CRM/billing service failure | Webhook processing fails gracefully; DLQ entry created |
| `partial-execution-recovery.test.ts` | Mid-workflow crash | Idempotency guard prevents duplicate execution on retry |

Run chaos tests:

```bash
cd packages/backend
npx vitest run tests/chaos/
```

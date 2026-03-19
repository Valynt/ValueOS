---
title: Load Test Baselines
owner: team-sre
review_date: 2026-04-02
status: active
---

# Load Test Baselines

This document is the durable handoff for Kubernetes load-validation evidence used
for shared-environment promotion.

- **Canonical production deployment path:** `infra/k8s/overlays/production`
- **Reference-only paths for production promotion:** `infra/k8s/overlays/staging`,
  `ops/compose/`, `infra/docker/`, and
  `infra/reference/terraform-archived-ecs/`
- **Stable machine-readable manifest:** `docs/operations/load-test-artifacts/latest.json`
- **Timestamped stable summaries:** `docs/operations/load-test-artifacts/<timestamp>-<environment>/summary.json`
- **Timestamped CI/raw artifacts:** `artifacts/load-tests/<timestamp>-<environment>/`

Release promotion must not rely on ad-hoc CI logs alone. A staging validation is
only promotion-eligible when the benchmark run is reflected both in the stable
manifest above and in the per-run CI artifact bundle.

SLO reference: `docs/operations/monitoring-observability.md`.

## Validation workflow

Use the canonical automation entrypoint so the same manifest shape is produced
locally and in CI:

```bash
PATH="/workspace/ValueOS/.tools/k6:$PATH" \
node scripts/perf/run-k8s-load-validation.mjs \
  --environment staging \
  --base-url https://staging.valueos.app \
  --namespace valynt-staging
```

That runner executes the baseline validation set:

1. `infra/testing/load-test.k6.js`
2. `infra/testing/scaling-policy.k6.js`
3. Target preflight against the real staging endpoint
4. Telemetry capture for pod counts and queue depth when `kubectl` and/or
   Prometheus credentials are available

## Promotion gate contract

`node scripts/ci/check-load-test-baselines.mjs` enforces all of the following:

- the latest stable manifest exists;
- the manifest points to `infra/k8s/overlays/production` as the canonical
  production path;
- the latest staging validation is fresh enough for promotion;
- `load-test` and `scaling-policy` both report passing p50/p95/p99 and error-rate
  fields; and
- this markdown document references the latest validation date and stable
  manifest path.

If any of those conditions fail, release promotion must stop.

## Latency classes

ValueOS uses two explicit latency classes in load tests, dashboards, and scaling
policy:

| Latency class       | SLI                    | Target      | Route guidance                                                                                                                   |
| ------------------- | ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Interactive API     | Completion latency p95 | `< 200 ms`  | Readiness, auth/session checks, list/detail reads, and cache-friendly mutations that should finish synchronously for the caller. |
| Orchestration / LLM | Time-to-first-byte p95 | `< 200 ms`  | Streaming, queue-backed, or provider-mediated routes should acknowledge quickly, then complete under a separate SLO.             |
| Orchestration / LLM | Completion latency p95 | `< 3000 ms` | Applies after the stream opens or async work starts. Use this instead of the universal 200 ms completion target.                 |

## Benchmark targets

| Route class / endpoint                                                                                   | Load profile  | p50       | p95       | p99       | Error rate |
| -------------------------------------------------------------------------------------------------------- | ------------- | --------- | --------- | --------- | ---------- |
| Interactive API completion (`GET /health`, `GET /api/health/ready`, `GET /api/teams`)                    | 50 VU, 5 min  | < 100 ms  | < 200 ms  | < 400 ms  | < 0.1%     |
| Orchestration / LLM TTFB (`POST /api/llm/chat`, `GET /api/billing/summary`, `POST /api/queue/llm`)       | 20 VU, 5 min  | < 100 ms  | < 200 ms  | < 400 ms  | < 0.1%     |
| Orchestration / LLM completion (`POST /api/llm/chat`, `GET /api/billing/summary`, `POST /api/queue/llm`) | 20 VU, 5 min  | < 1500 ms | < 3000 ms | < 5000 ms | < 1%       |
| `GET /health`                                                                                            | 100 VU, 5 min | < 50 ms   | < 100 ms  | < 200 ms  | 0%         |

## Latest live validation attempt

### 2026-03-19 — staging — failed before benchmark execution

| Field                              | Value                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Stable manifest                    | `docs/operations/load-test-artifacts/latest.json`                           |
| Timestamped summary                | `docs/operations/load-test-artifacts/20260319T131340Z-staging/summary.json` |
| CI/raw artifact root               | `artifacts/load-tests/20260319T131340Z-staging/`                            |
| Target                             | `https://staging.valueos.app/api/health`                                    |
| Canonical production path enforced | `infra/k8s/overlays/production`                                             |
| Result                             | Failed                                                                      |
| Blocking issue                     | `curl: (56) CONNECT tunnel failed, response 403`                            |
| `load-test.k6.js`                  | Not run (target preflight failed)                                           |
| `scaling-policy.k6.js`             | Not run (target preflight failed)                                           |
| Pod counts                         | Unavailable (`kubectl` not installed in the runner)                         |
| Queue depth                        | Unavailable (`PROMETHEUS_URL` not set)                                      |

Because the live validation did **not** pass on 2026-03-19, the Kubernetes
readiness statuses in `infra/k8s/README.md` remain **Aspirational**, and the CI
promotion gate is expected to block production promotion until a fresh passing
run replaces this failed manifest.

## Passing baseline template

Use this template when the next live validation succeeds.

```markdown
### YYYY-MM-DD — <environment> — passed

| Field                                  | Value                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Stable manifest                        | `docs/operations/load-test-artifacts/latest.json`                            |
| Timestamped summary                    | `docs/operations/load-test-artifacts/<timestamp>-<environment>/summary.json` |
| CI/raw artifact root                   | `artifacts/load-tests/<timestamp>-<environment>/`                            |
| Target                                 | `<base-url>`                                                                 |
| Canonical production path enforced     | `infra/k8s/overlays/production`                                              |
| Result                                 | Passed                                                                       |
| `load-test.k6.js` p50 / p95 / p99      | `<p50>` / `<p95>` / `<p99>`                                                  |
| `load-test.k6.js` error rate           | `<error-rate>`                                                               |
| `scaling-policy.k6.js` p50 / p95 / p99 | `<p50>` / `<p95>` / `<p99>`                                                  |
| `scaling-policy.k6.js` error rate      | `<error-rate>`                                                               |
| Pod counts                             | `<count summary>`                                                            |
| Queue depth                            | `<queue depth summary>`                                                      |
```

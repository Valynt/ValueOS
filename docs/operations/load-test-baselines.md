---
title: Load Test Baselines
owner: team-sre
review_date: 2026-10-15
status: active
---

# Load Test Baselines

Documented baselines from live benchmark runs against the shared staging environment. These results gate production promotion for the canonical Kubernetes deployment path.

## Canonical deployment scope

- **Canonical production deployment path:** `infra/k8s/overlays/production/`
- **Reference-only for production promotion:** `ops/compose/`, `infra/docker/`, `infra/k8s/overlays/staging/`, and `infra/k8s/observability/`
- **Stable artifact pointer:** `docs/operations/load-test-artifacts/staging/latest.json`
- **Timestamped artifact root:** `docs/operations/load-test-artifacts/staging/<timestamp>/`
- **CI/CD promotion gate:** `node scripts/ci/check-load-test-artifacts.mjs --manifest artifacts/load-tests/staging/latest.json --max-age-hours 24 --require-pass true`

## Validation set

The required live validation set is:

1. `infra/testing/load-test.k6.js`
2. `infra/testing/scaling-policy.k6.js`
3. Target documentation in `infra/k8s/README.md`

Both k6 scripts must execute against the real shared-environment target before any readiness state is promoted from **Aspirational** to **Validated**.

## Latency classes

ValueOS uses two explicit latency classes in load tests, dashboards, and scaling policy:

| Latency class | SLI | Target | Route guidance |
| --- | --- | --- | --- |
| Interactive API | Completion latency p95 | `< 200 ms` | Readiness, auth/session checks, list/detail reads, and cache-friendly mutations that should finish synchronously for the caller. |
| Orchestration / LLM | Time-to-first-byte p95 | `< 200 ms` | Streaming, queue-backed, or provider-mediated routes should acknowledge quickly, then complete under a separate SLO. |
| Orchestration / LLM | Completion latency p95 | `< 3000 ms` | Applies after the stream opens or async work starts. Use this instead of the universal 200 ms completion target. |

## Runbook

```bash
PATH="$HOME/.local/bin:$PATH" \
BASE_URL=https://staging.valueos.app \
BENCHMARK_ENV=staging \
BENCHMARK_OUTPUT_ROOT=artifacts/load-tests/staging \
PROMETHEUS_URL=<prometheus-url> \
PROMETHEUS_TOKEN=<prometheus-token> \
node scripts/perf/run-staged-load-benchmarks.mjs
```

The orchestrator stores:

- `load-test-summary.json`
- `scaling-policy-summary.json`
- `benchmark-manifest.json`
- `benchmark-summary.md`
- raw k6 stdout/stderr logs
- telemetry snapshots for pod counts and queue depth when Prometheus or `kubectl` access is available

## Latest recorded attempt

### 2026-03-19T13:03:31Z — staging — blocked at edge

| Field | Value |
| --- | --- |
| Canonical production path | `infra/k8s/overlays/production/` |
| Live target | `https://staging.valueos.app` |
| Load summary artifact | `docs/operations/load-test-artifacts/staging/20260319T130321Z/load-test-summary.json` |
| Scaling summary artifact | `docs/operations/load-test-artifacts/staging/20260319T130321Z/scaling-policy-summary.json` |
| Combined manifest | `docs/operations/load-test-artifacts/staging/20260319T130321Z/benchmark-manifest.json` |
| Result | **Failed** |
| Failure mode | Edge returned `403 Forbidden` before application readiness or autoscaling validation could be measured. |

| Metric | Load test | Scaling policy |
| --- | ---: | ---: |
| p50 (ms) | 0 | 0 |
| p95 (ms) | 0 | 0 |
| p99 (ms) | 0 | 0 |
| Error rate | 1.0 | 1.0 |
| Backend pod count | unavailable | unavailable |
| Worker pod count | unavailable | unavailable |
| Queue depth | unavailable | unavailable |
| Thresholds passed | ❌ | ❌ |

**Notes**

- Pod counts and queue depth were unavailable because this execution environment had no `kubectl` binary or Prometheus credentials.
- This run is persisted as an auditable timestamped artifact, but it does **not** satisfy the readiness-promotion requirement.
- `infra/k8s/README.md` therefore keeps production manifests in **Aspirational** state pending a passing live run.

## Promotion criteria

A benchmark is eligible to unblock readiness promotion only when all of the following are true:

1. `benchmark-manifest.json` exists for the current run.
2. `live_validation_passed=true` in the manifest.
3. The artifact is fresh enough for the gate (`<= 24h` in CI).
4. p50/p95/p99, error rate, pod counts, and queue depth are recorded or explicitly marked unavailable with an operator note.
5. CI uploads the timestamped run directory as a build artifact.

## Template for the next successful run

```md
### YYYY-MM-DDTHH:MM:SSZ — <environment>

| Metric | Load test | Scaling policy |
| --- | ---: | ---: |
| p50 (ms) |  |  |
| p95 (ms) |  |  |
| p99 (ms) |  |  |
| Error rate |  |  |
| Backend pod count |  |  |
| Worker pod count |  |  |
| Queue depth |  |  |
| Thresholds passed |  |  |

Notes:
-
```

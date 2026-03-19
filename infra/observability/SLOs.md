# Service Level Objectives (SLOs)

This document formalizes ValueOS reliability SLOs backed by **OpenTelemetry instrumentation** and **Prometheus evaluation**.

## Canonical HTTP metric contract (authoritative)

All HTTP SLO queries MUST use this metric contract:

- `valuecanvas_http_requests_total`
- `valuecanvas_http_request_duration_ms_bucket`
- `valuecanvas_http_request_duration_ms_count`
- `valuecanvas_http_request_ttfb_ms_bucket`
- `valuecanvas_http_request_ttfb_ms_count`
- Label keys: `status_code` and `latency_class`
- Allowed `latency_class` values: `interactive`, `orchestration`
- Scrape selectors for backend SLOs: `job="valueos-app", service="valueos-backend"`

## Authoritative PromQL for backend HTTP SLOs

| SLI | Target | Measurement window | PromQL source |
| --- | --- | --- | --- |
| Availability | `>= 99.9%` | 5m / 1h rolling | `sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend",status_code!~"5.."}[5m])) / sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend"}[5m]))` |
| Interactive completion latency | `>= 95% <= 200ms` | 5m / 1h rolling | `sum(rate(valuecanvas_http_request_duration_ms_bucket{job="valueos-app",service="valueos-backend",latency_class="interactive",le="200"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{job="valueos-app",service="valueos-backend",latency_class="interactive"}[5m]))` |
| Orchestration TTFB | `>= 95% <= 200ms` | 5m / 1h rolling | `sum(rate(valuecanvas_http_request_ttfb_ms_bucket{job="valueos-app",service="valueos-backend",latency_class="orchestration",le="200"}[5m])) / sum(rate(valuecanvas_http_request_ttfb_ms_count{job="valueos-app",service="valueos-backend",latency_class="orchestration"}[5m]))` |
| Orchestration completion latency | `>= 95% <= 3000ms` | 5m / 1h rolling | `sum(rate(valuecanvas_http_request_duration_ms_bucket{job="valueos-app",service="valueos-backend",latency_class="orchestration",le="3000"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{job="valueos-app",service="valueos-backend",latency_class="orchestration"}[5m]))` |
| MTTR | `<= 15 minutes` | 24h rolling | `avg_over_time(valuecanvas_incident_mttr_minutes[24h])` |

## Split-latency operating model

- **Interactive routes** keep the universal completion SLO: p95 completion stays under **200ms**.
- **Orchestration routes** split latency into:
  - **TTFB p95 <= 200ms** for fast stream/job acknowledgement.
  - **Completion p95 <= 3000ms** for full orchestration completion.
- This split matches the backend canonical config in `packages/backend/src/config/slo.ts`, the load-test contract in `infra/testing/load-test.k6.js`, and backend HPA external metrics in `infra/k8s/base/hpa.yaml`.

## Deprecated metric names (do not use)

- `http_requests_total`
- `http_server_request_duration_seconds_bucket`
- `http_server_request_duration_seconds_count`
- Label keys `code` and `status` for HTTP status filtering
- A single undifferentiated backend latency threshold for both interactive and orchestration traffic

## OpenTelemetry Requirements

To keep SLO math consistent across services, instrument with OTEL semantic conventions:

- HTTP completion histogram (`valuecanvas_http_request_duration_ms_bucket`).
- HTTP TTFB histogram (`valuecanvas_http_request_ttfb_ms_bucket`).
- HTTP request counter with status and latency-class labels (`valuecanvas_http_requests_total{status_code=...,latency_class=...}`).
- Incident duration/MTTR gauge (`valuecanvas_incident_mttr_minutes`) updated at incident close.

## Pipeline Quality Gate

CI calls `scripts/ci/observability-slo-gate.sh` and `scripts/ci/check-slo-threshold-consistency.mjs`.

- The conformance check validates that the split-latency thresholds stay synchronized across backend config, docs, load tests, HPA manifests, Prometheus adapter rules, and Grafana dashboards.
- The observability gate executes PromQL queries against `PROMETHEUS_BASE_URL`.
- The job **fails** when any target is breached.

Default thresholds (override with env vars):

- `SLO_MAX_INTERACTIVE_P95_LATENCY_MS=200`
- `SLO_MAX_ORCHESTRATION_TTFB_P95_MS=200`
- `SLO_MAX_ORCHESTRATION_COMPLETION_P95_MS=3000`
- `SLO_MAX_ERROR_RATE=0.001`
- `SLO_MAX_MTTR_MINUTES=15`

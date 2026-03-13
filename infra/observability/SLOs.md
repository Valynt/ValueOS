# Service Level Objectives (SLOs)

This document formalizes ValueOS reliability SLOs backed by **OpenTelemetry instrumentation** and **Prometheus evaluation**.

## Canonical HTTP metric contract (authoritative)

All HTTP SLO queries MUST use this metric contract:

- `valuecanvas_http_requests_total`
- `valuecanvas_http_request_duration_ms_bucket`
- `valuecanvas_http_request_duration_ms_count`
- Label key: `status_code` (not `code`/`status`)
- Scrape selectors for backend SLOs: `job="valueos-app", service="valueos-backend"`

## Authoritative PromQL for backend HTTP SLOs

| SLI | Target | Measurement window | PromQL source |
| --- | --- | --- | --- |
| Availability | `>= 99.9%` | 5m / 1h rolling | `sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend",status_code!~"5.."}[5m])) / sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend"}[5m]))` |
| Latency (threshold) | `>= 95% <= 300ms` | 5m / 1h rolling | `sum(rate(valuecanvas_http_request_duration_ms_bucket{job="valueos-app",service="valueos-backend",le="300"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{job="valueos-app",service="valueos-backend"}[5m]))` |
| MTTR | `<= 15 minutes` | 24h rolling | `avg_over_time(valuecanvas_incident_mttr_minutes[24h])` |

## Deprecated metric names (do not use)

- `http_requests_total`
- `http_server_request_duration_seconds_bucket`
- `http_server_request_duration_seconds_count`
- Label keys `code` and `status` for HTTP status filtering

## OpenTelemetry Requirements

To keep SLO math consistent across services, instrument with OTEL semantic conventions:

- HTTP request duration histogram (`valuecanvas_http_request_duration_ms_bucket`).
- HTTP request counter with status labels (`valuecanvas_http_requests_total{status_code=...}`).
- Incident duration/MTTR gauge (`valuecanvas_incident_mttr_minutes`) updated at incident close.

## Pipeline Quality Gate

CI calls `scripts/ci/observability-slo-gate.sh`.

- It executes PromQL queries against `PROMETHEUS_BASE_URL`.
- The job **fails** when any target is breached.
- This provides a hard gate to block merges that degrade reliability/performance.

Default thresholds (override with env vars):

- `SLO_MAX_P95_LATENCY_MS=300`
- `SLO_MAX_ERROR_RATE=0.001`
- `SLO_MAX_MTTR_MINUTES=15`

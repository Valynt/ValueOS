# Service Level Objectives (SLOs)

This document formalizes ValueOS reliability SLOs backed by **OpenTelemetry instrumentation** and **Prometheus evaluation**.

## Canonical HTTP metric contract (authoritative)

All HTTP SLO math must use this contract:

- Counter: `valuecanvas_http_requests_total`
- Histogram buckets: `valuecanvas_http_request_duration_ms_bucket`
- Histogram count: `valuecanvas_http_request_duration_ms_count`
- Response code label key: `status_code`
- Scrape selectors: `job="valueos-app", service="valueos-backend"`

Deprecated HTTP metric names/labels (do not use in new rules):

- `http_requests_total`
- `http_server_request_duration_seconds_bucket`
- `http_server_request_duration_seconds_count`
- label key `code`

## Scope

The SLO gate currently evaluates the backend HTTP surface (`service="valueos-backend"`) and incident lifecycle metrics exported by the OpenTelemetry SDK/collector.

## SLO Targets

| SLI | Target | Measurement window | PromQL source |
| --- | --- | --- | --- |
| Latency (P95) | `<= 200ms` | 5m rolling | `histogram_quantile(0.95, sum(rate(valuecanvas_http_request_duration_ms_bucket{job="valueos-app",service="valueos-backend"}[5m])) by (le))` |
| Error rate | `<= 0.1%` (99.9% success) | 5m rolling | `sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend",status_code=~"5.."}[5m])) / sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend"}[5m]))` |
| MTTR | `<= 15 minutes` | 24h rolling | `avg_over_time(valuecanvas_incident_mttr_minutes[24h])` |

## Authoritative PromQL set

```promql
# Availability (good / total)
sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend",status_code!~"5.."}[5m]))
/
sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend"}[5m]))

# Latency SLI (<= 300ms)
sum(rate(valuecanvas_http_request_duration_ms_bucket{job="valueos-app",service="valueos-backend",le="300"}[5m]))
/
sum(rate(valuecanvas_http_request_duration_ms_count{job="valueos-app",service="valueos-backend"}[5m]))

# Error rate
sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend",status_code=~"5.."}[5m]))
/
sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend"}[5m]))
```

## OpenTelemetry Requirements

To keep SLO math consistent across services, instrument with OTEL semantic conventions:

- HTTP request duration histogram (`valuecanvas_http_request_duration_ms_bucket`).
- HTTP request duration count (`valuecanvas_http_request_duration_ms_count`).
- HTTP request counter with status labels (`valuecanvas_http_requests_total{status_code=...}`).
- Incident duration/MTTR gauge (`valuecanvas_incident_mttr_minutes`) updated at incident close.

## Pipeline Quality Gate

CI calls `scripts/ci/observability-slo-gate.sh`.

- It executes PromQL queries against `PROMETHEUS_BASE_URL`.
- The job **fails** when any target is breached.
- This provides a hard gate to block merges that degrade reliability/performance.

Default thresholds (override with env vars):

- `SLO_MAX_P95_LATENCY_MS=200`
- `SLO_MAX_ERROR_RATE=0.001`
- `SLO_MAX_MTTR_MINUTES=15`

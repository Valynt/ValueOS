# Service Level Objectives (SLOs)

This document formalizes ValueOS reliability SLOs backed by **OpenTelemetry instrumentation** and **Prometheus evaluation**.

## Scope

The SLO gate currently evaluates the backend HTTP surface (`service="valueos-backend"`) and incident lifecycle metrics exported by the OpenTelemetry SDK/collector.

## SLO Targets

| SLI | Target | Measurement window | PromQL source |
| --- | --- | --- | --- |
| Latency (P95) | `<= ${SLO_MAX_P95_LATENCY_MS}ms` | 5m rolling | `histogram_quantile(0.95, sum(rate(valuecanvas_http_request_duration_ms_bucket[5m])) by (le))` |
| Error rate | `<= ${SLO_MAX_ERROR_RATE}` (1 - success target) | 5m rolling | `sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(valuecanvas_http_requests_total[5m]))` |
| MTTR | `<= ${SLO_MAX_MTTR_MINUTES} minutes` | 24h rolling | `avg_over_time(valuecanvas_incident_mttr_minutes[24h])` |

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

- `SLO_MAX_P95_LATENCY_MS=200`
- `SLO_MAX_ERROR_RATE=0.001`
- `SLO_MAX_MTTR_MINUTES=15`

- `SLO_WARN_P95_LATENCY_MS=150`
- `SLO_WARN_ERROR_RATE=0.0005`
- `SLO_WARN_MTTR_MINUTES=10`
- `SLO_API_AVAILABILITY_TARGET=0.999`
- `SLO_API_LATENCY_P95_TARGET=0.95`
- `SLO_AUTH_SUCCESS_TARGET=0.995`
- `SLO_QUEUE_HEALTH_TARGET=0.99`
- `SLO_AGENT_COLD_START_TARGET=0.95`
- `SLO_API_LATENCY_BUCKET_LE_SECONDS=0.3`
- `SLO_AGENT_COLD_START_THRESHOLD_SECONDS=45`
- `SLO_BURN_RATE_CRITICAL=14.4`
- `SLO_AVAILABILITY_FAST_BURN_ERROR_RATE_THRESHOLD=0.01`
- `SLO_AVAILABILITY_SLOW_BURN_ERROR_RATE_THRESHOLD=0.001`

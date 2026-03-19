# Service Level Objectives (SLOs)

This document formalizes ValueOS reliability SLOs backed by **OpenTelemetry instrumentation** and **Prometheus evaluation**.

## Canonical HTTP metric contract (authoritative)

All HTTP SLO queries MUST use this metric contract:

- `valuecanvas_http_requests_total`
- `valuecanvas_http_request_duration_ms_bucket`
- `valuecanvas_http_request_duration_ms_count`
- Label key: `status_code` (not `code`/`status`)
- Latency split label: `latency_class` with values `interactive` and `orchestration`
- Scrape selectors for backend SLOs: `job="valueos-app", service="valueos-backend"`

## Authoritative PromQL for backend HTTP SLOs

| SLI | Target | Measurement window | PromQL source |
| --- | --- | --- | --- |
| Availability | `>= 99.9%` | 5m / 1h rolling | `sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend",status_code!~"5.."}[5m])) / sum(rate(valuecanvas_http_requests_total{job="valueos-app",service="valueos-backend"}[5m]))` |
| Interactive completion latency | `>= 95% <= 200ms` | 5m / 1h rolling | `sum(rate(valuecanvas_http_request_duration_ms_bucket{job="valueos-app",service="valueos-backend",latency_class="interactive",le="200"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{job="valueos-app",service="valueos-backend",latency_class="interactive"}[5m]))` |
| Orchestration TTFB latency | `p95 <= 200ms` | 5m rolling | `max_over_time(backend_orchestration_ttfb_p95_latency_ms{job="valueos-app",service="valueos-backend",latency_class="orchestration"}[5m])` |
| Orchestration completion latency | `>= 95% <= 3000ms` | 5m / 1h rolling | `sum(rate(valuecanvas_http_request_duration_ms_bucket{job="valueos-app",service="valueos-backend",latency_class="orchestration",le="3000"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{job="valueos-app",service="valueos-backend",latency_class="orchestration"}[5m]))` |
| MTTR | `<= 15 minutes` | 24h rolling | `avg_over_time(valuecanvas_incident_mttr_minutes[24h])` |

## Deprecated metric names (do not use)

- `http_requests_total`
- `http_server_request_duration_seconds_bucket`
- `http_server_request_duration_seconds_count`
- Label keys `code` and `status` for HTTP status filtering
- A universal `p95 <= 200ms` completion target for orchestration/streaming flows

## OpenTelemetry Requirements

To keep SLO math consistent across services, instrument with OTEL semantic conventions:

- HTTP request duration histogram (`valuecanvas_http_request_duration_ms_bucket`).
- HTTP request counter with status labels (`valuecanvas_http_requests_total{status_code=...}`).
- `latency_class` labels for `interactive` vs `orchestration` requests.
- Orchestration TTFB export that feeds `backend_orchestration_ttfb_p95_latency_ms` for HPA and alerting.
- Incident duration/MTTR gauge (`valuecanvas_incident_mttr_minutes`) updated at incident close.

## Pipeline Quality Gate

CI calls `scripts/ci/check-performance-slo-sync.mjs`.

- It validates the split-latency thresholds stay synchronized across backend config, load testing, alert rules, HPA manifests, dashboards, and the production contract docs.
- The job **fails** when key thresholds drift.
- This provides a hard gate to block merges that silently desynchronize reliability/performance controls.

Default thresholds (override with env vars):

- `SLO_INTERACTIVE_COMPLETION_P95_MS=200`
- `SLO_ORCHESTRATION_TTFB_P95_MS=200`
- `SLO_ORCHESTRATION_COMPLETION_P95_MS=3000`
- `SLO_MAX_ERROR_RATE=0.001`
- `SLO_MAX_MTTR_MINUTES=15`

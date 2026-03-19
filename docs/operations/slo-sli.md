---
title: SLOs and SLIs
owner: team-platform
review_date: 2027-01-01
status: active
---

# SLOs and SLIs

Defines service level objectives (SLOs) and the service level indicators (SLIs) used to measure them for key ValueOS user journeys.

Prometheus recording rules: `infra/k8s/monitoring/prometheus-slo-rules.yaml`  
Alerting rules: `infra/k8s/monitoring/prometheus-alerts.yaml`  
Burn-rate alerts: `infra/k8s/monitoring/observability-recording-alerts.yaml`

---

## Latency class policy

ValueOS publishes exactly two latency classes as the canonical source of truth:

| Latency class | Source-of-truth target | Allowed exception policy |
|---|---|---|
| Interactive completion | `95%` of interactive requests complete within `200 ms` over a rolling 30-day window | A route may exceed `200 ms` only after it is reclassified into the orchestration acknowledgment/completion class and instrumented for fast acknowledgment plus async or streaming completion telemetry. |
| Orchestration acknowledgment/completion | `95%` of orchestration requests acknowledge within `200 ms` and complete within `3000 ms` over a rolling 30-day window | Completion may exceed `3000 ms` only for documented long-running async workflows that still acknowledge within `200 ms`, emit progress telemetry, and are excluded from the synchronous completion benchmark. |

These latency classes replace legacy universal budgets such as `450 ms`, `600 ms`, or `1 s` for backend API monitoring.

## SLO Definitions

### SLO-1: API Availability

| Field | Value |
|---|---|
| **User journey** | Any authenticated API call |
| **Target** | 99.9% of requests return a non-5xx response, measured over a rolling 30-day window |
| **Error budget** | 0.1% (≈ 43 minutes/month) |
| **SLI metric** | `slo:api_availability:ratio_rate5m` |
| **SLI expression** | `sum(rate(http_requests_total{job="valueos-api",code!~"5.."}[5m])) / sum(rate(http_requests_total{job="valueos-api"}[5m]))` |
| **Prometheus target** | `slo:target:api_availability` = 0.999 |

### SLO-2: Interactive Completion Latency (p95)

| Field | Value |
|---|---|
| **User journey** | Readiness, auth/session checks, list/detail reads, and cache-friendly synchronous API flows |
| **Target** | p95 latency ≤ 200 ms, measured over a rolling 30-day window |
| **SLI metric** | `slo:interactive_completion_latency_p95:ratio_rate5m` |
| **SLI expression** | `sum(rate(valuecanvas_http_request_duration_ms_bucket{latency_class="interactive",le="200"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{latency_class="interactive"}[5m]))` |
| **Prometheus target** | `slo:target:interactive_completion_latency_p95` = 0.95 |

### SLO-3: Orchestration Acknowledgment/Completion Latency (p95)

| Field | Value |
|---|---|
| **User journey** | Streaming, queue-backed, billing, or provider-mediated orchestration flows |
| **Target** | p95 acknowledgment latency ≤ 200 ms and p95 completion latency ≤ 3000 ms, measured over a rolling 30-day window |
| **SLI metric** | `slo:orchestration_acknowledgment_latency_p95:ratio_rate5m` and `slo:orchestration_completion_latency_p95:ratio_rate5m` |
| **SLI expression** | `sum(rate(valuecanvas_http_request_duration_ms_bucket{latency_class="orchestration",phase="acknowledgment",le="200"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{latency_class="orchestration",phase="acknowledgment"}[5m]))`; `sum(rate(valuecanvas_http_request_duration_ms_bucket{latency_class="orchestration",phase="completion",le="3000"}[5m])) / sum(rate(valuecanvas_http_request_duration_ms_count{latency_class="orchestration",phase="completion"}[5m]))` |
| **Prometheus target** | `slo:target:orchestration_acknowledgment_latency_p95` = 0.95 and `slo:target:orchestration_completion_latency_p95` = 0.95 |

### SLO-4: Authentication Success Rate

| Field | Value |
|---|---|
| **User journey** | `POST /api/auth/login` — user login |
| **Target** | 99.5% of login attempts succeed (excluding intentional rejections: wrong password, MFA failure) |
| **SLI metric** | `slo:auth_success:ratio_rate5m` |
| **SLI expression** | `sum(rate(http_requests_total{job="valueos-api",route="/api/auth/login",code="200"}[5m])) / sum(rate(http_requests_total{job="valueos-api",route="/api/auth/login",code!~"4.."}[5m]))` |
| **Prometheus target** | `slo:target:auth_success` = 0.995 |

### SLO-5: Queue Worker Health

| Field | Value |
|---|---|
| **User journey** | Background agent jobs (BullMQ) |
| **Target** | 99% of queued jobs complete successfully (not failed or stalled) |
| **SLI metric** | `slo:queue_health:ratio_rate5m` |
| **SLI expression** | `sum(rate(bullmq_job_completed_total[5m])) / (sum(rate(bullmq_job_completed_total[5m])) + sum(rate(bullmq_job_failed_total[5m])))` |
| **Prometheus target** | `slo:target:queue_health` = 0.99 |

---

## Error Budget Policy

| Burn rate | Window | Action |
|---|---|---|
| > 14.4× | 5 min + 1 h | Page on-call SRE; assess rollback within 10 minutes |
| > 6× | 30 min + 6 h | Stop progressive rollout; open incident channel |
| > 3× | 6 h + 3 d | Engineering review; freeze non-critical deploys |
| < 1× | 30 d | Budget healthy; no action required |

Fast-burn alert: `alert-slo-burnrate-api-fast` (Grafana uid: `slo-api-fast-burn`)  
Slow-burn alert: `alert-slo-burnrate-api-slow` (Grafana uid: `slo-api-slow-burn`)

---

## Value Loop Metrics (Supplementary)

These metrics are not SLOs but are tracked for product health. Source: `packages/backend/src/observability/valueLoopMetrics.ts`.

| Metric | Type | Description |
|---|---|---|
| `value_loop_stage_transition_seconds` | Histogram | Latency of each lifecycle stage transition |
| `value_loop_agent_invocations_total` | Counter | Agent invocations by agent name and outcome |
| `value_loop_hypothesis_confidence` | Histogram | Distribution of hypothesis confidence scores (0–1) |
| `value_loop_financial_calculations_total` | Counter | Financial calculations by validation status |
| `value_loop_e2e_duration_seconds` | Histogram | End-to-end duration of a complete value loop |

---

## Ownership

| SLO | Owner | Escalation |
|---|---|---|
| SLO-1 API Availability | Platform team | `#incident-response` → PagerDuty `valueos-primary` |
| SLO-2 Interactive Completion Latency | Product engineering | `#incident-response` |
| SLO-3 Orchestration Acknowledgment/Completion Latency | Agent fabric team | `#incident-response` |
| SLO-4 Auth Success Rate | Identity team | `#incident-response` |
| SLO-5 Queue Worker Health | Platform team | `#incident-response` |

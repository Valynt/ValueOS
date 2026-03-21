---
title: SLOs and SLIs
owner: team-platform
review_date: 2027-01-01
status: active
---

# SLOs and SLIs

Defines service level objectives (SLOs), service level indicators (SLIs), and the canonical workload classification matrix for key ValueOS user journeys.

Prometheus recording rules: `infra/k8s/monitoring/prometheus-slo-rules.yaml`
Alerting rules: `infra/k8s/monitoring/slo-alerts.yaml`
Burn-rate alerts: `infra/k8s/monitoring/observability-recording-alerts.yaml`

---

## Canonical latency classes

ValueOS publishes exactly two caller-visible latency classes across monitoring, load testing, dashboards, routing, and autoscaling policy.

| Latency class | Source-of-truth target | Allowed exception policy | Instrumentation guidance |
|---|---|---|---|
| Interactive completion | Completion latency p95 ≤ **200ms** | No slower completion budget is allowed. Reclassify any route that cannot meet 200ms p95 to orchestration acknowledgment/completion before rollout. | Use for synchronous health, readiness, session, list/detail, and cache-friendly mutation flows. |
| Orchestration acknowledgment/completion | Acknowledgment latency p95 ≤ **200ms** | Completion latency p95 ≤ **3000ms** is allowed only for routes explicitly labeled orchestration and backed by streaming or async completion semantics. | Use for provider-bound, queue-backed, or streaming routes that acknowledge quickly and finish asynchronously or over an open stream. |

---

## Canonical classification and policy matrix

This section is the single source of truth for route and agent class assignment, the autoscaling profile each class must use, and the alert thresholds that must stay aligned with manifests.

### Route-class mapping

| Route group / path policy | Class | Autoscaling profile | Required routing / policy labels | Alert thresholds | Notes |
|---|---|---|---|---|---|
| `/health`, `/api/health/ready`, auth/session checks, list/detail reads, cache-friendly mutations, and any route expected to finish synchronously for the caller | **Interactive** | `interactive-api` | `latency_class=interactive`; interactive routes may only target workloads labeled `scaling.valueos.io/request-path-policy=interactive-allowlisted` when an agent participates in the path | Completion p95 `≤ 200ms` | Default for user-facing synchronous API work. |
| `/api/llm/*`, `/api/billing/*`, `/api/queue/*`, streaming APIs, provider-mediated operations, queue submissions, and any endpoint whose work completes asynchronously or over an open stream | **Orchestration** | shared backend `interactive-api` HPA with orchestration acknowledgment metrics, plus `async-worker`, `async-warm-agent`, or `scale-to-zero-async-agent` for downstream workers and agents | `latency_class=orchestration`; `latency_phase=acknowledgment` for caller-facing ack SLIs; scale-to-zero backends must also carry `scaling.valueos.io/request-path-policy=async-only` | Acknowledgment p95 `≤ 200ms`; completion p95 `≤ 3000ms` | The only allowed slower completion policy in the platform. |

### Agent-class mapping

| Agent / workload class | Included workloads | Class | HPA / KEDA profile | Required labels | Caller-visible / operational thresholds |
|---|---|---|---|---|---|
| Warm interactive agents | `opportunity-agent`, `target-agent`, `integrity-agent`, `expansion-agent`, `realization-agent`, `financial-modeling-agent` | **Interactive** | `warm-interactive-agent` | `scaling.valueos.io/request-path-policy=interactive-allowlisted`; `scaling.valueos.io/cold-start-class=warm-interactive` | Interactive completion p95 `≤ 200ms`; scale-down stabilization `180s` to keep warm capacity without long overhang. |
| Async warm agent | `research-agent` | **Orchestration** | `async-warm-agent` | `scaling.valueos.io/request-path-policy=async-only`; `scaling.valueos.io/cold-start-class=async-warm` | Orchestration acknowledgment p95 `≤ 200ms`; orchestration completion p95 `≤ 3000ms`; keep non-zero warm pool for throughput. |
| Scale-to-zero async agents | `benchmark-agent`, `company-intelligence-agent`, `coordinator-agent`, `communicator-agent`, `groundtruth-agent`, `intervention-designer-agent`, `narrative-agent`, `outcome-engineer-agent`, `system-mapper-agent`, `value-eval-agent`, `value-mapping-agent` | **Orchestration** | `scale-to-zero-async-agent` | `scaling.valueos.io/request-path-policy=async-only`; `scaling.valueos.io/cold-start-class=scale-to-zero-async`; routing guardrail must continue to deny interactive use while `minReplicaCount=0` | Orchestration acknowledgment p95 `≤ 200ms`; orchestration completion p95 `≤ 3000ms`; cold-start alerting stays diagnostic-only because these agents are async-only. |
| Queue workers | `worker` deployment and queue-backed background jobs | **Orchestration** | `async-worker` | `scaling.valueos.io/request-path-policy=async-only` | Queue health success rate `≥ 99%`; completion exception policy still capped at p95 `≤ 3000ms` for caller-visible orchestration flows. |

### Drift-prevention rules

- Any manifest or alert that changes a route or agent class must update this matrix in the same PR.
- A workload with `scaling.valueos.io/request-path-policy=async-only` must not be referenced by interactive routes or interactive SLO dashboards.
- Any workload using `minReplicaCount: 0` or KEDA scale-to-zero must stay in the orchestration class until the routing policy, cold-start profile, and SLO thresholds are all changed together.

---

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
| **User journey** | Synchronous interactive API routes such as readiness, session checks, and cache-friendly reads/writes |
| **Target** | p95 completion latency ≤ **200ms**, measured over a rolling 30-day window |
| **Allowed exception policy** | None. Routes that cannot meet 200ms p95 must move to the orchestration class before rollout. |
| **SLI metric** | `slo:api_latency_p95:ratio_rate5m` |
| **SLI expression** | `sum(rate(http_request_duration_seconds_bucket{job="valueos-api",latency_class="interactive",le="0.2"}[5m])) / sum(rate(http_request_duration_seconds_count{job="valueos-api",latency_class="interactive"}[5m]))` |
| **Prometheus target** | `slo:target:api_latency_p95` = 0.95 |

### SLO-3: Orchestration Acknowledgment / Completion

| Field | Value |
|---|---|
| **User journey** | Queue-backed, provider-mediated, or streaming orchestration routes such as `/api/llm/chat`, `/api/billing/*`, and `/api/queue/*` |
| **Target** | p95 acknowledgment latency ≤ **200ms**, measured over a rolling 30-day window |
| **Allowed exception policy** | Completion latency p95 may extend to **3000ms** only for routes explicitly labeled orchestration and instrumented to acknowledge within 200ms. |
| **SLI metric** | `slo:orchestration_acknowledgment_p95:ratio_rate5m` |
| **SLI expression** | `sum(rate(http_request_duration_seconds_bucket{job="valueos-api",latency_class="orchestration",latency_phase="acknowledgment",le="0.2"}[5m])) / sum(rate(http_request_duration_seconds_count{job="valueos-api",latency_class="orchestration",latency_phase="acknowledgment"}[5m]))` |
| **Prometheus target** | `slo:target:orchestration_acknowledgment_p95` = 0.95 |

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
| SLO-3 Orchestration Acknowledgment / Completion | Agent fabric team | `#incident-response` |
| SLO-4 Auth Success Rate | Identity team | `#incident-response` |
| SLO-5 Queue Worker Health | Platform team | `#incident-response` |

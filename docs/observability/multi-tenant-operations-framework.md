# Multi-Tenant Operations Framework

## Purpose

Define the operational control plane for tenant-aware reliability, fairness, and incident response across ValueOS.

## 1) Per-Tenant Golden Signals

All metrics below **must include `tenant_id` and `tenant_tier` labels** to preserve tenant isolation and support tier-aware routing.

| Signal | Metric(s) | Tenant View | SLO/Policy Guidance |
|---|---|---|---|
| Request rate | `sum(rate(valueos_http_requests_total{tenant_id!=""}[5m])) by (tenant_id)` | Top tenants by request volume and rolling 7d trend | Use for capacity forecasting and noisy-neighbor detection baseline. |
| Latency | `histogram_quantile(0.95, sum(rate(valueos_request_duration_seconds_bucket{tenant_id!=""}[5m])) by (le, tenant_id))` | p50/p95/p99 by tenant and endpoint class | p95 target should be tier-specific (e.g., enterprise stricter than standard). |
| Error rate | `sum(rate(valueos_http_requests_total{status=~"5..",tenant_id!=""}[5m])) by (tenant_id) / sum(rate(valueos_http_requests_total{tenant_id!=""}[5m])) by (tenant_id)` | 5xx error budget burn by tenant | Track with rolling 1h/24h windows and burn-rate alerts. |
| Queue delay | `histogram_quantile(0.95, sum(rate(valueos_queue_delay_seconds_bucket{tenant_id!=""}[5m])) by (le, tenant_id, queue_name))` | p95 queue delay by tenant + queue | Trigger fairness intervention when high-volume tenant drives shared queue delay. |
| Compute/token spend | `sum(rate(valueos_compute_cost_usd_total{tenant_id!=""}[5m])) by (tenant_id)` and `sum(rate(valueos_llm_tokens_total{tenant_id!=""}[5m])) by (tenant_id, token_type)` | Real-time spend and token split per tenant | Enforce plan quotas and overage throttles by tenant tier. |
| Recommendation throughput | `sum(rate(valueos_recommendations_emitted_total{tenant_id!=""}[5m])) by (tenant_id)` and success ratio by tenant | Delivered recommendations per minute and success/failure mix | Required for per-tenant value-loop health. |

## 2) Anomaly Detection Jobs

Implement two recurring anomaly jobs in Prometheus rule evaluation:

1. **Per-tenant deviation job**
   - Baseline: `avg_over_time(...[7d])`
   - Current: `avg_over_time(...[15m])`
   - Deviation score: `(current - baseline) / clamp_min(baseline, 0.001)`
   - Apply to latency, error rate, queue delay, and spend.
2. **Noisy-neighbor job**
   - Compute tenant resource share in shared pools (CPU, queue slots, LLM token throughput).
   - Flag when one tenant exceeds policy threshold (default 40%) while at least one peer tenant shows degradation in latency/error/queue delay.

Reference implementation is defined in:
- `infra/prometheus/alerts/tenant-anomaly-alerts.yml`

## 3) Fairness Dashboards

Create and maintain a tenant fairness dashboard with these sections:

1. **Resource share distribution**: Top-N tenant share for CPU, request rate, queue throughput, and token usage.
2. **Quota utilization**: Tenant usage vs monthly quota (requests/tokens/compute spend), grouped by tier.
3. **Throttling events**: `valueos_throttling_events_total` by tenant and reason (quota, rate limit, protection).
4. **Saturation by tenant tier**: saturation index by tier (`starter`, `growth`, `enterprise`) including queue occupancy and p95 latency.

Reference implementation is defined in:
- `infra/grafana/dashboards/tenant-fairness-dashboard.json`

## 4) Alert Routing & Escalation (Tenant Impact)

Blast radius classification:

- **Single-tenant**: one tenant impacted, others healthy.
- **Multi-tenant**: two or more tenants impacted in the same service domain.
- **Platform-wide**: broad tier/service degradation across most tenants.

Routing policy:

1. Single-tenant alerts route to tenant success + platform on-call (severity warning/critical based on SLO burn).
2. Multi-tenant alerts route directly to primary incident response (PagerDuty P1/P2).
3. Platform-wide alerts trigger incident commander assignment and executive notification.

Escalation targets and response timelines are defined in:
- `docs/operations/runbooks/tenant-impact-alert-routing.md`

## 5) Monthly Multi-Tenant Review Process

Cadence: First business week of every month.

Participants: SRE, platform engineering, data/ML operations, product operations, tenant success.

Required agenda:

1. Review fairness dashboard trends for previous month.
2. Review top anomaly incidents and noisy-neighbor events.
3. Evaluate tier saturation and quota breach patterns.
4. Approve actions for:
   - quota rebalancing,
   - tier policy tuning,
   - alert threshold tuning,
   - backlog items for isolation/capacity improvements.
5. Publish decisions and owners in monthly ops notes.

Deliverables:

- Quota adjustment plan by tenant tier.
- Alert/policy change list with rollout dates.
- Follow-up actions with accountable owners and due dates.

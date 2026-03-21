---
title: Operational Tuning Baselines
owner: team-sre
review_date: 2026-04-19
status: active
---

# Operational Tuning Baselines

This document is the auditable baseline for the operational tuning loop introduced by:

- `infra/k8s/monitoring/operational-tuning-recording-rules.yaml`
- `infra/observability/grafana/dashboards/operational-tuning-loop.json`
- `packages/backend/src/observability/queueMetrics.ts`

Keep this file next to `load-test-baselines.md` and `query-plan-baselines.md` so monthly tuning changes can be reviewed in one place.

## Review cadence

- **Monthly:** review the previous 30 days of saturation data.
- **After each load test:** compare new queue saturation and p95 job duration to this baseline before editing manifests.
- **After each autoscaling change:** update this file in the same PR so the before/after state is auditable.

## Signals that drive changes

| Signal | Source | Use in review |
| --- | --- | --- |
| CPU throttling ratio | `valueos:deployment_cpu_throttling_ratio5m` | Raise CPU requests/limits or lower concurrency when sustained throttling exceeds 10%. |
| Total pod memory RSS | `valueos:deployment_memory_rss_bytes` | Raise memory request/limit when total pod RSS sits above ~80% of request or OOM pressure appears. |
| App-container memory RSS | `valueos:deployment_app_memory_rss_bytes` | Distinguish true app growth from sidecar overhead before raising app limits. |
| Sidecar memory RSS share | `valueos:deployment_sidecar_memory_share` | Flag pods where Envoy/OPA dominate memory even though the app process remains light. |
| Sidecar-heavy pressure flag | `valueos:deployment_sidecar_heavy_memory_pressure` | Page the tuning review when total RSS is high, app RSS is low, and sidecars are carrying the pod. |
| Queue lag | `valueos:workload_queue_lag_jobs` | Raise concurrency or HPA aggressiveness when lag persists beyond one job-duration window. |
| Effective concurrency | `valueos:workload_effective_concurrency` | Validate whether queue lag is due to replica scarcity or per-pod concurrency caps. |
| Queue saturation ratio | `valueos:workload_queue_saturation_ratio` | Primary “tuning loop” signal; values above `1.0` mean backlog exceeds effective concurrency. |
| Job duration p95 | `valueos:workload_job_duration_seconds:p95` | Distinguish slow jobs from insufficient parallelism. |

## Baseline snapshot — 2026-03-21

### Shared defaults by workload class

| Workload class | Intended concurrency / pod | DB pool / pod | Sidecar budget / pod | Notes |
| --- | ---: | ---: | --- | --- |
| Backend API | `8` expected concurrent requests | `4` | none | `backend-blue` now exports `DATABASE_EXPECTED_CONCURRENCY=8` so runtime pool sizing matches the HPA RPS target. |
| Queue worker | `4` concurrent jobs | `4` | none | Worker now exports `DATABASE_POOL_MAX=4`; this matches `AGENT_QUEUE_CONCURRENCY=4`. |
| Latency-sensitive agents | `6` | `4` | `125m CPU / 256Mi` requests, `450m CPU / 512Mi` limits | Warm interactive agents still scale through HPA before deepening per-pod queues. |
| Financial-critical agents | `4` | `3` | `125m CPU / 256Mi` requests, `450m CPU / 512Mi` limits | Heavier DB + LLM paths remain narrower per pod. |
| Low-frequency async agents | `2` | `2` | `125m CPU / 256Mi` requests, `450m CPU / 512Mi` limits | KEDA/HPA should absorb bursts instead of oversized in-pod fan-in. |

### Per-workload budget table

Agent workloads now budget the app container separately from the Envoy + OPA sidecars. That makes low-request pods auditable when sidecars become the dominant memory consumer.

| Workload | Profile / scaler | App requests | App limits | Sidecar requests | Sidecar limits | Total pod requests | Total pod limits | Intended concurrency / pod | DB pool / pod | Max replicas | Aggregate DB budget |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `backend-blue` | API / HPA | `250m` CPU / `512Mi` | `1000m` CPU / `1Gi` | none | none | `250m` / `512Mi` | `1000m` / `1Gi` | 8 | 4 | 18 | 72 |
| `worker` | queue-worker / HPA | `300m` CPU / `640Mi` | `1200m` CPU / `1536Mi` | none | none | `300m` / `640Mi` | `1200m` / `1536Mi` | 4 | 4 | 16 | 64 |
| `opportunity-agent` | latency-sensitive / HPA (queue target `10`) | `500m` / `1Gi` | `1500m` / `2Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `625m` / `1280Mi` | `1950m` / `2560Mi` | 6 | 4 | 8 | 32 |
| `target-agent` | latency-sensitive / HPA (queue target `10`) | `100m` / `256Mi` | `500m` / `1Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `225m` / `512Mi` | `950m` / `1536Mi` | 6 | 4 | 6 | 24 |
| `expansion-agent` | latency-sensitive / HPA (queue target `10`) | `200m` / `512Mi` | `1000m` / `2Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `325m` / `768Mi` | `1450m` / `2560Mi` | 6 | 4 | 12 | 48 |
| `integrity-agent` | latency-sensitive / HPA (queue target `8`) | `100m` / `256Mi` | `500m` / `1Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `225m` / `512Mi` | `950m` / `1536Mi` | 6 | 4 | 6 | 24 |
| `financial-modeling-agent` | financial-critical / HPA (queue target `6`) | `200m` / `512Mi` | `1000m` / `2Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `325m` / `768Mi` | `1450m` / `2560Mi` | 4 | 3 | 10 | 30 |
| `realization-agent` | financial-critical / HPA (queue target `10`) | `750m` / `1536Mi` | `2000m` / `3Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `875m` / `1792Mi` | `2450m` / `3584Mi` | 4 | 3 | 10 | 30 |
| `benchmark-agent` | low-frequency async / KEDA | `150m` / `384Mi` | `750m` / `1.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `275m` / `640Mi` | `1200m` / `2Gi` | 2 | 2 | 10 | 20 |
| `communicator-agent` | low-frequency async / KEDA | `100m` / `256Mi` | `500m` / `1Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `225m` / `512Mi` | `950m` / `1536Mi` | 2 | 2 | 8 | 16 |
| `company-intelligence-agent` | low-frequency async / KEDA | `150m` / `384Mi` | `750m` / `1.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `275m` / `640Mi` | `1200m` / `2Gi` | 2 | 2 | 10 | 20 |
| `coordinator-agent` | low-frequency async / KEDA | `150m` / `384Mi` | `750m` / `1.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `275m` / `640Mi` | `1200m` / `2Gi` | 2 | 2 | 8 | 16 |
| `groundtruth-agent` | low-frequency async / KEDA | `150m` / `384Mi` | `750m` / `1.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `275m` / `640Mi` | `1200m` / `2Gi` | 2 | 2 | 8 | 16 |
| `intervention-designer-agent` | low-frequency async / KEDA | `250m` / `640Mi` | `1250m` / `2.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `375m` / `896Mi` | `1700m` / `3Gi` | 2 | 2 | 12 | 24 |
| `narrative-agent` | low-frequency async / KEDA | `200m` / `512Mi` | `1000m` / `2Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `325m` / `768Mi` | `1450m` / `2560Mi` | 2 | 2 | 10 | 20 |
| `outcome-engineer-agent` | low-frequency async / KEDA | `250m` / `640Mi` | `1250m` / `2.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `375m` / `896Mi` | `1700m` / `3Gi` | 2 | 2 | 12 | 24 |
| `research-agent` | low-frequency async / HPA (queue target `6`) | `200m` / `512Mi` | `1000m` / `2Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `325m` / `768Mi` | `1450m` / `2560Mi` | 2 | 2 | 14 | 28 |
| `system-mapper-agent` | low-frequency async / KEDA | `200m` / `512Mi` | `1000m` / `2Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `325m` / `768Mi` | `1450m` / `2560Mi` | 2 | 2 | 10 | 20 |
| `value-eval-agent` | low-frequency async / KEDA | `150m` / `384Mi` | `750m` / `1.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `275m` / `640Mi` | `1200m` / `2Gi` | 2 | 2 | 10 | 20 |
| `value-mapping-agent` | low-frequency async / KEDA | `150m` / `384Mi` | `750m` / `1.5Gi` | `125m` / `256Mi` | `450m` / `512Mi` | `275m` / `640Mi` | `1200m` / `2Gi` | 2 | 2 | 10 | 20 |

### Concurrency, resource, and DB-pool fit

| Workload class | Intended concurrency input | CPU / memory request fit | DB pool fit | Operational read |
| --- | --- | --- | --- | --- |
| Backend API | HPA targets `8` RPS per pod and runtime expected concurrency `8` | `250m` CPU and `512Mi` give only modest headroom per in-flight request, so throttling must stay below 10% before raising concurrency | Pool `4` keeps a `2:1` request-to-connection ratio | Keep pool fixed at `4`; scale replicas before increasing per-pod concurrency. |
| Queue worker | `AGENT_QUEUE_CONCURRENCY=4`, HPA waiting target `15`, delayed target `40` | `300m` CPU / `640Mi` is sized for four active jobs, with CPU/memory acting as guardrails after queue depth | Pool `4` is intentionally `1:1` with active jobs | Worker pool sizing must remain explicit because the derived `worker` profile is narrower than the shared queue-worker budget. |
| Latency-sensitive agents | `MAX_CONCURRENT_REQUESTS=6`, queue targets `8-10` | App requests vary from `100m/256Mi` to `500m/1Gi`, but every pod also carries a fixed `125m/256Mi` sidecar budget | Pool `4` gives a `1.5:1` request-to-connection ratio | `target-agent` and `integrity-agent` are most sidecar-heavy because the sidecars equal the app memory request. |
| Financial-critical agents | `MAX_CONCURRENT_REQUESTS=4`, queue targets `6-10` | Heavier app requests (`200m-750m` CPU, `512Mi-1536Mi` memory) keep more room for query and model state | Pool `3` gives a `1.33:1` request-to-connection ratio | These classes should scale through replicas first; raising concurrency risks DB saturation fastest. |
| Low-frequency async agents | `MAX_CONCURRENT_REQUESTS=2`, KEDA backlog activation `1`, research HPA target `6` | App requests are modest, so the fixed sidecar footprint is often equal to or larger than app RSS during light traffic | Pool `2` keeps a `1:1` request-to-connection ratio | Any “high memory” alert here must be checked against app-vs-sidecar RSS before changing app memory limits. |

## Postgres connection budget at manifest max scale

### Manifested hard maximum

| Workload slice | Formula | Max connections |
| --- | --- | ---: |
| Backend API | `18 replicas * pool 4` | 72 |
| Queue worker | `16 replicas * pool 4` | 64 |
| Latency-sensitive agents | `(8 + 6 + 12 + 6) replicas * pool 4` | 128 |
| Financial-critical agents | `(10 + 10) replicas * pool 3` | 60 |
| Low-frequency async agents | `(10 + 8 + 10 + 8 + 8 + 12 + 10 + 12 + 14 + 10 + 10 + 10) replicas * pool 2` | 244 |
| **Total manifested maximum** |  | **568** |

### Safe operating ceiling

Treat **568** as the hard manifest ceiling, not the target operating point.

Use **450 application connections** as the safe ceiling for routine tuning reviews. That leaves **118 connections (~21%)** in reserve for:

- migrations and maintenance jobs,
- cron or one-off admin workloads,
- connection churn during rollout / restart waves,
- Supabase / Postgres control-plane overhead,
- psql or incident-debug sessions.

> This 450-connection ceiling is an operational safety margin inferred from the current manifests. If the backing Postgres tier advertises fewer than ~600 usable connections, lower replica maxima before raising any per-pod pool.

## Dashboard and runbook expectations for sidecar-heavy pods

The operational tuning dashboard must now expose four memory views together:

1. **Total pod RSS by deployment** (`valueos:deployment_memory_rss_bytes`)
2. **App RSS vs sidecar RSS** (`valueos:deployment_app_memory_rss_bytes`, `valueos:deployment_sidecar_memory_rss_bytes`)
3. **Sidecar RSS share** (`valueos:deployment_sidecar_memory_share`)
4. **Sidecar-heavy pressure flag** (`valueos:deployment_sidecar_heavy_memory_pressure`)

Use those panels before changing any agent memory request. A pod is “sidecar-heavy” when:

- total pod RSS is above ~80% of requested memory,
- app RSS is still below ~40% of requested memory, and
- sidecars account for more than ~35% of total pod RSS.

When that happens, review Envoy/OPA budgets first; do **not** automatically increase the app container memory request.

## Audit log template for future changes

Use this entry format whenever tuning values change:

```md
### YYYY-MM-DD — <environment>
- Trigger: <cpu throttling / memory RSS / queue saturation / job duration / sidecar-heavy memory pressure>
- Evidence window: <for example, 2026-03-01 through 2026-03-31>
- Dashboard panels reviewed:
  - CPU throttling ratio by deployment
  - Total pod RSS by deployment
  - App RSS vs sidecar RSS by deployment
  - Sidecar RSS share by deployment
  - Sidecar-heavy memory pressure flag
  - Queue lag by worker/agent class
  - Effective concurrency by worker/agent class
  - Queue saturation ratio
  - Job duration p95 by worker/agent class
- Manifest/config changes:
  - `MAX_CONCURRENT_REQUESTS`: <before> -> <after>
  - Requests/limits: <before> -> <after>
  - Sidecar requests/limits: <before> -> <after>
  - DB pool / pod: <before> -> <after>
  - HPA/KEDA target: <before> -> <after>
- Expected outcome: <what should improve>
- Follow-up load test: <planned date or link>
```

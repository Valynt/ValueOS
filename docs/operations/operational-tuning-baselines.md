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
| Memory RSS | `valueos:deployment_memory_rss_bytes` | Raise memory request/limit when RSS sits above ~80% of request or OOM pressure appears. |
| Queue lag | `valueos:workload_queue_lag_jobs` | Raise concurrency or HPA aggressiveness when lag persists beyond one job-duration window. |
| Effective concurrency | `valueos:workload_effective_concurrency` | Validate whether queue lag is due to replica scarcity or per-pod concurrency caps. |
| Queue saturation ratio | `valueos:workload_queue_saturation_ratio` | Primary “tuning loop” signal; values above `1.0` mean backlog exceeds effective concurrency. |
| Job duration p95 | `valueos:workload_job_duration_seconds:p95` | Distinguish slow jobs from insufficient parallelism. |

## Baseline snapshot — 2026-03-19

### Shared agent concurrency default

| Setting | Baseline | Source |
| --- | --- | --- |
| `MAX_CONCURRENT_REQUESTS` | `10` | `infra/k8s/base/agents/configmap.yaml` |
| `REQUEST_TIMEOUT_MS` | `30000` | `infra/k8s/base/agents/configmap.yaml` |

### Backend and worker deployments

| Deployment | Requests | Limits | Autoscaling baseline | Notes |
| --- | --- | --- | --- | --- |
| `backend` | `250m` CPU / `512Mi` memory | `1000m` CPU / `1Gi` memory | HPA `2-18` replicas, CPU `65%`, memory `78%`, RPS target `8`, p95 latency target `450ms` | Legacy single-slot backend manifest remains in base for non-blue/green paths. |
| `backend-blue` | `250m` CPU / `512Mi` memory | `1000m` CPU / `1Gi` memory | HPA `2-18` replicas via `backend-hpa` | Blue slot is the current HPA target in `infra/k8s/base/hpa.yaml`. |
| `backend-green` | `250m` CPU / `512Mi` memory | `1000m` CPU / `1Gi` memory | Shares `backend-hpa` settings when promoted active | Starts at `0` replicas until promoted. |
| `worker` | `300m` CPU / `640Mi` memory | `1200m` CPU / `1536Mi` memory | HPA `2-12` replicas, queue waiting target `20`, delayed target `50`, CPU `65%`, memory `75%` | Queue concurrency comes from code-level workers, captured by `queue_worker_configured_concurrency`. |

### Worker-class concurrency baselines

| Worker class | Queue | Per-pod concurrency baseline | Source |
| --- | --- | --- | --- |
| `research-worker` | `onboarding-research` | `3` | `packages/backend/src/workers/researchWorker.ts` |
| `crm-sync-worker` | `crm-sync` | `3` | `packages/backend/src/workers/crmWorker.ts` |
| `crm-webhook-worker` | `crm-webhook` | `5` | `packages/backend/src/workers/crmWorker.ts` |
| `crm-prefetch-worker` | `crm-prefetch` | `3` | `packages/backend/src/workers/crmWorker.ts` |
| `artifact-generation-worker` | `artifact-generation` | `3` | `packages/backend/src/workers/ArtifactGenerationWorker.ts` |
| `certificate-generation-worker` | `certificate-generation` | `5` default (`config.queue.concurrency` override allowed) | `packages/backend/src/workers/CertificateGenerationWorker.ts` |

### Agent deployment baselines

All agent deployments inherit `MAX_CONCURRENT_REQUESTS=10` from `agent-config` unless a deployment-specific override is introduced.

| Agent deployment | Requests | Limits | Queue target / scaler floor-ceiling |
| --- | --- | --- | --- |
| `benchmark-agent` | `150m` / `384Mi` | `750m` / `1.5Gi` | KEDA scale-to-zero, max `8`, queue threshold `10` |
| `communicator-agent` | `100m` / `256Mi` | `500m` / `1Gi` | HPA `2-6`, queue target `12` |
| `company-intelligence-agent` | `150m` / `384Mi` | `750m` / `1.5Gi` | KEDA scale-to-zero, max `8`, queue threshold `10` |
| `coordinator-agent` | `150m` / `384Mi` | `750m` / `1.5Gi` | HPA `2-6`, queue target `12` |
| `expansion-agent` | `200m` / `512Mi` | `1000m` / `2Gi` | HPA `3-12`, queue target `10` |
| `financial-modeling-agent` | `200m` / `512Mi` | `1000m` / `2Gi` | HPA `3-12`, queue target `8` |
| `groundtruth-agent` | `150m` / `384Mi` | `750m` / `1.5Gi` | KEDA scale-to-zero, queue trigger managed in `low-frequency-keda-scaledobjects.yaml` |
| `integrity-agent` | `100m` / `256Mi` | `500m` / `1Gi` | HPA `2-6`, queue target `8` |
| `intervention-designer-agent` | `250m` / `640Mi` | `1250m` / `2.5Gi` | HPA `3-12`, queue target `8` |
| `narrative-agent` | `200m` / `512Mi` | `1000m` / `2Gi` | KEDA scale-to-zero, queue trigger managed in `low-frequency-keda-scaledobjects.yaml` |
| `opportunity-agent` | `500m` / `1Gi` | `1500m` / `2Gi` | HPA `2-8`, queue target `10` |
| `outcome-engineer-agent` | `250m` / `640Mi` | `1250m` / `2.5Gi` | HPA `3-12`, queue target `8` |
| `realization-agent` | `750m` / `1536Mi` | `2000m` / `3Gi` | HPA `2-10`, queue target `10` |
| `research-agent` | `200m` / `512Mi` | `1000m` / `2Gi` | HPA `3-12`, queue target `8` |
| `system-mapper-agent` | `200m` / `512Mi` | `1000m` / `2Gi` | HPA `2-8`, queue target `10` |
| `target-agent` | `100m` / `256Mi` | `500m` / `1Gi` | HPA `2-6`, queue target `10` |
| `value-eval-agent` | `150m` / `384Mi` | `750m` / `1.5Gi` | HPA `2-8`, queue target `10` |
| `value-mapping-agent` | `150m` / `384Mi` | `750m` / `1.5Gi` | KEDA scale-to-zero, max `8`, queue threshold `10` |

## Audit log template for future changes

Use this entry format whenever tuning values change:

```md
### YYYY-MM-DD — <environment>
- Trigger: <cpu throttling / memory RSS / queue saturation / job duration>
- Evidence window: <for example, 2026-03-01 through 2026-03-31>
- Dashboard panels reviewed:
  - CPU throttling ratio by deployment
  - Memory RSS by deployment
  - Queue lag by worker/agent class
  - Effective concurrency by worker/agent class
  - Queue saturation ratio
  - Job duration p95 by worker/agent class
- Manifest/config changes:
  - `MAX_CONCURRENT_REQUESTS`: <before> -> <after>
  - Requests/limits: <before> -> <after>
  - HPA/KEDA target: <before> -> <after>
- Expected outcome: <what should improve>
- Follow-up load test: <planned date or link>
```

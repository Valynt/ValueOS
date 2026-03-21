---
title: Operational Tuning Monthly Review
owner: team-sre
review_date: 2026-04-19
status: active
---

# Operational Tuning Monthly Review

Use this checklist once per month to turn observability into a closed-loop tuning practice.

## Inputs

Before starting, have all of the following ready:

1. The last 30 days of the **Operational Tuning Loop** dashboard.
2. The current baseline in `docs/operations/operational-tuning-baselines.md`.
3. The latest load test evidence in `docs/operations/load-test-baselines.md`.
4. The latest query review notes in `docs/operations/query-plan-baselines.md`.
5. The current Kubernetes manifests under `infra/k8s/base/` and `infra/k8s/base/agents/`.

## Monthly checklist

### 1. CPU throttling review

- [ ] Review `valueos:deployment_cpu_throttling_ratio5m` for backend, worker, and all agent deployments.
- [ ] If throttling is **>10% for sustained business-hour windows**, propose either:
  - raising CPU requests,
  - raising CPU limits,
  - or lowering `MAX_CONCURRENT_REQUESTS` for the affected agent class.
- [ ] If throttling is **<2% for the entire month** and queue saturation is also low, consider reducing CPU limits to reclaim cost.

### 2. Memory RSS review

- [ ] Review `valueos:deployment_memory_rss_bytes` against the manifest request/limit baseline.
- [ ] If RSS regularly exceeds **80% of request**, raise the request so the scheduler sees real demand.
- [ ] If RSS regularly exceeds **85% of limit** or any OOM/restart signal appears, raise the limit before raising concurrency.
- [ ] If RSS stays far below request for a full month, consider lowering memory requests.

### 3. Queue lag vs. effective concurrency review

- [ ] Compare `valueos:workload_queue_lag_jobs` and `valueos:workload_effective_concurrency` for every worker and agent class.
- [ ] Review `valueos:workload_queue_saturation_ratio`.
- [ ] If saturation ratio is **>1.0 for repeated 5m windows**, choose the smallest safe correction:
  - increase `MAX_CONCURRENT_REQUESTS`,
  - lower average job duration,
  - or make HPA/KEDA scale up sooner.
- [ ] If lag is near-zero while effective concurrency remains high for most of the month, consider lowering concurrency or reducing min replicas.

### 4. Job duration review

- [ ] Review `valueos:workload_job_duration_seconds:p95` by class.
- [ ] If p95 duration rose materially but lag did not, investigate job payload changes before increasing concurrency.
- [ ] If p95 duration and lag both rose, prefer resource tuning first, then concurrency changes.
- [ ] Re-run or schedule a targeted load test whenever p95 duration changes enough to invalidate current HPA queue thresholds.

### 5. HPA and KEDA review

- [ ] Confirm backend HPA targets still match observed demand (`RPS`, `p95 latency`, CPU, memory).
- [ ] Confirm worker HPA queue targets still match the observed per-pod throughput.
- [ ] Confirm each agent HPA/KEDA queue threshold reflects observed saturation, not guesswork.
- [ ] For any class that frequently oscillates, widen stabilization windows before increasing max replicas.

### 6. Baseline and audit updates

- [ ] Update `docs/operations/operational-tuning-baselines.md` in the same PR as any manifest/config change.
- [ ] Add a dated audit entry describing the trigger, evidence window, and expected outcome.
- [ ] If the change affects latency or throughput expectations, update `load-test-baselines.md` after the next validation run.
- [ ] If the change affects DB pressure or query concurrency, record the follow-up result in `query-plan-baselines.md`.

## Decision guardrails

Use these guardrails when more than one lever could solve the issue:

1. **Fix throttling and memory pressure before raising concurrency.**
2. **Fix queue saturation before raising replica minimums.**
3. **Prefer evidence from a full month plus a fresh load test over one-off spikes.**
4. **Change one primary lever at a time** (`MAX_CONCURRENT_REQUESTS`, requests/limits, or HPA/KEDA targets) unless an incident requires a bundle.
5. **Document every change in the baseline file** so later rollbacks have an audit trail.

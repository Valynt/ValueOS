# Agent Scaling Strategy — Infrastructure-as-Code Specification

**Scope:** All `valynt-agents` workloads
**Last Updated:** 2026-03-19

---

## 1. Scaling Classes (Source of Truth)

| Agent | Scaling class | Baseline replicas | Scaling mechanism | Notes |
|---|---|---:|---|---|
| opportunity-agent | latency-sensitive core | 2 | HPA + Redis external metric | Keep warm for interactive discovery UX. |
| target-agent | latency-sensitive core | 2 | HPA | KPI drafting is user-facing and bursty. |
| integrity-agent | latency-sensitive core | 2 | HPA | Validation/veto stage gates workflow transitions. |
| expansion-agent | latency-sensitive core | 3 | HPA + external metric | Growth planning remains always-on. |
| realization-agent | latency-sensitive core | 2 | HPA + Redis external metric | Execution plans are part of critical path. |
| financial-modeling-agent | financial critical | 3 | HPA + external metric | Never scale to zero; protects forecasting latency SLOs. |
| research-agent | high-throughput async | 3 | HPA + external metric | Long-running workloads, high sustained throughput. |
| company-intelligence-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| value-mapping-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| system-mapper-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| intervention-designer-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| outcome-engineer-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| coordinator-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| value-eval-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| communicator-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| benchmark-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| narrative-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |
| groundtruth-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Async backlog capacity only; not interactive latency capacity. |

> Rule: financial + latency-sensitive classes must keep non-zero baseline.

## 1.1 Synchronous Request-Path Allowlist

Only the following agents may participate in synchronous request/response paths, and they must retain non-zero warm capacity:

- `opportunity-agent`
- `target-agent`
- `integrity-agent`
- `expansion-agent`
- `realization-agent`
- `financial-modeling-agent`

These agents define the interactive warm-capacity budget. Async capacity must not be counted toward interactive latency readiness.

## 1.2 Scale-to-Zero Async-Only Denylist

The following KEDA-backed agents are **scale-to-zero** and may only be invoked via queue, polling, or streaming workflows:

- `company-intelligence-agent`
- `value-mapping-agent`
- `system-mapper-agent`
- `intervention-designer-agent`
- `outcome-engineer-agent`
- `coordinator-agent`
- `value-eval-agent`
- `communicator-agent`
- `benchmark-agent`
- `narrative-agent`
- `groundtruth-agent`

Backend policy checks should fail when any of these agents are wired into a synchronous interactive route.

---

## 2. Stabilization Windows by Workload Type

| Workload type | Scale-up window | Scale-down window | Why |
|---|---:|---:|---|
| Interactive API / web | 0-15s | 90-120s | Request/response traffic can release capacity quickly after spike validation shows no request thrash. |
| Queue-backed async worker | 30s | 300s | Pods may still hold in-flight jobs; give queues time to drain before scale-in. |
| Low-frequency async agents (KEDA) | activation-driven | 180s cooldown | Capacity exists to clear asynchronous backlog, not to satisfy interactive latency. |

Operational rule: shorten scale-down windows only for interactive workloads that have passed load validation without oscillation or request thrash. Keep longer windows for workloads that may drop or requeue in-flight work during scale-in.

---

## 3. Low-Frequency Agent Wake-Up Design (KEDA)

Low-frequency agents now use `keda.sh/v1alpha1` `ScaledObject` resources with:

- `minReplicaCount: 0`
- `pollingInterval: 15s`
- `cooldownPeriod: 180s`
- Redis stream depth trigger via Prometheus query over `redis_stream_length`

This replaces fixed-min HPA behavior and enables true scale-to-zero while still
waking agents as soon as pending stream depth exceeds activation thresholds.
These agents provide asynchronous backlog-clearing capacity; they should not be
counted as warm capacity for interactive request-path latency SLOs.

Primary manifest: `infra/k8s/base/agents/low-frequency-keda-scaledobjects.yaml`.

---

## 4. Cold-Start SLO Instrumentation and Alerting

### Metric contract

The platform emits a histogram metric:

- `agent_enqueue_to_ready_seconds_bucket`
- `agent_enqueue_to_ready_seconds_count`

This measures enqueue timestamp to first ready pod latency for wake-up events.

### SLO target

- **Objective:** 95% of cold starts complete within **45 seconds**.

### Recording rules

Defined in `infra/k8s/monitoring/prometheus-slo-rules.yaml`:

- `slo:agent_cold_start:good_rate5m`
- `slo:agent_cold_start:good_rate1h`
- Burn-rate calculations for 5m/1h windows

### Alerts

- `AgentColdStartSLOBurnRateTooHigh` (critical; SLO burn-rate)
- `AgentFabricColdStartEnqueueToReadyP95High` (warning; p95 > 45s)

---

## 5. GPU Inference Overlay

GPU inference workloads are isolated in:

- `infra/k8s/overlays/gpu-inference/`

The overlay applies dedicated scheduling and resource constraints for inference
pods:

- Node selectors for GPU pools
- GPU tolerations (`nvidia.com/gpu`)
- Explicit MIG requests/limits (`nvidia.com/mig-1g.10gb: "1"`)

Current GPU overlay targets:

- `value-eval-agent`
- `groundtruth-agent`

This keeps GPU scheduling concerns out of the base manifests and allows
cluster-specific promotion of GPU workloads.

---

## 6. Operational Notes

1. Deploy KEDA before applying `low-frequency-keda-scaledobjects.yaml`.
2. Keep Redis + Prometheus scraping healthy; wake-up is driven by stream depth.
3. Review cold-start SLO dashboards after each scaling threshold adjustment.
4. Reclassify agents in this document whenever workload behavior changes.
5. Keep the worker HPA in `infra/k8s/base/worker-hpa.yaml` as the single source of truth for worker autoscaling.

# Agent Scaling Strategy — Infrastructure-as-Code Specification

**Scope:** All `valynt-agents` workloads
**Last Updated:** 2026-02-28

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
| company-intelligence-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| value-mapping-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| system-mapper-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| intervention-designer-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| outcome-engineer-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| coordinator-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| value-eval-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| communicator-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| benchmark-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| narrative-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |
| groundtruth-agent | low-frequency queue | 0 | **KEDA ScaledObject** | Scale from Redis stream depth. |

> Rule: financial + latency-sensitive classes must keep non-zero baseline.

---

## 2. Low-Frequency Agent Wake-Up Design (KEDA)

Low-frequency agents now use `keda.sh/v1alpha1` `ScaledObject` resources with:

- `minReplicaCount: 0`
- `pollingInterval: 15s`
- `cooldownPeriod: 180s`
- Redis stream depth trigger via Prometheus query over `redis_stream_length`

This replaces fixed-min HPA behavior and enables true scale-to-zero while still
waking agents as soon as pending stream depth exceeds activation thresholds.

Primary manifest: `infra/k8s/base/agents/low-frequency-keda-scaledobjects.yaml`.

---

## 3. Cold-Start SLO Instrumentation and Alerting

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

## 4. GPU Inference Overlay

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

## 5. Operational Notes

1. Deploy KEDA before applying `low-frequency-keda-scaledobjects.yaml`.
2. Keep Redis + Prometheus scraping healthy; wake-up is driven by stream depth.
3. Review cold-start SLO dashboards after each scaling threshold adjustment.
4. Reclassify agents in this document whenever workload behavior changes.

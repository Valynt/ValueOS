# Agent Scaling Strategy — Infrastructure-as-Code Specification

**Scope:** All `valynt-agents` workloads  
**Last Updated:** 2026-03-19

---

## 1. Workload Profiles (Source of Truth)

| Profile | Agents | Per-pod concurrency | DB pool per pod | Why |
|---|---|---:|---:|---|
| latency-sensitive | opportunity, target, integrity, expansion, research | 6 | 4 | Keep warm for interactive and sustained high-throughput paths without leaving every pod at 10-way concurrency. |
| financial-critical | financial-modeling, realization | 3 | 2 | Heavy, long-running work should scale with pods rather than overloading a single pod or fanning out DB sessions aggressively. |
| low-frequency-async | company-intelligence, value-mapping, system-mapper, intervention-designer, outcome-engineer, coordinator, value-eval, communicator, benchmark, narrative, groundtruth | 2 | 1 | Queue-driven agents should scale out via KEDA/HPA and hold the smallest per-pod pool so scale-to-zero classes cannot stampede Postgres on wake-up. |

### Aggregate connection envelope at max autoscaler spread

- **Latency-sensitive:** 44 max pods × pool 4 = **176** possible DB connections.
- **Financial-critical:** 18 max pods × pool 2 = **36** possible DB connections.
- **Low-frequency async:** 64 max pods × pool 1 = **64** possible DB connections.
- **Total modeled ceiling:** **276** agent-side DB connections.

This keeps aggregate connection pressure bounded during HPA/KEDA scale-out while still allowing lighter queue-driven workloads to add pods instead of inflating per-pod concurrency.

---

## 2. Deployment Inventory Snapshot

| Agent | Profile | CPU req | Memory req | Autoscaler | Min | Max | MAX_CONCURRENT_REQUESTS | DB pool |
|---|---|---:|---:|---|---:|---:|---:|---:|
| benchmark | low-frequency-async | 150m | 384Mi | KEDA | 0 | 6 | 2 | 1 |
| communicator | low-frequency-async | 100m | 256Mi | KEDA | 0 | 4 | 2 | 1 |
| company-intelligence | low-frequency-async | 150m | 384Mi | KEDA | 0 | 6 | 2 | 1 |
| coordinator | low-frequency-async | 150m | 384Mi | KEDA | 0 | 4 | 2 | 1 |
| expansion | latency-sensitive | 200m | 512Mi | HPA | 3 | 12 | 6 | 4 |
| financial-modeling | financial-critical | 200m | 512Mi | HPA | 2 | 8 | 3 | 2 |
| groundtruth | low-frequency-async | 150m | 384Mi | KEDA | 0 | 4 | 2 | 1 |
| integrity | latency-sensitive | 100m | 256Mi | HPA | 2 | 6 | 6 | 4 |
| intervention-designer | low-frequency-async | 250m | 640Mi | KEDA | 0 | 8 | 2 | 1 |
| narrative | low-frequency-async | 200m | 512Mi | KEDA | 0 | 6 | 2 | 1 |
| opportunity | latency-sensitive | 500m | 1Gi | HPA | 2 | 8 | 6 | 4 |
| outcome-engineer | low-frequency-async | 250m | 640Mi | KEDA | 0 | 8 | 2 | 1 |
| realization | financial-critical | 750m | 1536Mi | HPA | 2 | 10 | 3 | 2 |
| research | latency-sensitive | 200m | 512Mi | HPA | 3 | 12 | 6 | 4 |
| system-mapper | low-frequency-async | 200m | 512Mi | KEDA | 0 | 6 | 2 | 1 |
| target | latency-sensitive | 100m | 256Mi | HPA | 2 | 6 | 6 | 4 |
| value-eval | low-frequency-async | 150m | 384Mi | KEDA | 0 | 6 | 2 | 1 |
| value-mapping | low-frequency-async | 150m | 384Mi | KEDA | 0 | 6 | 2 | 1 |

---

## 3. Scaling Mechanism by Workload Type

| Workload type | Scale-up window | Scale-down window | Why |
|---|---:|---:|---|
| Interactive API / web | 0-15s | 90-120s | Request/response traffic can release capacity quickly after spike validation shows no request thrash. |
| Queue-backed async worker | 30s | 300s | Pods may still hold in-flight jobs; give queues time to drain before scale-in. |
| Low-frequency async agents (KEDA) | activation-driven | 180s cooldown | Capacity exists to clear asynchronous backlog, not to satisfy interactive latency. |
| Financial-critical agents | 0-30s | 300s | Keep warm, but prefer smaller step-ups and lower per-pod concurrency to preserve model quality and DB headroom. |

Operational rule: shorten scale-down windows only for interactive workloads that have passed load validation without oscillation or request thrash. Keep longer windows for workloads that may drop or requeue in-flight work during scale-in.

---

## 4. Low-Frequency Agent Wake-Up Design (KEDA)

Low-frequency agents use `keda.sh/v1alpha1` `ScaledObject` resources with:

- `minReplicaCount: 0`
- `pollingInterval: 15s`
- `cooldownPeriod: 180s`
- Redis stream depth trigger via Prometheus query over `redis_stream_length`
- `MAX_CONCURRENT_REQUESTS: 2`
- `DB_CONNECTION_POOL_SIZE: 1`

This means backlog is cleared by adding pods, not by driving a single pod to large concurrency or a large database pool.

Primary manifest: `infra/k8s/base/agents/low-frequency-keda-scaledobjects.yaml`.

---

## 5. Financial-Critical Guardrails

Financial-modeling and realization now share the same heavier-workload profile:

- `MAX_CONCURRENT_REQUESTS: 3`
- `DB_CONNECTION_POOL_SIZE: 2`
- warm replicas preserved through HPA min replicas
- slower, smaller HPA step-up for `financial-modeling-agent`

These workloads should scale by replica count before they scale by per-pod concurrency.

---

## 6. Saturation Dashboards

Use `infra/grafana/dashboards/agent-saturation.json` to tune these profile values from evidence. The dashboard tracks:

- per-agent CPU throttling ratio
- per-agent memory RSS
- queue depth across `agent_queue_depth` and `redis_stream_length`
- p95 execution latency from `agent_fabric_execution_duration_seconds_bucket`

Use this dashboard before raising per-pod concurrency or connection pools.

---

## 7. Cold-Start SLO Instrumentation and Alerting

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

## 8. GPU Inference Overlay

GPU inference workloads are isolated in:

- `infra/k8s/overlays/gpu-inference/`

The overlay applies dedicated scheduling and resource constraints for inference pods:

- Node selectors for GPU pools
- GPU tolerations (`nvidia.com/gpu`)
- Explicit MIG requests/limits (`nvidia.com/mig-1g.10gb: "1"`)

Current GPU overlay targets:

- `value-eval-agent`
- `groundtruth-agent`

This keeps GPU scheduling concerns out of the base manifests and allows cluster-specific promotion of GPU workloads.

---

## 9. Operational Notes

1. Deploy KEDA before applying `low-frequency-keda-scaledobjects.yaml`.
2. Keep Redis + Prometheus scraping healthy; wake-up is driven by stream depth.
3. Review the agent saturation dashboard after each concurrency or pool adjustment.
4. Reclassify agents in this document whenever workload behavior changes.
5. Keep the worker HPA in `infra/k8s/base/worker-hpa.yaml` as the single source of truth for worker autoscaling.

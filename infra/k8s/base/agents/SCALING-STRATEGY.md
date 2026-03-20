# Agent Scaling Strategy — Infrastructure-as-Code Specification

**Scope:** `infra/k8s/base/agents/*` and queue-backed worker autoscaling.
**Last Updated:** 2026-03-19

## 1. Workload Profiles

| Profile | Intended workloads | MAX_CONCURRENT_REQUESTS | DB pool / pod | Scaling stance |
|---|---|---:|---:|---|
| latency-sensitive | Interactive lifecycle stages that sit on the user-facing critical path | 6 | 4 | Keep warm capacity, then fan out through HPA. |
| financial-critical | Heavier execution paths where each request holds CPU, memory, and DB state for longer | 4 | 3 | Prefer narrower pods with bounded DB pressure; scale out before increasing per-pod fan-in. |
| low-frequency async | Queue-backed and bursty async agents, including low-frequency KEDA workloads | 2 | 2 | Prefer HPA/KEDA replica growth over deep in-pod queues. |
| queue-worker | Shared BullMQ worker deployment | 4 (`AGENT_QUEUE_CONCURRENCY`) | 4 (`DATABASE_POOL_SIZE`) | Use queue depth as the primary scaling signal; keep per-worker fan-out bounded. |

## 2. Inventory of Agent Manifests

| Agent | Profile | CPU request | Memory request | Autoscaler min | Autoscaler max | Autoscaler type | Current MAX_CONCURRENT_REQUESTS | DB pool / pod |
|---|---|---:|---:|---:|---:|---|---:|---:|
| benchmark-agent | low-frequency async | 150m | 384Mi | 0 | 10 | KEDA ScaledObject | 2 | 2 |
| communicator-agent | low-frequency async | 100m | 256Mi | 0 | 8 | KEDA ScaledObject | 2 | 2 |
| company-intelligence-agent | low-frequency async | 150m | 384Mi | 0 | 10 | KEDA ScaledObject | 2 | 2 |
| coordinator-agent | low-frequency async | 150m | 384Mi | 0 | 8 | KEDA ScaledObject | 2 | 2 |
| expansion-agent | latency-sensitive | 200m | 512Mi | 3 | 12 | HPA | 6 | 4 |
| financial-modeling-agent | financial-critical | 200m | 512Mi | 3 | 10 | HPA | 4 | 3 |
| groundtruth-agent | low-frequency async | 150m | 384Mi | 0 | 8 | KEDA ScaledObject | 2 | 2 |
| integrity-agent | latency-sensitive | 100m | 256Mi | 2 | 6 | HPA | 6 | 4 |
| intervention-designer-agent | low-frequency async | 250m | 640Mi | 0 | 12 | KEDA ScaledObject | 2 | 2 |
| narrative-agent | low-frequency async | 200m | 512Mi | 0 | 10 | KEDA ScaledObject | 2 | 2 |
| opportunity-agent | latency-sensitive | 500m | 1Gi | 2 | 8 | HPA | 6 | 4 |
| outcome-engineer-agent | low-frequency async | 250m | 640Mi | 0 | 12 | KEDA ScaledObject | 2 | 2 |
| realization-agent | financial-critical | 750m | 1536Mi | 2 | 10 | HPA | 4 | 3 |
| research-agent | low-frequency async | 200m | 512Mi | 3 | 14 | HPA | 2 | 2 |
| system-mapper-agent | low-frequency async | 200m | 512Mi | 0 | 10 | KEDA ScaledObject | 2 | 2 |
| target-agent | latency-sensitive | 100m | 256Mi | 2 | 6 | HPA | 6 | 4 |
| value-eval-agent | low-frequency async | 150m | 384Mi | 0 | 10 | KEDA ScaledObject | 2 | 2 |
| value-mapping-agent | low-frequency async | 150m | 384Mi | 0 | 10 | KEDA ScaledObject | 2 | 2 |

## 3. Aggregate Connection-Pressure Guardrails

The new profile split intentionally lowers per-pod DB fan-in before increasing autoscaler ceilings:

- **Latency-sensitive:** worst-case pool pressure is `12 replicas * 4 connections = 48` for the largest interactive class, instead of `12 * 5 = 60` under the old shared default.
- **Financial-critical:** heavy pods cap at `10 replicas * 3 connections = 30`, which keeps financial-modeling and realization under the old `10/12 * 5` connection envelope.
- **Low-frequency async:** scale-to-zero classes can now fan out to `8-12` replicas while still staying at `16-24` aggregate DB connections because each pod only carries a pool of `2`.
- **Queue worker:** the shared worker now advertises `AGENT_QUEUE_CONCURRENCY=4` and `DATABASE_POOL_SIZE=4` so queue bursts scale through HPA instead of a silent default pool of `10` per pod.

## 4. Autoscaling Rules of Thumb

1. Lower concurrency first for CPU-throttled or memory-spiky agents.
2. Raise HPA/KEDA replica ceilings only if queue depth and p95 latency remain high after concurrency is reduced.
3. Keep DB pool changes coupled to autoscaler max replica changes; never change one without recalculating the aggregate connection envelope.
4. Use the saturation dashboard before changing profile defaults so replica, queue, CPU, and latency evidence stay aligned.

# Agent Scaling Strategy — Infrastructure-as-Code Specification

**Scope:** OpportunityAgent, RealizationAgent
**Last Updated:** 2026-02-12

---

## 1. Problem Statement

Load tests (`tests/load/locustfile.py`) identified bottlenecks in the
UnifiedAgentOrchestrator under concurrent "Value Case" generation. The move to
memory-first architecture shifted compute pressure from the orchestrator to
individual agents — particularly OpportunityAgent (discovery phase, LLM-heavy
hypothesis generation) and RealizationAgent (execution planning, heavier model
post-processing). The infrastructure must absorb sudden spikes in Value Case
creation without dropping events, while optimizing for cost.

---

## 2. Queue-Based Scaling Logic

### How it works

```
                    ┌──────────────┐
  Value Case        │              │
  Creation ────────►│ Redis Stream │──── XREADGROUP ────► Agent Pod 1
  Requests          │ (valuecanvas │──── XREADGROUP ────► Agent Pod 2
                    │  .events)    │──── XREADGROUP ────► Agent Pod N
                    │              │
                    └──────┬───────┘
                           │
                    XPENDING count
                    exposed via
                    prometheus-adapter
                           │
                           ▼
                    ┌──────────────┐
                    │     HPA      │
                    │ External     │
                    │ Metric:      │
                    │ redis_stream │
                    │ _pending_    │
                    │ messages     │
                    └──────────────┘
```

1. **Publish:** Backend publishes `agent_message` events to the
   `valuecanvas.events` Redis Stream via `RedisStreamBroker.publish()`.

2. **Consumer Groups:** Each agent deployment runs N consumer group members
   (configured via `consumerGroupSize`). Redis distributes messages across
   consumers within a group — no duplicate processing within a group.

3. **Queue Depth Metric:** `redis-exporter` (sidecar on the Redis StatefulSet)
   exposes `redis_stream_length` and `redis_stream_pending` to Prometheus.
   The `prometheus-adapter` ConfigMap (`prometheus-adapter-rules.yaml`)
   translates this into a Kubernetes external metric.

4. **HPA Decision:** The HPA evaluates `redis_stream_pending_messages` per pod.
   When the average pending count exceeds the target (20 for opportunity, 15 for
   realization), the HPA scales up. CPU and memory utilization act as secondary
   triggers.

5. **Scale-Up:** Zero stabilization window — new pods start immediately. Up to
   +100% capacity or +4 pods per 30s, whichever is greater.

6. **Scale-Down:** 5-minute stabilization window prevents flapping. Maximum 25%
   reduction per 2-minute period.

### Why queue depth over CPU alone

CPU-based scaling reacts to *current* load but cannot anticipate *queued* load.
During a spike in Value Case generation:

- Messages accumulate in the Redis Stream faster than pods can process them.
- CPU stays moderate because each pod is blocked on LLM API calls (I/O-bound).
- Queue depth rises immediately, triggering scale-up before CPU would.

This is the same pattern used by the existing `message-worker` HPA in
`infra/k8s/messaging/redis-streams.yaml`.

---

## 3. Backpressure Handling

### At the RedisStreamBroker level

The broker already implements several backpressure mechanisms:

| Mechanism | Config Key | Default | Purpose |
|---|---|---|---|
| Batch concurrency | `batchConcurrency` | 5 | Limits parallel event processing per consumer |
| Read count | `readCount` | 50 | Max messages pulled per XREADGROUP call |
| Block timeout | `blockMs` | 2000ms | Prevents busy-wait when stream is empty |
| Idle claim | `claimIdleMs` | 60000ms | XAUTOCLAIM reclaims messages from dead consumers |
| Max deliveries | `maxDeliveries` | 3 | Poison messages go to DLQ after 3 attempts |
| Idempotency TTL | `idempotencyTtlMs` | 1 hour | Deduplicates reprocessed messages |

### At the pod level (new)

Each agent pod enforces `MAX_CONCURRENT_REQUESTS` (env var). When the in-flight
count hits the limit, the pod stops calling XREADGROUP until a slot frees up.
This prevents OOM from unbounded context window accumulation during LLM calls.

- OpportunityAgent: 10 concurrent (lighter per-request memory)
- RealizationAgent: 8 concurrent (heavier model context)

### During spot preemption

When a spot node is reclaimed:

1. Kubernetes sends SIGTERM to the pod.
2. `preStop` hook sleeps 15s (opportunity) / 15s (realization) to allow
   in-flight requests to complete.
3. `terminationGracePeriodSeconds` is 30s (opportunity) / 45s (realization).
4. Any unacknowledged messages remain in the Redis Stream PEL (Pending Entries
   List).
5. Other consumers in the group run XAUTOCLAIM after `claimIdleMs` (60s) and
   pick up orphaned messages.
6. Messages that exceed `maxDeliveries` (3) go to the DLQ stream
   (`valuecanvas.events:dlq`).

**No events are dropped.** The at-least-once delivery guarantee of Redis Streams
consumer groups ensures every message is either processed or moved to the DLQ.

---

## 4. Resource Requests and Limits

### OpportunityAgent

| Resource | Request | Limit | Rationale |
|---|---|---|---|
| CPU | 500m | 1500m | I/O-bound (LLM calls); burst headroom for response parsing |
| Memory | 1Gi | 2Gi | 10 concurrent requests × ~100MB context window each |

### RealizationAgent

| Resource | Request | Limit | Rationale |
|---|---|---|---|
| CPU | 750m | 2000m | Heavier model post-processing (value trees, risk matrices) |
| Memory | 1536Mi | 3Gi | 8 concurrent requests × ~180MB context window each |

### Redis Broker (existing, no changes)

| Resource | Request | Limit |
|---|---|---|
| CPU | 100m | 500m |
| Memory | 512Mi | 1Gi |

---

## 5. HPA Configuration Summary

| Parameter | OpportunityAgent | RealizationAgent |
|---|---|---|
| minReplicas | 2 | 2 |
| maxReplicas | 8 | 10 |
| Queue depth target (avg/pod) | 20 | 15 |
| CPU target | 65% | 60% |
| Memory target | 75% | 70% |
| Scale-up stabilization | 0s | 0s |
| Scale-up max burst | +100% or +4 pods / 30s | +100% or +4 pods / 30s |
| Scale-down stabilization | 300s | 300s |
| Scale-down max rate | -25% / 120s | -25% / 120s |

---

## 6. Spot Instance Strategy

### Why spot is safe for agents

- **Stateless compute:** Agent pods hold no persistent state. All state lives in
  Redis Streams (message queue) and Postgres (memory planes).
- **At-least-once delivery:** XAUTOCLAIM recovers orphaned messages.
- **PodDisruptionBudgets:** `minAvailable: 1` ensures at least one pod survives
  voluntary disruptions.
- **Pod anti-affinity:** Pods spread across nodes, reducing blast radius of a
  single spot reclamation.

### Where spot is NOT safe

- **Redis Broker StatefulSet:** Must run on on-demand nodes. Data loss from
  preemption would lose the stream. The existing StatefulSet in
  `infra/k8s/messaging/redis-streams.yaml` has no spot tolerations — keep it
  that way.
- **Postgres:** Already on on-demand nodes.

### Cost impact estimate

Spot instances typically cost 60-90% less than on-demand. With agents running
on spot:

- Base cost (2 pods each, on-demand): ~$X/month
- Spot cost (2 pods each, spot): ~$0.2X-0.4X/month
- Burst cost (up to 8-10 pods, spot): Still cheaper than 3 on-demand pods

The `weight: 80` on the node affinity preference means the scheduler *prefers*
spot but will fall back to on-demand if no spot capacity is available.

---

## 7. Files Changed

| File | Change |
|---|---|
| `infra/k8s/base/agents/opportunity/deployment.yaml` | Added spot tolerations, node affinity, pod anti-affinity, `MAX_CONCURRENT_REQUESTS` env, bumped CPU limit to 1500m, replaced HPA with queue-depth-aware version, added PDB |
| `infra/k8s/base/agents/realization/deployment.yaml` | **New.** Full deployment + service + PDB for RealizationAgent with spot scheduling |
| `infra/k8s/base/agents/realization/hpa.yaml` | **New.** Queue-depth-aware HPA for RealizationAgent |
| `infra/k8s/base/agents/prometheus-adapter-rules.yaml` | **New.** Prometheus adapter rules to expose Redis Stream metrics as K8s external metrics |

---

## 8. Prerequisites

1. **prometheus-adapter** or **KEDA** installed in the cluster to serve external
   metrics to the HPA.
2. **redis-exporter** sidecar on the Redis StatefulSet to expose
   `redis_stream_length` to Prometheus.
3. Spot node pools configured with the appropriate taints:
   - EKS: `eks.amazonaws.com/capacityType=SPOT:NoSchedule`
   - GKE: `cloud.google.com/gke-spot=true:NoSchedule`
   - AKS: `kubernetes.azure.com/scalesetpriority=spot:NoSchedule`
4. The `valynt-agents` kustomization must include the new realization directory.

---

## 9. KEDA Alternative

If prometheus-adapter is not deployed, KEDA `ScaledObject` can replace the HPA
external metric. KEDA has a native Redis Streams scaler:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: realization-agent-scaler
  namespace: valynt-agents
spec:
  scaleTargetRef:
    name: realization-agent
  minReplicaCount: 2
  maxReplicaCount: 10
  triggers:
    - type: redis-streams
      metadata:
        address: redis-broker.valynt.svc.cluster.local:6379
        stream: valuecanvas.events
        consumerGroup: valuecanvas-workers
        pendingEntriesCount: "15"
```

This is a drop-in replacement that removes the need for prometheus-adapter
entirely. Choose one approach, not both.

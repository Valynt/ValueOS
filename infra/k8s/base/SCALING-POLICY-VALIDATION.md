# Backend/Worker Scaling Policy Validation

This document describes the staged load validation profile for backend and worker autoscaling, aligned to the only two canonical latency classes in ValueOS.

## Canonical latency classes

| Class | Source-of-truth target | Allowed exception policy |
|---|---|---|
| Interactive completion | Completion latency p95 **< 200ms** | No slower completion budget is allowed. Reclassify the route to orchestration before rollout if it cannot meet 200ms. |
| Orchestration acknowledgment/completion | Acknowledgment latency p95 **< 200ms** | Completion latency p95 **< 3000ms** is allowed only for routes explicitly labeled orchestration and backed by streaming or async completion semantics. |

## Signals in use

### Backend (API)
- CPU utilization target: **65%**
- Memory utilization target: **78%**
- External metric: **`backend_http_requests_per_second`** (average value target `8` per pod)
- External metric: **`backend_interactive_http_p95_latency_ms`** (interactive completion threshold `200ms`)
- External metric: **`backend_orchestration_acknowledgment_p95_latency_ms`** (orchestration acknowledgment threshold `200ms`)

### Worker (background-jobs)
- External metric: **`message_worker_queue_depth`** (average value target `30` per pod)
- CPU utilization target: **70%**
- Memory utilization target: **80%**

## HPA behavior defaults (recommended)

### Faster scale-up for bursty traffic
- `scaleUp.stabilizationWindowSeconds`: **15-20s**
- `scaleUp.policies`:
  - `Percent`: **100%** / 30s
  - `Pods`: **+3 to +4** / 30s
- `scaleUp.selectPolicy`: **Max**

### Conservative scale-down
- `scaleDown.stabilizationWindowSeconds`: **360-420s**
- `scaleDown.policies`:
  - `Percent`: **10%** / 60s
  - `Pods`: **-1** / 90-120s
- `scaleDown.selectPolicy`: **Min**

These values avoid slow recovery during spikes while protecting against oscillation after traffic drops.

## Staged k6 scenarios

Use `infra/testing/scaling-policy.k6.js` with staged scenarios:

1. **Steady** (`~12m`)
   - Ramp to 40 VUs and hold
   - Confirms steady-state interactive completion and orchestration acknowledgment behavior
2. **Spike** (`~5m`)
   - Burst arrival rate to 160 req/s then recover
   - Verifies rapid scale-up behavior and bounded error rate for both latency classes
3. **Soak** (`30m`)
   - Sustained 35 req/s
   - Validates long-run memory/cpu pressure and scale-down stability after load ends

## Runbook commands

```bash
# Run staged scenarios against staging
k6 run --env BASE_URL=https://staging.valueos.app infra/testing/scaling-policy.k6.js

# Observe HPA decisions during test
kubectl -n valynt get hpa backend-hpa worker-hpa -w

# Observe external metrics served by adapter
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1/namespaces/valynt/backend_http_requests_per_second" | jq
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1/namespaces/valynt/backend_interactive_http_p95_latency_ms" | jq
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1/namespaces/valynt/backend_orchestration_acknowledgment_p95_latency_ms" | jq
```

## Success criteria

- `http_req_failed` < 2%
- `interactive_completion_latency p95` < 200ms
- `orchestration_acknowledgment_latency p95` < 200ms
- `orchestration_completion_latency p95` < 3000ms
- Backend pods scale out within 30-60s of spike stage
- Worker pods scale out when queue depth persists above target, then scale down gradually over 6-7 minutes

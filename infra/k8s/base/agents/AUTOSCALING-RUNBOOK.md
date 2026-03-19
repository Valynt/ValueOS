# Agent Autoscaling Runbook

## Deployment inventory

All agent Deployments under `infra/k8s/base/agents/*/deployment.yaml` are summarized below.

| Agent | CPU req | Memory req | Autoscaler min/max | MAX_CONCURRENT_REQUESTS | DB pool | Workload profile |
|---|---:|---:|---|---:|---:|---|
| opportunity-agent | 500m | 1Gi | HPA 2/8 | 6 | 4 | latency-sensitive |
| target-agent | 100m | 256Mi | HPA 2/6 | 6 | 4 | latency-sensitive |
| expansion-agent | 200m | 512Mi | HPA 3/12 | 6 | 4 | latency-sensitive |
| integrity-agent | 100m | 256Mi | HPA 2/6 | 6 | 4 | latency-sensitive |
| realization-agent | 750m | 1536Mi | HPA 2/10 | 3 | 2 | financial-critical |
| financial-modeling-agent | 200m | 512Mi | HPA 2/8 | 3 | 2 | financial-critical |
| research-agent | 200m | 512Mi | HPA 3/12 | 6 | 4 | latency-sensitive |
| company-intelligence-agent | 150m | 384Mi | KEDA 0/6 | 2 | 1 | low-frequency-async |
| value-mapping-agent | 150m | 384Mi | KEDA 0/6 | 2 | 1 | low-frequency-async |
| system-mapper-agent | 200m | 512Mi | KEDA 0/6 | 2 | 1 | low-frequency-async |
| intervention-designer-agent | 250m | 640Mi | KEDA 0/8 | 2 | 1 | low-frequency-async |
| outcome-engineer-agent | 250m | 640Mi | KEDA 0/8 | 2 | 1 | low-frequency-async |
| coordinator-agent | 150m | 384Mi | KEDA 0/4 | 2 | 1 | low-frequency-async |
| value-eval-agent | 150m | 384Mi | KEDA 0/6 | 2 | 1 | low-frequency-async |
| communicator-agent | 100m | 256Mi | KEDA 0/4 | 2 | 1 | low-frequency-async |
| benchmark-agent | 150m | 384Mi | KEDA 0/6 | 2 | 1 | low-frequency-async |
| narrative-agent | 200m | 512Mi | KEDA 0/6 | 2 | 1 | low-frequency-async |
| groundtruth-agent | 150m | 384Mi | KEDA 0/4 | 2 | 1 | low-frequency-async |

## Workload profiles

`infra/k8s/base/agents/configmap.yaml` is the source of truth for shared tuning values:

- **latency-sensitive** → `MAX_CONCURRENT_REQUESTS=6`, `DB_CONNECTION_POOL_SIZE=4`
- **financial-critical** → `MAX_CONCURRENT_REQUESTS=3`, `DB_CONNECTION_POOL_SIZE=2`
- **low-frequency-async** → `MAX_CONCURRENT_REQUESTS=2`, `DB_CONNECTION_POOL_SIZE=1`

Use profile changes only after checking `infra/grafana/dashboards/agent-saturation.json` for CPU throttling, memory RSS, queue depth, and p95 execution latency.

## Active autoscaling resources

Resources actually applied by `infra/k8s/base/agents/kustomization.yaml`:

- HPA: opportunity-agent
- HPA: target-agent
- HPA: expansion-agent
- HPA: integrity-agent
- HPA: realization-agent
- HPA: financial-modeling-agent
- HPA: research-agent
- KEDA: company-intelligence-agent
- KEDA: value-mapping-agent
- KEDA: system-mapper-agent
- KEDA: intervention-designer-agent
- KEDA: outcome-engineer-agent
- KEDA: coordinator-agent
- KEDA: value-eval-agent
- KEDA: communicator-agent
- KEDA: benchmark-agent
- KEDA: narrative-agent
- KEDA: groundtruth-agent

## Common autoscaling template guidance

Use `infra/k8s/base/agents/autoscaling-template.yaml` as the starting pattern, but apply workload-specific overrides before promoting changes:

- External metric: `agent_queue_depth`
- Metric labels:
  - `queue=agent-tasks`
  - `agent_type=<agent-name>`
- Secondary resource guardrails:
  - CPU `averageUtilization: 65`
  - Memory `averageUtilization: 75`
- Interactive / warm agents can use faster scale-up.
- Low-frequency queue workers should prefer KEDA scale-to-zero with tiny DB pools.
- Financial-critical agents should use smaller queue thresholds and smaller scale-up steps.

## Metrics adapter configuration

1. Deploy prometheus-adapter with external metrics enabled.
2. Merge the rules in `infra/k8s/base/agents/prometheus-adapter-rules.yaml` under `rules.external`.
3. Ensure Prometheus scrapes a metric with this shape:

```text
valueos_agent_queue_depth{namespace="valynt-agents",queue="agent-tasks",agent_type="opportunity"} 42
```

4. Verify metric discovery:

```bash
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1/namespaces/valynt-agents/agent_queue_depth" | jq
```

5. Verify per-agent label selectors work:

```bash
kubectl describe hpa opportunity-agent -n valynt-agents
kubectl describe hpa financial-modeling-agent -n valynt-agents
kubectl get scaledobject -n valynt-agents
```

## Queue metric labels per agent

For each agent, publish queue depth with `queue=agent-tasks` and matching `agent_type` where HPA is used, or matching `consumer_group` in `redis_stream_length` where KEDA is used:

- opportunity
- target
- expansion
- integrity
- realization
- financial-modeling
- research
- company-intelligence
- value-mapping
- system-mapper
- intervention-designer
- outcome-engineer
- coordinator
- value-eval
- communicator
- benchmark
- narrative
- groundtruth

# Agent Autoscaling Runbook

## Deployment inventory

All agent Deployments under `infra/k8s/base/agents/*/deployment.yaml`:

- opportunity-agent
- target-agent
- expansion-agent
- integrity-agent
- realization-agent
- company-intelligence-agent
- financial-modeling-agent
- value-mapping-agent
- system-mapper-agent
- intervention-designer-agent
- outcome-engineer-agent
- coordinator-agent
- value-eval-agent
- communicator-agent
- research-agent
- benchmark-agent
- narrative-agent
- groundtruth-agent

## HPA inventory

All HPAs under `infra/k8s/base/agents/*hpa*.yaml` and `infra/k8s/base/agents/*/hpa*.yaml`:

- opportunity-agent
- target-agent
- expansion-agent
- integrity-agent
- realization-agent
- company-intelligence-agent
- financial-modeling-agent
- value-mapping-agent
- system-mapper-agent
- intervention-designer-agent
- outcome-engineer-agent
- coordinator-agent
- value-eval-agent
- communicator-agent
- research-agent
- benchmark-agent
- narrative-agent
- groundtruth-agent

## Common autoscaling template

Use `infra/k8s/base/agents/autoscaling-template.yaml` as the standard template.

Template requirements:

- External metric: `agent_queue_depth`
- Metric labels:
  - `queue=agent-tasks`
  - `agent_type=<agent-name>`
- Queue-depth target: `averageValue: "8"` to `"12"` depending on workload complexity
- Secondary resource guardrails:
  - CPU `averageUtilization: 65`
  - Memory `averageUtilization: 75`
- Burst scale-up objective (>100 pending tasks):
  - `scaleUp.stabilizationWindowSeconds: 0`
  - Percent policy: `200% / 30s`
  - Pod policy: `+10 pods / 30s`
  - `selectPolicy: Max`

## Tier-aware overlays

Two overlays are provided:

- `infra/k8s/overlays/agents/low-tier`
  - Sets `minReplicas: 0` for every agent HPA.
  - Suitable for cost-sensitive tenants with cold-start tolerance.
- `infra/k8s/overlays/agents/premium-tier`
  - Keeps warm replicas (`minReplicas: 2`) for every agent HPA.
  - Suitable for latency-sensitive premium tenants.

Apply examples:

```bash
kubectl apply -k infra/k8s/overlays/agents/low-tier
kubectl apply -k infra/k8s/overlays/agents/premium-tier
```

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
```

## Queue metric labels per agent

For each agent, publish queue depth with `queue=agent-tasks` and matching `agent_type`:

- opportunity
- target
- expansion
- integrity
- realization
- company-intelligence
- financial-modeling
- value-mapping
- system-mapper
- intervention-designer
- outcome-engineer
- coordinator
- value-eval
- communicator
- research
- benchmark
- narrative
- groundtruth

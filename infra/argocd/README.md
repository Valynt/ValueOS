# Argo CD applications for ValueOS

## `valueos-agents` ApplicationSet

Apply the ApplicationSet:

```bash
kubectl apply -f infra/argocd/valueos-agents-appset.yaml
```

This creates one Argo CD `Application` per agent (`valueos-<agentName>`) from a single template. Each app points to a Kustomize overlay under:

- `infra/k8s/overlays/agents/workloads/<agentName>`

Per-agent image/tag, CPU/memory requests/limits, and env overrides are defined in the list generator.

## Argo project and app operations

Sync the orchestrator app:

```bash
argocd app sync valueos-orchestrator
```

Sync all generated agent apps:

```bash
argocd app sync -l app.kubernetes.io/component=agent
```

Check overall app status:

```bash
argocd app list --project valueos
```

## Health checks for `valueos-agents` namespace

Check Argo app health for generated apps:

```bash
argocd app get valueos-opportunity
argocd app get valueos-realization
```

Check Kubernetes workload health in namespace:

```bash
kubectl get deploy,pod,hpa -n valueos-agents
kubectl get events -n valueos-agents --sort-by=.lastTimestamp
```

Quickly verify all agent deployments are available:

```bash
kubectl wait --for=condition=Available deployment --all -n valueos-agents --timeout=180s
```

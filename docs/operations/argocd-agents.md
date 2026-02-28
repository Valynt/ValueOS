# Argo CD operations for ValueOS agents

## Applications

- `valueos-orchestrator`: shared platform resources, namespace bootstrap, and orchestrator services.
- `valueos-agents` (ApplicationSet): renders one Argo `Application` per agent workload in `valueos-agents`.

## Sync commands

```bash
argocd app sync valueos-orchestrator
argocd app sync valueos-agent-opportunity
argocd app sync valueos-agent-realization
```

To sync all generated agent applications in one pass:

```bash
argocd app list --project valueos -o name | grep '^valueos-agent-' | xargs -n1 argocd app sync
```

## Health checks (`valueos-agents` namespace)

```bash
argocd app wait valueos-orchestrator --health --sync --timeout 300
argocd app wait valueos-agent-opportunity --health --sync --timeout 300
kubectl get pods -n valueos-agents
kubectl get deploy -n valueos-agents
kubectl get hpa -n valueos-agents
```

Expected results:

- Argo reports `Synced` and `Healthy`.
- Pods in `valueos-agents` are `Running` or `Completed`.
- Deployments show `AVAILABLE` replicas.
- HPAs (where configured) report valid target metrics.

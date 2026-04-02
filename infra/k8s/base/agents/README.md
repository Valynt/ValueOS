# Agent Deployments and Production Isolation

All agent workloads under `infra/k8s/base/agents/*/deployment.yaml` use explicit pod-level sidecar injection:

```yaml
spec:
  template:
    metadata:
      annotations:
        sidecar.istio.io/inject: "true"
```

## Production isolation controls

The base Kustomize bundle now includes hard isolation controls for production runtime safety:

- **Namespace default deny policy** (`isolation-guardrails.yaml`) blocks all ingress/egress by default.
  Per-agent allowlists are declared in `network-policy.yaml`.
- **ResourceQuota + LimitRange** cap total namespace usage and enforce per-container defaults/maximums.
- **Read-only service account RBAC** (`role.yaml` + `rolebinding.yaml`) grants agents only `get` on `configmaps` and `secrets`.

These controls ensure each agent runs in a constrained containerized boundary with explicit network and resource permissions.

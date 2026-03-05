# Agent Deployments and Istio Sidecar Injection

All agent workloads under `infra/k8s/base/agents/*/deployment.yaml` use an explicit **pod-level sidecar annotation** strategy:

```yaml
spec:
  template:
    metadata:
      annotations:
        sidecar.istio.io/inject: "true"
```

This method is chosen instead of relying only on namespace labels so every agent deployment remains self-describing and continues to inject the Istio proxy even when moved to another namespace or rendered in isolation.

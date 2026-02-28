# Agent Base Manifests

## Istio sidecar injection strategy

All agent Deployments under `infra/k8s/base/agents/*/deployment.yaml` use an explicit **pod-level annotation**:

- `sidecar.istio.io/inject: "true"`

We use pod annotations (instead of relying only on namespace labels) so sidecar behavior remains deterministic even when manifests are promoted across namespaces with different defaults.

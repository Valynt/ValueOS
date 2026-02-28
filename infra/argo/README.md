# Argo CD agent ApplicationSet

This directory contains Argo CD manifests used to deploy all agent workloads from `infra/k8s/base/agents/*`.

## Files

- `agent-template.yaml`: `ApplicationSet` that generates one Argo `Application` per agent deployment directory.
- `kustomization.yaml`: Kustomize entrypoint for applying all Argo resources in this folder.

## Expected Argo CD project

The generated applications use Argo CD project name:

- `valueos`

Ensure this Argo CD project exists before syncing.

## Sync workflow

1. Add or update an agent deployment under `infra/k8s/base/agents/<agent>/deployment.yaml`.
2. Add the `<agent>` entry to `infra/argo/agent-template.yaml` so Argo generates a matching `Application`.
3. Apply this folder in the Argo CD control plane namespace:
   - `kubectl apply -k infra/argo`
4. Argo CD generates one `Application` per agent and syncs it to namespace `valynt-agents`.

## Notes

- Destination namespace is intentionally `valynt-agents` to match current Kubernetes manifests.
- `source.path` values in the template point to real existing agent directories under `infra/k8s/base/agents/`.

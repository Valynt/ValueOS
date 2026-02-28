# Argo CD agent sync

This directory contains the ApplicationSet used to deploy each agent manifest under `infra/k8s/base/agents/*`.

## Expected Argo CD project

Use the Argo CD project name **`valynt`** for the generated Applications.

## Sync workflow

1. Update an agent deployment in `infra/k8s/base/agents/<agent>/deployment.yaml`.
2. Ensure `infra/argo/agent-template.yaml` includes that agent in the generator list.
3. Apply the ApplicationSet:

   ```bash
   kubectl apply -n argocd -f infra/argo/agent-template.yaml
   ```

4. Argo CD generates one Application per agent with:
   - `source.path: infra/k8s/base/agents/<agent>`
   - destination namespace `valynt-agents`

## Keeping the list complete

The list in `agent-template.yaml` should match all current directories containing:

```text
infra/k8s/base/agents/*/deployment.yaml
```

When adding a new agent directory with a deployment manifest, append it to the ApplicationSet list so Argo CD continues to manage all agents.

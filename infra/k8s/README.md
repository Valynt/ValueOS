# ValueOS Kubernetes Deployment

Complete Kubernetes deployment configuration for ValueOS using Kustomize.

> **Canonical production deployment path:** `infra/k8s/overlays/production/`, applied by `.github/workflows/deploy.yml`.
>
> **Reference-only paths for production promotion:** `ops/compose/`, `infra/docker/`, `infra/k8s/overlays/staging/`, and `infra/k8s/observability/` remain useful for local validation, staging rehearsal, or supporting telemetry, but they are not the production promotion path.
>
> **Readiness status:** Kubernetes is the shared-environment runtime, but individual manifest groups stay **Aspirational** until a live validation run passes and a fresh benchmark artifact is present in `docs/operations/load-test-artifacts/staging/latest.json`.

## Canonical production path

| Path | Role | Production status |
| --- | --- | --- |
| `infra/k8s/overlays/production/` | Canonical deployable production overlay. | **Canonical** |
| `infra/k8s/base/` | Source manifests consumed by overlays. | Reference-only unless promoted through the production overlay |
| `infra/k8s/overlays/staging/` | Shared staging rehearsal path for the same runtime. | Reference-only for production |
| `infra/k8s/observability/` | Supporting telemetry stack manifests. | Reference-only for production |
| `ops/compose/` | Local and prod-like workstation validation only. | Reference-only for production |
| `infra/docker/` | Legacy wrappers and compatibility shims. | Reference-only for production |

## Validation evidence

- Canonical benchmark ledger: `docs/operations/load-test-baselines.md`
- Latest staged benchmark manifest: `docs/operations/load-test-artifacts/staging/latest.json`
- Timestamped run directory pattern: `docs/operations/load-test-artifacts/staging/<timestamp>/`
- Promotion gate: `node scripts/ci/check-load-test-artifacts.mjs --manifest artifacts/load-tests/staging/latest.json --max-age-hours 24 --require-pass true`

### Latest live validation attempt

- **Timestamp:** `2026-03-19T13:03:31Z`
- **Target:** `https://staging.valueos.app`
- **Outcome:** failed before application readiness because the edge returned `403 Forbidden`; no valid pod-count or queue-depth telemetry was available from this environment.
- **Impact:** readiness states below remain unchanged until a fresh run passes.

## Manifest readiness

| Manifest | Status | Notes |
| --- | --- | --- |
| `base/configmap.yaml` | Validated | Base config with overlay-required overrides for `node-env` and `app-env`. |
| `base/backend-deployment.yaml` | Aspirational | Canonical production path exists, but live benchmark evidence has not passed yet. |
| `base/frontend-*-deployment.yaml` | Aspirational | Blue-green setup is defined but still needs a passing live validation run. |
| `base/hpa.yaml` | Aspirational | HPA metrics and thresholds now have a staged validation workflow, but the latest live run failed at the edge. |
| `base/network-policies.yaml` | Aspirational | Still requires cluster validation after a passing live benchmark run. |
| `base/external-secrets.yaml` | Aspirational | Still requires operator/backend validation in a live cluster. |
| `overlays/staging/` | Reference-only | Staging rehearsal path for the canonical runtime; not the production promotion path. |
| `overlays/production/` | Aspirational | Canonical production path, but not marked validated until the benchmark artifact gate passes. |
| `observability/` | Reference-only | Supporting telemetry manifests only; not a deploy promotion path on their own. |

### Promotion to validated

To promote any Kubernetes manifest group from **Aspirational** to **Validated**:

1. Deploy the canonical runtime path (`infra/k8s/overlays/production/` for production, `infra/k8s/overlays/staging/` for rehearsal).
2. Run both baseline scripts against the real target:
   - `infra/testing/load-test.k6.js`
   - `infra/testing/scaling-policy.k6.js`
3. Persist the timestamped outputs under `docs/operations/load-test-artifacts/staging/<timestamp>/` plus CI upload artifacts.
4. Confirm `docs/operations/load-test-artifacts/staging/latest.json` is fresh and `live_validation_passed=true`.
5. Only then update the status table from **Aspirational**.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS ALB Ingress                       │
│                    (app.valueos.com)                      │
└────────────────────┬───────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│   Frontend    │         │    Backend    │
│   (Nginx)     │────────▶│   (Express)   │
│   Port: 80    │         │   Port: 3001  │
└───────────────┘         └───────┬───────┘
                                  │
                     ┌────────────┴────────────┐
                     │                         │
                     ▼                         ▼
              ┌──────────────┐         ┌──────────────┐
              │   Supabase   │         │    Redis     │
              │  (PostgreSQL)│         │   (Cache)    │
              └──────────────┘         └──────────────┘
```

## Directory Structure

```
infra/k8s/
├── base/                    # Base Kubernetes manifests
│   ├── namespace.yaml
│   ├── serviceaccount.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   └── kustomization.yaml
└── overlays/               # Environment-specific overlays
    ├── staging/
    │   ├── kustomization.yaml
    │   └── deployment-patch.yaml
    └── production/
        ├── kustomization.yaml
        └── deployment-patch.yaml
```

## Agent Workload Identity (Istio + Kubernetes)

### ServiceAccount naming convention

Every agent deployment under `infra/k8s/base/agents/*/deployment.yaml` must use a dedicated ServiceAccount named:

- `<agent-name>-agent`

Examples:

- `opportunity-agent`
- `financial-modeling-agent`
- `value-eval-agent`

The shared `valynt-agent` ServiceAccount is prohibited for agent workloads.

### SPIFFE principal convention

Agent authorization policies in `infra/k8s/security/mesh-authentication.yaml` assume Istio's default trust domain (`cluster.local`) and namespace-local identities:

- `cluster.local/ns/valynt-agents/sa/<agent-name>-agent`

Caller identities from the backend namespace use:

- `cluster.local/ns/valynt/sa/valynt-backend`

If your mesh trust domain is customized, update all principal strings consistently in policy manifests and runbooks before rollout.

### Validation gates

CI enforces ServiceAccount isolation with:

```bash
node scripts/ci/check-agent-service-accounts.mjs
```

This check fails when any agent deployment:

- uses `serviceAccountName: valynt-agent`,
- reuses a ServiceAccount already assigned to another agent deployment, or
- references a ServiceAccount not declared in `infra/k8s/base/agents/serviceaccounts.yaml`.

## Prerequisites

1. **Kubernetes cluster** running (staging or production)
2. **kubectl** configured to access the cluster
3. **Kustomize** installed
4. **Ingress controller** installed in cluster
5. **Metrics Server** installed (for HPA)

## Quick Start

### 1. Configure kubectl

```bash
aws eks update-kubeconfig \
  --name valueos-staging-cluster \
  --region us-east-1
```

### 2. Verify cluster access

```bash
kubectl get nodes
kubectl get namespaces
```

### 3. Create secrets

```bash
kubectl create secret generic valueos-secrets \
  --from-literal=supabase-url="https://xxx.supabase.co" \
  --from-literal=supabase-anon-key="eyJ..." \
  --from-literal=supabase-service-key="eyJ..." \
  --from-literal=together-api-key="xxx" \
  --from-literal=openai-api-key="sk-xxx" \
  --from-literal=jwt-secret="xxx" \
  --namespace=valynt-staging
```

### 4. Update image references

Edit `infra/k8s/overlays/staging/kustomization.yaml` or `infra/k8s/overlays/production/kustomization.yaml` as appropriate.

### 5. Deploy the canonical path

```bash
kustomize build infra/k8s/overlays/production | kubectl apply -f -
```

### 6. Verify deployment

```bash
kubectl get pods -n valynt
kubectl get services -n valynt
kubectl get ingress -n valynt
```

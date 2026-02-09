# Spec: Hardened Production Kubernetes Infrastructure

## Problem Statement

The existing Kubernetes manifests in `infra/k8s/` have partial implementations of HA features that are incomplete, inconsistent, or broken:

- **Blue-Green deployments** exist only for backend, contain duplicate label keys (`version` appears twice in template metadata), and aren't wired into `kustomization.yaml` or the service selector. No frontend blue-green exists.
- **PDB** exists for backend (`minAvailable: 1`) but isn't referenced in `kustomization.yaml`. No frontend PDB exists.
- **HPAs** are duplicated across `hpa.yaml` and `backend-hpa.yaml` with conflicting scaling behaviors.
- **Zero-trust network policies** in `infra/k8s/security/zero-trust-network-policies.yaml` target namespace `valueos` instead of `valynt`, and reference Istio components not present in the base ALB-based setup.
- **Merge conflicts** exist in `backend-deployment.yaml` (unresolved `<<<<<<< HEAD` markers).
- The production overlay uses deprecated `bases:` instead of `resources:`.

This work delivers production-ready HA manifests with blue-green deployments, PDBs, HPAs, and zero-trust network security for both `valynt-backend` and `valynt-frontend`.

## Decisions (from clarification)

| Decision | Choice |
|---|---|
| Production namespace | `valynt` |
| Blue-Green scope | Both backend and frontend |
| Blue-Green mechanism | Separate blue/green services + an `active` service patched during switch |
| Zero-trust approach | Hybrid: native K8s NetworkPolicies (L3/L4) + Istio AuthorizationPolicies (L7) |
| Fix existing issues | Only in files directly touched by this work |
| PDB strategy | Backend: `minAvailable: 2` (of 3 replicas), Frontend: `minAvailable: 1` (of 2 replicas) |

## Requirements

### R1: Fix `backend-deployment.yaml` merge conflicts

Resolve the `<<<<<<< HEAD` / `=======` / `>>>>>>>` markers in `infra/k8s/base/backend-deployment.yaml`. Keep the cost-tracking annotations and the properly indented container spec (the `>>>>>>>` side has correct 2-space nesting under `containers`).

### R2: Blue-Green Deployments for Backend

**Files to modify/create:**
- `infra/k8s/base/backend-blue-deployment.yaml` — fix duplicate `version` label in template metadata, add `slot: blue` label
- `infra/k8s/base/backend-green-deployment.yaml` — fix duplicate `version` label, add `slot: green` label, keep `replicas: 0`
- `infra/k8s/base/backend-service.yaml` — rename to `backend-active-service.yaml`, add `slot: blue` selector (blue is active by default)
- `infra/k8s/base/backend-blue-service.yaml` — new, selects `app: backend, slot: blue`
- `infra/k8s/base/backend-green-service.yaml` — new, selects `app: backend, slot: green`

**Blue-Green switch mechanism:**
- The `backend-active` service selector gets patched from `slot: blue` to `slot: green` (or vice versa) during deployment
- Blue and green services exist for direct testing of each slot before switching
- Both blue and green deployments share the same env vars, security context, probes, and resource config from the base `backend-deployment.yaml` pattern

### R3: Blue-Green Deployments for Frontend

**Files to create:**
- `infra/k8s/base/frontend-blue-deployment.yaml` — based on existing `frontend-deployment.yaml`, with `slot: blue` label, `replicas: 2`
- `infra/k8s/base/frontend-green-deployment.yaml` — same but `slot: green`, `replicas: 0`
- `infra/k8s/base/frontend-active-service.yaml` — replaces `frontend-service.yaml`, selects `app: frontend, slot: blue`
- `infra/k8s/base/frontend-blue-service.yaml` — selects `app: frontend, slot: blue`
- `infra/k8s/base/frontend-green-service.yaml` — selects `app: frontend, slot: green`

### R4: Pod Disruption Budgets

**Backend PDB** (`infra/k8s/base/backend-pdb.yaml` — modify existing):
- `minAvailable: 2` (ensures 2 of 3 production replicas stay up during voluntary disruptions)
- Selector: `app: backend` (covers both blue and green pods)

**Frontend PDB** (`infra/k8s/base/frontend-pdb.yaml` — new):
- `minAvailable: 1` (ensures 1 of 2 production replicas stays up)
- Selector: `app: frontend`

### R5: Horizontal Pod Autoscalers

Consolidate the duplicate HPA files. Remove `infra/k8s/base/backend-hpa.yaml` (the standalone one). Keep and update `infra/k8s/base/hpa.yaml` as the single source of truth containing both backend and frontend HPAs.

**Backend HPA** (targets `backend-blue` deployment — the active slot):
- `minReplicas: 2`, `maxReplicas: 10`
- CPU target: 70% utilization
- Memory target: 80% utilization
- Scale-down: stabilization 300s, max 10% per 60s
- Scale-up: stabilization 60s, max 50% or 2 pods per 60s

**Frontend HPA** (targets `frontend-blue` deployment):
- `minReplicas: 2`, `maxReplicas: 5`
- CPU target: 70% utilization
- Scale-down: stabilization 300s
- Scale-up: stabilization 0s

Note: HPAs target the blue deployments by default. During a blue-green switch, the HPA `scaleTargetRef` must be updated to point to the newly active deployment. This is a deployment-time concern, not a manifest concern — document it in a comment.

### R6: Zero-Trust Network Policies (L3/L4)

Update `infra/k8s/security/zero-trust-network-policies.yaml` to target namespace `valynt` instead of `valueos`. The file contains 6 policies:

1. **`zero-trust-default-deny`** — deny all ingress/egress by default (namespace-wide). Change namespace to `valynt`.
2. **`allow-ingress-from-gateway`** — allow ingress to `app.kubernetes.io/component: api` from Istio ingress gateway. Change namespace to `valynt`. Add a second ingress rule allowing traffic from the `ingress-nginx` namespace (for ALB compatibility).
3. **`tenant-isolation-policy`** — change namespace to `valynt`.
4. **`service-mesh-isolation`** — change namespace to `valynt`.
5. **`allow-dns-resolution`** — change namespace to `valynt`.
6. **`allow-monitoring-traffic`** — change namespace to `valynt`.

Additionally, add new L3/L4 policies for the blue-green setup:
- Allow the active service to reach blue and green pods on their respective ports
- Allow ingress controller to reach the active services (backend port 8000, frontend port 80)

### R7: Istio Authorization Policies (L7)

The existing Istio policies in `infra/k8s/security/istio-service-mesh.yaml` and `mesh-authentication.yaml` already target `valueos`. Update namespace references to `valynt` in these files since they are directly related to the zero-trust security posture being applied.

### R8: Update Kustomization

Update `infra/k8s/base/kustomization.yaml` to reference:
- Blue/green deployment files for both services (replacing the single deployment files)
- Active + blue + green service files for both services
- PDB files for both services
- The consolidated `hpa.yaml`
- Remove references to the old single deployment and service files
- Remove `backend-hpa.yaml` reference (consolidated into `hpa.yaml`)

Update `infra/k8s/overlays/production/kustomization.yaml`:
- Change `bases:` to `resources:` (fix deprecated syntax)
- Update replica references to target blue deployments (`backend-blue`, `frontend-blue`)
- Add the security policies as additional resources

### R9: Production Overlay Patches

Update `infra/k8s/overlays/production/deployment-patch.yaml` to target the blue deployment names (`backend-blue`, `frontend-blue`) instead of `backend` and `frontend`.

## Files Changed (Summary)

### Modified
| File | Change |
|---|---|
| `infra/k8s/base/backend-deployment.yaml` | Resolve merge conflicts |
| `infra/k8s/base/backend-blue-deployment.yaml` | Fix duplicate `version` label, add `slot: blue` |
| `infra/k8s/base/backend-green-deployment.yaml` | Fix duplicate `version` label, add `slot: green` |
| `infra/k8s/base/backend-pdb.yaml` | Change `minAvailable` from 1 to 2 |
| `infra/k8s/base/hpa.yaml` | Update scaleTargetRef to `backend-blue` and `frontend-blue`, add HPA comment about blue-green switching |
| `infra/k8s/base/kustomization.yaml` | Add all new resources, remove old single-deployment references |
| `infra/k8s/security/zero-trust-network-policies.yaml` | Change all namespaces from `valueos` to `valynt`, add ALB ingress rule |
| `infra/k8s/security/istio-service-mesh.yaml` | Change namespaces from `valueos` to `valynt` |
| `infra/k8s/security/mesh-authentication.yaml` | Already targets `valynt` — no change needed |
| `infra/k8s/overlays/production/kustomization.yaml` | Fix `bases:` to `resources:`, update replica targets |
| `infra/k8s/overlays/production/deployment-patch.yaml` | Target blue deployment names |

### Created
| File | Purpose |
|---|---|
| `infra/k8s/base/backend-active-service.yaml` | Active backend service with `slot: blue` selector |
| `infra/k8s/base/backend-blue-service.yaml` | Direct access to blue backend pods |
| `infra/k8s/base/backend-green-service.yaml` | Direct access to green backend pods |
| `infra/k8s/base/frontend-blue-deployment.yaml` | Blue frontend deployment |
| `infra/k8s/base/frontend-green-deployment.yaml` | Green frontend deployment |
| `infra/k8s/base/frontend-active-service.yaml` | Active frontend service with `slot: blue` selector |
| `infra/k8s/base/frontend-blue-service.yaml` | Direct access to blue frontend pods |
| `infra/k8s/base/frontend-green-service.yaml` | Direct access to green frontend pods |
| `infra/k8s/base/frontend-pdb.yaml` | Frontend PDB with `minAvailable: 1` |

### Deleted
| File | Reason |
|---|---|
| `infra/k8s/base/backend-hpa.yaml` | Consolidated into `hpa.yaml` |
| `infra/k8s/base/backend-service.yaml` | Replaced by `backend-active-service.yaml` |
| `infra/k8s/base/frontend-deployment.yaml` | Replaced by blue/green deployments |
| `infra/k8s/base/frontend-service.yaml` | Replaced by `frontend-active-service.yaml` |

## Out of Scope

- Updating CI/CD workflows (`deploy-to-k8s.yml`, `canary-deployment.yml`) to use the new blue-green mechanism — those reference `valuecanvas-*` namespaces and are a separate concern
- Creating a blue-green switch script/automation — the manifests define the mechanism; orchestration is a follow-up
- Fixing merge conflicts or issues in files not touched by this work
- Terraform changes
- Staging overlay updates (only production overlay is in scope per the request)

## Acceptance Criteria

1. **No merge conflicts**: `backend-deployment.yaml` has no `<<<<<<<` / `=======` / `>>>>>>>` markers
2. **Blue-Green backend**: `backend-blue-deployment.yaml` and `backend-green-deployment.yaml` exist with correct labels (`slot: blue`/`slot: green`), no duplicate label keys, and green starts at 0 replicas
3. **Blue-Green frontend**: `frontend-blue-deployment.yaml` and `frontend-green-deployment.yaml` exist with correct labels, green starts at 0 replicas
4. **Service switch mechanism**: For each service (backend, frontend), three Service resources exist: `*-active` (selects active slot), `*-blue`, `*-green`. Active services default to `slot: blue`
5. **Backend PDB**: `minAvailable: 2`, selector matches `app: backend`
6. **Frontend PDB**: `minAvailable: 1`, selector matches `app: frontend`
7. **HPAs**: Single `hpa.yaml` with backend HPA (2-10 replicas, CPU 70%, memory 80%) and frontend HPA (2-5 replicas, CPU 70%), both targeting blue deployments
8. **Zero-trust policies**: All policies in `zero-trust-network-policies.yaml` target namespace `valynt`. Default-deny is present. ALB ingress rule is added alongside Istio gateway rule.
9. **Istio L7 policies**: `istio-service-mesh.yaml` targets namespace `valynt`
10. **Kustomization**: `base/kustomization.yaml` references all new files. `backend-hpa.yaml` is removed. Production overlay uses `resources:` not `bases:`.
11. **YAML validity**: All manifests pass `kubectl apply --dry-run=client` syntax (validated via `kustomize build` on the base directory)
12. **Ingress**: `ingress.yaml` backend references `backend-active` service, frontend references `frontend-active` service

## Implementation Approach

### Phase 1: Fix existing issues in touched files
1. Resolve merge conflicts in `backend-deployment.yaml`
2. Fix duplicate `version` labels in blue/green backend deployments

### Phase 2: Blue-Green deployment manifests
3. Update `backend-blue-deployment.yaml` with `slot: blue` label
4. Update `backend-green-deployment.yaml` with `slot: green` label
5. Create `frontend-blue-deployment.yaml` from existing `frontend-deployment.yaml` + `slot: blue`
6. Create `frontend-green-deployment.yaml` with `slot: green`, `replicas: 0`

### Phase 3: Service switch mechanism
7. Create `backend-active-service.yaml`, `backend-blue-service.yaml`, `backend-green-service.yaml`
8. Create `frontend-active-service.yaml`, `frontend-blue-service.yaml`, `frontend-green-service.yaml`
9. Update `ingress.yaml` to reference active services

### Phase 4: PDBs and HPAs
10. Update `backend-pdb.yaml` to `minAvailable: 2`
11. Create `frontend-pdb.yaml` with `minAvailable: 1`
12. Consolidate HPAs into `hpa.yaml`, targeting blue deployments
13. Delete `backend-hpa.yaml`

### Phase 5: Zero-Trust Network Security
14. Update `zero-trust-network-policies.yaml` namespaces to `valynt`, add ALB ingress rule
15. Update `istio-service-mesh.yaml` namespaces to `valynt`

### Phase 6: Kustomization and Overlay updates
16. Update `base/kustomization.yaml` with all new resources
17. Update production overlay (`kustomization.yaml` and `deployment-patch.yaml`)
18. Delete replaced files (`backend-service.yaml`, `frontend-service.yaml`, `frontend-deployment.yaml`, `backend-hpa.yaml`)

### Phase 7: Validation
19. Run `kustomize build infra/k8s/base/` to verify base builds
20. Run `kustomize build infra/k8s/overlays/production/` to verify production overlay builds
21. Verify no YAML syntax errors across all modified/created files

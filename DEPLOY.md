# Deploy to Shared Environments
<!-- active-runtime-platform: kubernetes -->

ValueOS shared-environment deployments are standardized on **Kubernetes**.

**Kubernetes is the only active deploy target for staging and production.** Docker Compose remains useful for local and prod-like validation, but it is not the active shared-environment deployment path.

## Active platform matrix

| Concern | Local development | Staging | Production |
| --- | --- | --- | --- |
| Runtime substrate | Docker Compose (`ops/compose/compose.yml`) | Kubernetes | Kubernetes |
| Runtime source of truth | `ops/compose/` | `infra/k8s/base/` + `infra/k8s/overlays/staging/` | `infra/k8s/base/` + `infra/k8s/overlays/production/` |
| Deployment workflow | developer-invoked local commands | `.github/workflows/deploy.yml` | `.github/workflows/deploy.yml` |
| Cluster auth secret | n/a | `KUBE_CONFIG_STAGING` | `KUBE_CONFIG_PRODUCTION` |
| Rollout mechanism | local compose restart | `kustomize build | kubectl apply -f -` | `kustomize build | kubectl apply -f -` |

## Platform boundary

Terraform and Kubernetes serve different layers of the deployment system:

- **Terraform-managed supporting infrastructure** ends at cloud resources and cluster prerequisites: networking, IAM, DNS, certificates, secret stores, observability backends, managed data services, and environment-level support infrastructure.
- **Kubernetes-managed runtime** begins at the cluster API: Deployments, Services, HPAs, CronJobs, ConfigMaps, network policies, pod placement, and rollout orchestration.

If a change modifies how the application runs inside the cluster, it belongs under `infra/k8s/`. If it provisions or changes the cloud services the cluster depends on, it belongs under Terraform.

## Archived ECS reference

Archived ECS Terraform modules are retained only under `infra/reference/terraform-archived-ecs/`.

- They are non-production reference material.
- No standard CI workflow may enable them.
- Reuse requires a dedicated break-glass pull request plus CI allowlist updates.

## Prerequisites

- Access to the target Kubernetes cluster
- `kubectl` and `kustomize`
- GitHub environment secrets:
  - `KUBE_CONFIG_STAGING`
  - `KUBE_CONFIG_PRODUCTION`
- Published backend and frontend images from `.github/workflows/deploy.yml`

## Standard deployment flow

1. Push or dispatch `.github/workflows/deploy.yml`.
2. Let the workflow build and sign backend/frontend images.
3. The workflow authenticates to the target cluster with the environment-specific kubeconfig secret.
4. The workflow updates image references in `infra/k8s/` and applies the manifests with `kustomize` + `kubectl`.
5. The workflow waits for rollout status and executes post-deploy validation.

## Manual verification

```bash
kubectl get deploy -n valynt
kubectl get pods -n valynt
kubectl get svc -n valynt
kubectl rollout status deployment/backend-green-production -n valynt --timeout=300s
```

For staging, use the staging namespace and deployment names defined in `infra/k8s/overlays/staging/`.

## Break-glass policy

Production exceptions to the normal deployment controls require a dedicated break-glass workflow with reviewer approval and audit evidence capture. The standard `deploy.yml` workflow does not permit production test bypass.

## Local and prod-like validation

Use Docker Compose only for workstation validation or isolated prod-like testing:

```bash
docker compose -f ops/compose/compose.yml up -d
```

That command does **not** deploy the shared staging or production runtime.

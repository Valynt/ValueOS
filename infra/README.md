# Infrastructure
<!-- active-runtime-platform: kubernetes -->
<!-- authoritative-infra-classification: true -->

This directory contains the deployment and operational infrastructure for ValueOS.

## Canonical deployment authority

`infra/README.md` is the **canonical infrastructure classification** for this repository.

When root docs, architecture summaries, or runbooks describe which deployment model is active, they must follow the status matrix in this file.

## Active deployment contract

**Kubernetes is the only active shared-environment runtime for staging and production.**

- **Active runtime manifests:** `infra/k8s/base/`, `infra/k8s/overlays/staging/`, `infra/k8s/overlays/production/`
- **Active deployment workflow:** `.github/workflows/deploy.yml`
- **Active supporting infrastructure:** `infra/terraform/` and `infra/environments/*/terraform/`
- **Active database migration chain:** top-level timestamped files in `infra/supabase/supabase/migrations/`
- **Local-only substrate:** `ops/compose/`

## Classification matrix

### `infra/k8s/`

| Scope | Classification | Why |
| --- | --- | --- |
| `base/`, `overlays/staging/`, `overlays/production/`, `cronjobs/`, `monitoring/`, `security/`, `observability/`, `zero-trust/` | Active | Canonical Kubernetes runtime manifests and cluster operations assets. |
| README guidance that points to `DEPLOY.md` and this file | Active | Documents the live deployment path. |
| Any future `archive/` or explicitly marked legacy subtree | Archived-reference | Allowed only for historical or break-glass material, never for normal deploys. |
| Deprecated manifests renamed or suffixed as deprecated/disabled | Deprecated | Retained only until removal is safe. |

### `infra/terraform/`

| Scope | Classification | Why |
| --- | --- | --- |
| `main.tf`, `variables.tf`, `modules/cache`, `modules/cdn`, `modules/database`, `modules/monitoring`, `modules/networking`, `modules/security` | Active | Supporting cloud infrastructure for the Kubernetes runtime. |
| `enable_ecs` gated module blocks in `main.tf` | Archived-reference | Kept only to point at archived ECS modules behind an explicit opt-in. |
| `infra/archive/terraform/ecs-reference/` | Archived-reference | Historical ECS/Fargate implementation for audit and break-glass review only. |
| Any Terraform root or workflow that treats ECS as an active runtime | Deprecated | Invalid under the current platform contract and blocked by CI. |

### `infra/supabase/supabase/migrations/`

| Scope | Classification | Why |
| --- | --- | --- |
| Top-level timestamped `*.sql` and `*.rollback.sql` files | Active | Canonical migration chain applied by CI and release tooling. |
| `archive/monolith-20260213/` | Archived-reference | Monolith-era schema history retained for auditability only. |
| `archive/deferred-superseded/` | Archived-reference | Deferred or superseded migrations preserved for reference and recovery analysis. |
| `archive/pre-initial-release-2026-03/` | Archived-reference | Pre-baseline migration chain preserved after deterministic baseline consolidation. |
| Any archived SQL restored to the top level without a reviewed migration plan | Deprecated | Reintroduces ambiguous schema history and is blocked by policy. |

## Platform boundary

Terraform manages the cloud primitives that Kubernetes depends on, including:

- networking, VPC/subnets, ingress prerequisites, and DNS
- IAM roles, certificates, secret backends, and external observability backends
- managed databases, caches, queues, storage, and other shared services
- environment-level support infrastructure and cluster prerequisites

Kubernetes manages the runtime boundary starting at the cluster API:

- Deployments, Services, HPAs, CronJobs, ConfigMaps, and policy objects
- rollout strategy, runtime scaling, health checks, and service discovery
- environment overlays that promote the same runtime into staging and production

**Rule of thumb:** Terraform prepares the platform. Kubernetes runs ValueOS on that platform.

## Archive boundary

Archived infrastructure now lives behind explicit archive roots:

- `infra/archive/terraform/ecs-reference/`
- `infra/supabase/supabase/migrations/archive/`

Archive material is retained for audit history, disaster-recovery analysis, or superseded migration review. It is **not** part of the active deployment or migration path.

## Entry points

- Shared-environment deployment flow: `DEPLOY.md`
- Kubernetes runtime details: `infra/k8s/README.md`
- Infrastructure architecture summary: `docs/architecture/infrastructure-architecture.md`

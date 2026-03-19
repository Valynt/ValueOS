# Infrastructure
<!-- active-runtime-platform: kubernetes -->

This directory contains the deployment and operational infrastructure for ValueOS.

## Runtime platform contract

**Kubernetes is the only active deploy target for shared staging and production environments.**

- **Active runtime manifests:** `infra/k8s/base/` plus `infra/k8s/overlays/staging/` and `infra/k8s/overlays/production/`
- **Active runtime deployment workflow:** `.github/workflows/deploy.yml`
- **Local development substrate:** `ops/compose/compose.yml` and optional Compose profiles for workstation-only dependencies
- **Supporting infrastructure substrate:** Terraform under `infra/terraform/`, `infra/terraform-new/`, and `infra/environments/*/terraform/`
- **Archived non-production references:** `infra/reference/terraform-archived-ecs/`

## Platform boundary: Terraform vs Kubernetes

Terraform manages the cloud primitives that Kubernetes depends on, including:

- network boundaries, VPC/subnets, and load-balancer prerequisites
- IAM roles, DNS, certificates, secret backends, and observability backends
- managed data services and other shared/stateful infrastructure
- cluster prerequisites and environment-level supporting infrastructure

Kubernetes manages the runtime boundary starting at the cluster API:

- application Deployments, Services, HPAs, CronJobs, ConfigMaps, and network policies
- rollout strategy, runtime scaling, pod-level health checks, and service-to-service policy
- environment overlays that promote the same runtime into staging and production

**Rule of thumb:** Terraform gets the platform ready for the cluster; Kubernetes runs the application inside the cluster.

## Canonical inventory

### Active runtime targets

| Target | Path | Purpose | Status |
| --- | --- | --- | --- |
| Base runtime manifests | `infra/k8s/base/` | Canonical shared runtime manifests for backend, frontend, workers, messaging, and policy objects. | Active |
| Staging overlay | `infra/k8s/overlays/staging/` | Staging-specific Kubernetes patches and configuration. | Active |
| Production overlay | `infra/k8s/overlays/production/` | Production-specific Kubernetes patches and configuration. | Active |
| Observability manifests | `infra/k8s/observability/` | Cluster-observable telemetry stack and related helpers. | Active |
| Security manifests | `infra/k8s/security/` and `infra/k8s/zero-trust/` | Runtime network policy, authorization, and zero-trust enforcement. | Active |
| Scheduled runtime jobs | `infra/k8s/cronjobs/` | Kubernetes-native scheduled operations. | Active |

### Supporting infrastructure targets

| Target | Path | Purpose | Status |
| --- | --- | --- | --- |
| Shared Terraform root | `infra/terraform/` | Canonical Terraform for shared cloud resources and support systems. | Active |
| Next Terraform root | `infra/terraform-new/` | Newer Terraform root under active development. | Active |
| Dev environment Terraform | `infra/environments/dev/terraform/` | Environment support infrastructure for development. | Active |
| Staging environment Terraform | `infra/environments/staging/terraform/` | Environment support infrastructure for staging. | Active |
| Production environment Terraform | `infra/environments/prod/terraform/` | Environment support infrastructure for production. | Active |

### Local-only Compose targets

| Target | Path | Purpose | Status |
| --- | --- | --- | --- |
| Base local stack | `ops/compose/compose.yml` | Local developer dependencies such as Postgres, Redis, and NATS. | Active |
| Optional local profiles | `ops/compose/profiles/*.yml` | Workstation-only profiles for Studio, observability, devcontainer, or local runtime experiments. | Active |
| Legacy compatibility shims | `infra/docker/*.yml` | Compatibility wrappers and prod-like container references; not the shared deploy path. | Limited |

## Archived ECS reference

Archived ECS modules live under `infra/reference/terraform-archived-ecs/`.

- They are retained for audit history and disaster-recovery design review.
- They are not part of the active deployment path.
- CI blocks active Terraform roots and workflow files from referencing the archive until a dedicated break-glass workflow is explicitly approved.

## Deploy and operations entry points

- Runtime deployment: see `DEPLOY.md`
- Kubernetes runtime guidance: see `infra/k8s/README.md`
- Architecture boundary: see `docs/architecture/infrastructure-architecture.md`

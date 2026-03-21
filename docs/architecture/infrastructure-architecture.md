---
title: Infrastructure Architecture
owner: team-platform
system: valueos-platform
---

# Infrastructure Architecture
<!-- active-runtime-platform: kubernetes -->

**Last Updated:** 2026-03-19

## Executive summary

ValueOS now has a single active shared-environment runtime target: **Kubernetes**.

**Kubernetes is the only active deploy target for staging and production.** Terraform remains active for supporting infrastructure, but it is not the runtime scheduler. Docker Compose remains active for local development and isolated validation only.

## Active platform contract

| Layer | Active platform | Source of truth | Purpose |
| --- | --- | --- | --- |
| Shared-environment runtime | Kubernetes | `infra/k8s/base/` + overlays + `.github/workflows/deploy.yml` | Runs backend, frontend, workers, messaging, scheduled jobs, and runtime policy objects |
| Supporting infrastructure | Terraform | `infra/terraform/`, `infra/terraform-new/`, `infra/environments/*/terraform/` | Provisions cloud resources and environment prerequisites the cluster depends on |
| Local developer substrate | Docker Compose | `ops/compose/` | Runs local dependencies and optional workstation-only runtime experiments |
| Archived historical runtime reference | Archived Terraform ECS modules | `infra/archive/terraform/ecs-reference/` | Retained for audit history and break-glass planning only |

## Infrastructure boundary

### Terraform-managed supporting infrastructure ends at

- cloud account and environment scaffolding
- VPCs, subnets, ingress prerequisites, load balancer prerequisites, and DNS
- IAM roles/policies, certificates, secret backends, and external observability backends
- managed databases, caches, queues, storage, and cluster prerequisites
- any infrastructure the application consumes but does not schedule itself

### Kubernetes-managed runtime begins at

- namespaces, Deployments, StatefulSets, Services, HPAs, CronJobs, ConfigMaps, Secrets references, and PodDisruptionBudgets
- blue/green or staged rollout orchestration for backend and frontend workloads
- runtime policy such as network policies, service-to-service authorization, and pod-level scheduling constraints
- application image promotion into staging and production namespaces
- runtime health probes, autoscaling behavior, and in-cluster service discovery

### Decision rule

When deciding where a change belongs:

- if the change creates or configures external cloud infrastructure, place it in Terraform
- if the change modifies how ValueOS workloads run inside the cluster, place it in Kubernetes manifests
- if the change is only for local developer convenience, place it in `ops/compose/`

## Deployment workflows

### Active deployment workflow

`.github/workflows/deploy.yml` is the canonical shared-environment deployment workflow.

It builds backend and frontend images, signs them, authenticates to the target cluster, and applies Kubernetes manifests with `kustomize` and `kubectl`.

### Supporting infrastructure workflow

`.github/workflows/terraform.yml` validates Terraform roots and parity checks for the infrastructure that supports the Kubernetes runtime.

This workflow does not define an alternate runtime platform.

### Disaster-recovery validation workflow

`.github/workflows/dr-validation.yml` validates disaster-recovery procedures around the same Kubernetes-first operating model.

DR validation may exercise environment failover checks and supporting infrastructure, but it does not reintroduce archived ECS material into the shared-environment runtime.

## Archived ECS modules

Archived ECS Terraform modules were moved out of active Terraform module paths into `infra/archive/terraform/ecs-reference/` to make their non-production status explicit.

Guardrails:

- active Terraform roots must not source the archived ECS modules
- standard GitHub Actions workflows must not reference the archive
- CI enforces both rules through `scripts/ci/check-archived-ecs-guardrails.mjs`

At the moment, there are **no approved ECS break-glass workflows** in the repository. Re-enabling the archive requires an explicit reviewed change that adds the workflow and updates the CI allowlist.

## Operational implications

- incident response should assume Kubernetes objects are the live runtime surface
- deployment docs, runbooks, and CI must describe Kubernetes as the runtime target consistently
- Terraform reviews should focus on platform prerequisites and shared infrastructure, not workload scheduling semantics
- archived ECS material may inform retrospectives or recovery planning, but it is not deployable without a deliberate repo change

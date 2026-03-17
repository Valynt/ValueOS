# Archived Terraform Modules

These modules are **not used by the active deploy pipeline**. Active deployments
use Kubernetes (kustomize + kubectl) via `.github/workflows/deploy.yml` and
`infra/k8s/`.

## Archived Modules

| Module         | Original Purpose                            | Archived Date |
| -------------- | ------------------------------------------- | ------------- |
| `ecs/`         | ECS Fargate cluster with Container Insights | 2026-03-17    |
| `ecs-service/` | ECS Fargate task definition, service, ALB   | 2026-03-17    |

## Why Retained

These modules are kept for reference in case ECS is needed for future workloads
or as a migration target. They were archived per audit recommendation #3
(comprehensive repo audit, March 2026) to reduce IaC confusion.

## To Restore

Move the module directory back to `infra/terraform/modules/` and update
`infra/terraform/main.tf` to reference it.

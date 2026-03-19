# Archived ECS Terraform Modules

These Terraform modules are retained only as **historical reference and break-glass disaster-recovery design input**. They are **not** part of the active ValueOS deployment path.

- **Active runtime platform:** Kubernetes via `infra/k8s/` and `.github/workflows/deploy.yml`
- **Supporting infrastructure platform:** Terraform for shared cloud resources, cluster prerequisites, networking, IAM, observability backends, and stateful dependencies
- **Archive status:** non-production reference only; CI blocks workflow or Terraform re-enablement from this path

## Archived modules

| Module | Original purpose | Archived date |
| --- | --- | --- |
| `ecs/` | ECS Fargate cluster with Container Insights | 2026-03-17 |
| `ecs-service/` | ECS Fargate task definition, service, and ALB wiring | 2026-03-17 |

## Why retained

These modules are preserved so responders and platform engineers can inspect the prior ECS shape during audits, incident retrospectives, or disaster-recovery planning. They are not approved for normal staging or production deployment.

## Guardrails

- No approved GitHub Actions break-glass workflow currently restores or applies this archive.
- `scripts/ci/check-archived-ecs-guardrails.mjs` fails CI if any active Terraform root or workflow references this archive.
- Re-enablement requires an explicit pull request that adds an approved break-glass workflow and updates the CI allowlist in the guardrail script.

## Restoration process

If ECS must be revived for a time-boxed emergency:

1. Propose the recovery change in a pull request.
2. Add or update a dedicated break-glass workflow with reviewer protection and audit capture.
3. Update the CI allowlist in `scripts/ci/check-archived-ecs-guardrails.mjs`.
4. Move or copy the needed modules into an active Terraform root only as part of that reviewed change.

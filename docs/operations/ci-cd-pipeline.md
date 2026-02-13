# CI/CD Pipeline

## Overview
The GitHub Actions CI workflow now includes Terraform guardrails in addition to application quality checks. The Terraform job enforces formatting, validation, and a per-environment plan for `staging` and `production` to catch IaC regressions before merge.

## Terraform CI Stages
1. `terraform fmt -check -recursive infra/terraform` ensures all Terraform code is consistently formatted.
2. `terraform init -backend=false` initializes providers/modules without touching remote state in CI.
3. `terraform validate` checks syntax and module wiring.
4. `terraform plan` runs per environment using matrix values (`staging`, `production`) with CI-safe placeholder inputs.

## State Management
- **Backend**: Remote S3 backend with DynamoDB locking is configured in the root Terraform stack (`infra/terraform/main.tf`).
- **Locking**: DynamoDB lock table prevents concurrent state mutation.
- **Encryption**: State at rest is encrypted in S3 (`encrypt = true`).
- **Isolation**: Use environment-specific state keys (for example `production/terraform.tfstate`) so each environment has independent state lineage.

## Drift Detection
- Run scheduled `terraform plan` in CI against each environment to detect drift caused by manual console changes.
- Treat non-empty plans outside approved deployment windows as incidents and reconcile with code-first changes.
- Store plan output artifacts for auditability and handoff.

## Promotion Workflow
1. **Develop/PR**: CI validates code + Terraform and generates plans for `staging` and `production`.
2. **Staging Apply**: After approval, apply staging from the reviewed commit SHA.
3. **Verification**: Execute smoke tests, alarm checks, and rollout metrics in staging.
4. **Production Promotion**: Promote the same immutable commit SHA to production.
5. **Post-Deploy Drift Check**: Re-run production `terraform plan` to confirm zero unexpected changes.

## Operational Controls
- Require pull request approvals for workflow and Terraform changes.
- Restrict `terraform apply` to protected branches/environments.
- Keep Terraform credentials short-lived and injected via GitHub environment secrets.

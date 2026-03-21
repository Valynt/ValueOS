# CI Control Matrix

This file maps core delivery and compliance controls to the GitHub Actions workflows that implement them.

| Control Family | Control | Workflow(s) | Evidence |
| --- | --- | --- | --- |
| Security | Secret rotation metadata age verification (AWS Secrets Manager and Vault) | `secret-rotation-verification.yml`, `deploy-production.yml` (`secret-rotation-gate` job) | `secret-rotation-evidence-<environment>-<run_id>` artifact (`*.json`, `*.txt`) |
| Release Safety | Staging build/sign/deploy, DAST, staging smoke tests, SLO guard, and production promotion | `deploy-staging.yml`, `deploy-production.yml` | Promotion manifest + deployment verification artifacts |
| Reliability | Weekly SLO and incident report generation | `reliability-weekly.yml` | `weekly-reliability-report-<run_id>` artifact |

## Workflow Ownership

| Workflow | Status | Owner | Notes |
| --- | --- | --- | --- |
| `deploy-staging.yml` | Active | team-platform | Automatic staging build, verification, and promotion-manifest publication. |
| `deploy-production.yml` | Active | team-platform | Explicit production promotion using immutable image digests and protected environment approvals. |
| `reliability-weekly.yml` | Active | team-platform | Scheduled reliability reporting separated from deploy logic. |

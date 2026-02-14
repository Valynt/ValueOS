# CI Control Matrix

This is the single control matrix for workflows under `.github/workflows/`.

| Control Domain | Control | Enforced In Workflow | Evidence Artifact |
| --- | --- | --- | --- |
| Code Quality | Lint + typecheck + unit/integration tests | `ci.yml` | Coverage + test artifacts |
| Accessibility | WCAG 2.2 AA audit + trend gate | `ci.yml` (`accessibility-audit` job) | `accessibility-trend` artifact |
| Security | SAST/CodeQL/IaC scans + image signature verification | `ci.yml` | Security job artifacts + gate status |
| Compliance | RLS and DSR checks + evidence export | `ci.yml`, `compliance-evidence-export.yml` | Compliance artifacts + export bundle |
| Infrastructure | Terraform fmt/validate/plan | `terraform.yml` | Terraform plan summary |
| Release Safety | Build/deploy, staging smoke tests, SLO guard, prod smoke | `deploy.yml` | SBOM/attestation + deployment summary |
| Reliability Ops | On-call drill MTTR trend publication | `oncall-drill-scorecard.yml` | `docs/operations/on-call-drill-scorecard.md` |

## Workflow Lifecycle

| Workflow | Status | Owner | Notes |
| --- | --- | --- | --- |
| `ci.yml` | Active | team-quality | Consolidated quality + accessibility gates. |
| `deploy.yml` | Active | team-platform | Promotion and production safety controls. |
| `terraform.yml` | Active | team-platform | Terraform validation and drift checks. |
| `compliance-evidence-export.yml` | Active | team-security | Scheduled compliance evidence export. |
| `oncall-drill-scorecard.yml` | Active | team-sre | Scheduled MTTR trend publication. |
| `accessibility.deprecated.yml.disabled` | Deprecated | team-quality | Folded into `ci.yml` to remove duplicate setup and execution paths. |

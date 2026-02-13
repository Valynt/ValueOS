# CI / Workflow Control Matrix

This directory now uses **one primary CI workflow**:

- **Primary pipeline:** `ci.yml`
- **Deployment pipeline:** `deploy.yml`
- **Automated operations telemetry:** `oncall-drill-trends.yml`

## Unified CI Control Matrix

| Control Domain | Control Objective | Execution Job (ci.yml) | Trigger Scope |
|---|---|---|---|
| Build + Test | Verify app build health and test readiness | `ci` | push/PR/release/workflow_dispatch |
| Data + Compliance | Validate RLS and DSR behavior | `rls-and-compliance` | push/PR (same-repo PRs) |
| Static Security (SAST) | Detect vulnerable code patterns | `sast`, `codeql` | push/PR/release |
| Dependency + License Security | Detect CVEs/license risks in dependencies | `sca-license` | push/PR/release |
| IaC Security | Detect infra policy/security risks | `iac` | push/PR/release |
| Accessibility | Enforce WCAG 2.2 AA regression checks | `accessibility-audit` | push/PR/release |
| Terraform Hygiene | Validate Terraform formatting/plan safety | `terraform-controls` | push/PR/release |
| Supply Chain | Generate and verify SBOM/signature evidence | `sbom`, `image-signature-verify` | push/tag/release |
| Security Gate | Block merge/release on failed controls | `security-gate` | push/PR/release |

## Deprecated Workflows

The following wrappers are intentionally left in-place to reduce operator confusion and provide explicit redirect notices:

| Deprecated workflow | Status | Replacement |
|---|---|---|
| `accessibility.yml` | Deprecated (manual notice only) | `ci.yml` → `accessibility-audit` |
| `terraform.yml` | Deprecated (manual notice only) | `ci.yml` → `terraform-controls` |

Archived legacy workflows remain under `.github/workflows/.archive/`.

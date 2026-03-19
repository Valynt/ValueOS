# GitHub Actions Workflow Guide

Use [`CI_CONTROL_MATRIX.md`](./CI_CONTROL_MATRIX.md) as the canonical owner map for required enterprise controls. This README explains workflow intent, whether a workflow is authoritative or auxiliary, and which artifacts it produces.

## Governance Rules

- **Authoritative workflows** own blocking enterprise controls and are the only workflows allowed to be the primary owner for a control in the matrix.
- **Auxiliary workflows** may provide debugging, evidence export, or defense-in-depth signals, but they are not a second source of truth.
- When a workflow changes trigger scope or ownership, update this README, the control matrix, and the CI self-check together.

## Workflow Catalog

| Workflow | Status | Trigger intent | Authoritative use | Artifacts / outputs |
| --- | --- | --- | --- | --- |
| `ci.yml` | Authoritative | Pull requests, pushes to `main`/`develop`, scheduled nightly verification, release hooks, and manual dispatch | Primary owner for lint, typecheck, unit, integration, RLS runtime validation, accessibility, and i18n controls | Coverage, `lane-*` summaries, `accessibility-audit-*`, `security-gate-*`, `reports/compliance/**` |
| `codeql.yml` | Authoritative | Pull requests and pushes to `main` | Primary owner for the SAST gate | GitHub code-scanning results |
| `deploy.yml` | Authoritative | Push to `main`, scheduled drift/proof checks, and manual environment promotion | Primary owner for DAST and deployment readiness gates | DAST ZAP reports, deployment summaries, bypass audits, release validation artifacts |
| `release.yml` | Authoritative | Push to `main` and manual release dispatch | Primary owner for release-time SBOM/provenance output | `release-artifacts/sbom.*`, cosign signatures/certs, GitHub Release assets |
| `terraform.yml` | Authoritative | PRs and pushes that touch `infra/terraform/**` | Primary owner for Terraform validation and planning | Terraform fmt/validate/plan logs |
| `test.yml` | Auxiliary | Manual dispatch only | Targeted Vitest runner for ad hoc debugging, migration support, or selective reruns; not authoritative for merge protection | Optional `coverage-*` artifact when coverage is requested |
| `dependency-outdated.yml` | Auxiliary | PRs, weekly schedule, and manual dispatch | Dependency-age triage and reporting | `dependency-outdated-*` artifact and optional PR comment |
| `compliance-evidence-export.yml` | Auxiliary | Quarterly schedule and manual dispatch | Exports evidence bundles assembled from existing control outputs | `compliance-evidence-bundle-*` artifact |
| `access-review-automation.yml` | Auxiliary | Monthly schedule and manual dispatch | Periodic access-review evidence generation | `access-review-evidence-*` artifact |
| `oncall-drill-scorecard.yml` | Auxiliary | Weekly schedule and manual dispatch | Publishes on-call drill trend summaries | Repo-updated drill scorecard and metrics JSON |
| `dr-validation.yml` | Auxiliary | DR-specific validation triggers | Disaster-recovery validation support | DR validation logs/artifacts defined in workflow |
| `migration-chain-integrity.yml` | Auxiliary | Migration-specific verification triggers | Deep migration-chain validation beyond the core CI lane | Migration integrity logs/artifacts defined in workflow |
| `accessibility.deprecated.yml.disabled` | Retired | Disabled | Historical record only | None |

## Authoritative Control Ownership

See the matrix for the exact owner mapping. In summary:

- `ci.yml` owns the day-to-day application quality controls.
- `codeql.yml` owns SAST.
- `deploy.yml` owns DAST.
- `release.yml` owns SBOM provenance.
- `terraform.yml` owns Terraform validation.

## Migration Notes

- `test.yml` used to overlap with `ci.yml` for PR/push test execution. It is now manual-only so the authoritative owner remains clear.
- `v1-core-services-test.yml` was retired on 2026-03-19 after the consolidation migration window closed because its backend-only test coverage duplicated `ci.yml`.
- Retired workflows should be removed or kept disabled with a clear historical reason; they must not regain blocking status without re-entering the matrix and self-check.

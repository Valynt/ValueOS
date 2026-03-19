# CI Control Matrix

This document is the single authoritative matrix for required enterprise delivery controls under `.github/workflows/`.

## Primary Control Owners

Each required control has exactly one **primary owner** workflow/job. Any additional workflows that touch the same area are auxiliary only and must not become a second source of truth.

| Control | Primary owner workflow | Primary owner job | Trigger intent | Evidence / outputs | Auxiliary workflows |
| --- | --- | --- | --- | --- | --- |
| Lint | `ci.yml` | `unit-component-schema` | PRs and branch pushes that need blocking code-quality feedback | Turbo lint logs plus `lane-unit-component-schema-*` artifacts | `test.yml` (manual targeted debugging only) |
| Typecheck | `ci.yml` | `unit-component-schema` | PRs and branch pushes that need blocking type-safety feedback | Turbo typecheck logs plus `lane-unit-component-schema-*` artifacts | None |
| Unit | `ci.yml` | `unit-component-schema` | PRs and branch pushes that need blocking unit/regression coverage | Vitest coverage output plus `lane-unit-component-schema-*` artifacts | `test.yml` (manual targeted debugging only) |
| Integration | `ci.yml` | `unit-component-schema` | PRs and branch pushes that need blocking integration-style Vitest coverage | Vitest coverage output plus `lane-unit-component-schema-*` artifacts | `test.yml` (manual targeted debugging only) |
| RLS | `ci.yml` | `tenant-isolation-gate` | Trusted-context pushes, dispatches, releases, and same-repo PRs that can use secrets for tenant-boundary validation | `reports/compliance/**` plus `lane-tenant-isolation-gate-*` artifacts | `ci.yml` / `tenant-isolation-static-gate` (fork-safe fallback signal) |
| DAST | `deploy.yml` | `dast-gate` | Pre-deploy and promotion events that validate the staged runtime surface | `deploy-dast-gate-*` ZAP artifacts and DAST summary | None |
| SAST | `codeql.yml` | `codeql-analyze` | PRs and `main` pushes that require a dedicated static-analysis owner | GitHub code-scanning alerts from CodeQL | `ci.yml` / `security-gate` (Semgrep defense in depth) |
| SBOM | `release.yml` | `release` | Release-time provenance generation for shipped artifacts | `release-artifacts/sbom.*` plus cosign signatures and certificates | `ci.yml` / `security-gate` (pre-merge CycloneDX preview) |
| Accessibility | `ci.yml` | `accessibility-audit` | PRs and branch pushes that need blocking UX/accessibility validation | `accessibility-audit-*`, Playwright reports, WCAG trend metrics | None |
| i18n | `ci.yml` | `accessibility-audit` | PRs and branch pushes that need localization coverage and pseudo-loc validation | `artifacts/i18n/**` inside `accessibility-audit-*` artifacts | None |
| Terraform | `terraform.yml` | `terraform-checks` | Terraform-only PRs and pushes that need infra policy, validation, and dry-run planning | Terraform fmt/validate/plan logs | None |

## Workflow Lifecycle

| Workflow | Status | Intent | Notes |
| --- | --- | --- | --- |
| `ci.yml` | Authoritative | Main pre-merge and branch CI owner for code quality, runtime checks, accessibility, i18n, and tenant isolation | Blocking source of truth for core application controls. |
| `codeql.yml` | Authoritative | Dedicated SAST owner | Single primary owner for the SAST gate. |
| `deploy.yml` | Authoritative | Deployment orchestration and runtime security gates | Owns DAST before promotion. |
| `release.yml` | Authoritative | Release automation and provenance generation | Owns release SBOM generation/signing. |
| `terraform.yml` | Authoritative | Terraform validation and policy checks | Owns Terraform gate. |
| `test.yml` | Auxiliary | Manual, targeted Vitest execution during investigations or migration support | Removed from PR/push triggers so it cannot compete with `ci.yml`. |
| `dependency-outdated.yml` | Auxiliary | Dependency freshness reporting | Informational triage, not a primary enterprise gate owner. |
| `compliance-evidence-export.yml` | Auxiliary | Scheduled compliance evidence packaging | Exports evidence produced by authoritative jobs. |
| `access-review-automation.yml` | Auxiliary | Scheduled access review evidence | Operational evidence generation only. |
| `oncall-drill-scorecard.yml` | Auxiliary | Scheduled on-call trend publication | Reliability reporting only. |
| `dr-validation.yml` | Auxiliary | Disaster-recovery validation support | Not a primary owner for the required matrix controls. |
| `migration-chain-integrity.yml` | Auxiliary | Schema-chain integrity verification | Specialist migration control, outside the required matrix set. |
| `v1-core-services-test.yml` | Retired | Legacy backend-only duplicate test workflow | Removed on 2026-03-19 after the consolidation migration window closed. |
| `accessibility.deprecated.yml.disabled` | Retired | Historical accessibility lane | Left disabled as historical record only. |

## Migration Policy

- Duplicate PR/push test execution belongs in `ci.yml`; auxiliary workflows may offer manual or scheduled support only.
- New enterprise gates must be added to the primary-owner table above and wired into the CI self-check in the same change.
- Retire stale auxiliary workflows once the replacement owner has been stable for one migration window; record the retirement here.

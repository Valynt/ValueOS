# CI Control Matrix

This is the single control matrix for workflows under `.github/workflows/`.

## Target Branch-Protection Contract

`main` pull requests should expose only these durable branch-protection targets:

- `pr-fast`
- `infra-plan` *(required only when Terraform-owned paths change and `terraform.yml` runs)*

`codeql` remains available as a dedicated security signal, but it is advisory unless leadership explicitly chooses to make it blocking in repository settings.

These targets intentionally hide low-level CI lane names such as `unit/component/schema`, `tenant-isolation-gate`, or other implementation details. The aggregate checks above are the public contract for PR merge governance.

## Post-Merge / Release Governance Checks

These checks govern `main` verification and release promotion after merge rather than PR branch protection:

- `main-verify`
- `release-readiness`
- `deploy-staging`
- `deploy-production`

## Control Map

| Control Domain | Control | Enforced In Workflow | Evidence Artifact |
| --- | --- | --- | --- |
| Code Quality | Lint + typecheck + unit/integration tests | `ci.yml` (`unit/component/schema`, `pr-fast`, and `main-verify` jobs) | Coverage + test artifacts |
| Accessibility | WCAG 2.2 AA audit + trend gate + WCAG severity budgets (critical/serious=0) | `ci.yml` (`accessibility-audit` job) | `accessibility-trend` artifact (`a11y-metrics`, `wcag-severity-metrics`) |
| Localization | Key integrity + locale completeness coverage + pseudo-localization checks | `ci.yml` (`unit/component/schema` + `main-verify`) | `i18n-coverage-dashboard`, `i18n-release-coverage-dashboard`, pseudo-loc report |
| UX Performance | Bundle + route-level load budgets enforced in CI | `ci.yml` (`accessibility-audit` job) | `ux-performance-metrics`, `route-load-metrics` |
| Security | CodeQL (JavaScript/TypeScript) advisory by default; leadership may opt in to blocking | `codeql.yml` (`codeql` job) | GitHub Code Scanning alerts (CodeQL SARIF) |
| Security | Gitleaks secret scanning | `ci.yml` (`security-gate` job) | GitHub Action run logs + `security-gate-*` artifact |
| Security | Semgrep SAST scanning | `ci.yml` (`security-gate` job) | `semgrep.sarif`, uploaded to code scanning |
| Security | Trivy filesystem + container image scanning (HIGH/CRITICAL fail threshold) | `ci.yml` (`security-gate` job) | `trivy-fs.sarif`, `trivy-image.sarif`, uploaded to code scanning |
| Security | Secret rotation metadata age verification (AWS Secrets Manager and Vault) | `secret-rotation-verification.yml`, `deploy.yml` (`secret-rotation-gate` job) | `secret-rotation-evidence-<environment>-<run_id>` artifact (`*.json`, `*.txt`) |
| Compliance | RLS and DSR checks + evidence export | `ci.yml`, `compliance-evidence-export.yml` | Compliance artifacts + export bundle |
| Infrastructure | Terraform fmt/validate/plan | `terraform.yml` (`infra-plan` job) | Terraform plan summary |
| Release Safety | Build/deploy, staging smoke tests, SLO guard, prod smoke | `deploy.yml` (`release-readiness`, `deploy-staging`, `deploy-production`) | SBOM/attestation + deployment summary |
| Release Integrity | Backend/frontend reproducibility rebuild from the same commit, container digest parity, packaged artifact SHA-256 parity, allowlisted diff report when needed | `release.yml` (`reproducibility-build` + `reproducibility-compare` jobs) | `release-reproducibility-<run_id>` artifact (`reproducibility-report.md`, `reproducibility-comparison.json`, `reproducibility-allowlisted-diff.json`) |
| Reliability Ops | On-call drill MTTR trend publication | `oncall-drill-scorecard.yml` | `docs/operations/on-call-drill-scorecard.md` |

## Workflow Lifecycle

| Workflow | Status | Owner | Notes |
| --- | --- | --- | --- |
| `ci.yml` | Active | team-quality | Consolidated quality lanes plus durable `pr-fast` and `main-verify` governance targets. |
| `codeql.yml` | Active | team-security | Dedicated CodeQL analysis on pull requests and `main` pushes; advisory unless leadership configures it as blocking. |
| `deploy.yml` | Active | team-platform | Promotion and production safety controls exposed through `release-readiness`, `deploy-staging`, and `deploy-production`. |
| `terraform.yml` | Active | team-platform | Terraform validation and drift checks exposed as `infra-plan` when Terraform paths change. |
| `compliance-evidence-export.yml` | Active | team-security | Scheduled compliance evidence export. |
| `secret-rotation-verification.yml` | Active | team-security | Daily secret metadata age verification for AWS Secrets Manager and Vault, and reusable production-promotion gate evidence. |
| `oncall-drill-scorecard.yml` | Active | team-sre | Scheduled MTTR trend publication. |
| `accessibility.deprecated.yml.disabled` | Deprecated | team-quality | Folded into `ci.yml` to remove duplicate setup and execution paths. |

## Scanner Version Upgrade Workflow

To prevent drift between workflow scanner refs and CI verification scripts, scanner versions are centralized in `scripts/ci/security-tool-versions.json`.

When bumping scanner action versions:

1. Update version refs in `scripts/ci/security-tool-versions.json`.
2. Update `.github/workflows/ci.yml` and/or `.github/workflows/codeql.yml` to use the same refs.
3. Run these guards locally:
   - `node scripts/ci/security-baseline-verification.mjs`
   - `node scripts/ci/check-ci-security-control-matrix.mjs`
   - `node scripts/ci/check-ci-workflow-scanner-refs.mjs`
   - `node scripts/ci/check-required-check-workflow-consistency.mjs`
4. Include all related updates in the same PR. Scanner version bumps without paired manifest/workflow consistency updates must be treated as policy violations.

# CI Control Matrix

This is the single control matrix for workflows under `.github/workflows/`.

| Control Domain | Control | Enforced In Workflow | Evidence Artifact |
| --- | --- | --- | --- |
| Code Quality | Lint + typecheck + unit/integration tests | `pr-fast.yml` and `main-verify.yml` (`unit/component/schema`) | Coverage + backend debt artifacts |
| Accessibility | WCAG 2.2 AA audit + trend gate + WCAG severity budgets (critical/serious=0) | `pr-fast.yml` / `main-verify.yml` (`accessibility-audit`), `nightly-governance.yml` (`nightly/accessibility-trends`) | Accessibility and frontend-quality artifacts |
| Localization | Key integrity + locale completeness coverage + pseudo-localization checks | `pr-fast.yml` and `main-verify.yml` (`accessibility-audit`) | `artifacts/i18n/*` |
| UX Performance | Bundle + route-level load budgets enforced in CI | `pr-fast.yml` and `main-verify.yml` (`accessibility-audit`) | `artifacts/frontend-quality/*` |
| Security | CodeQL (JavaScript/TypeScript) | `codeql.yml` (`codeql-analyze (js-ts)`) | GitHub Code Scanning alerts (CodeQL SARIF) |
| Security | Gitleaks secret scanning | `pr-fast.yml`, `main-verify.yml`, `nightly-governance.yml` | Action logs + uploaded security artifacts |
| Security | Semgrep SAST scanning | `pr-fast.yml`, `main-verify.yml`, `nightly-governance.yml` | `semgrep.sarif`, uploaded to code scanning where applicable |
| Security | Trivy filesystem + container image scanning (HIGH/CRITICAL fail threshold) | `pr-fast.yml`, `main-verify.yml`, `nightly-governance.yml` | `trivy-fs.sarif`, `trivy-image.sarif` |
| Security | Secret rotation metadata age verification (AWS Secrets Manager and Vault) | `secret-rotation-verification.yml`, `deploy.yml` (`secret-rotation-gate` job) | `secret-rotation-evidence-<environment>-<run_id>` artifact |
| Compliance | RLS and DSR checks + evidence export | `pr-fast.yml`, `main-verify.yml`, `compliance-evidence-export.yml` | Compliance artifacts + export bundle |
| Infrastructure | Terraform fmt/validate/plan | `terraform.yml` | Terraform plan summary |
| Release Safety | Main-branch release aggregation, staging health verification, deploy-time gates | `main-verify.yml` (`staging-deploy-release-gates`), `deploy.yml` | CI lane artifacts + deployment summary |
| Release Integrity | Backend/frontend reproducibility rebuild from the same commit, container digest parity, packaged artifact SHA-256 parity, allowlisted diff report when needed | `release.yml` (`reproducibility-build` + `reproducibility-compare` jobs) | `release-reproducibility-<run_id>` artifact |
| Reliability Ops | On-call drill MTTR trend publication | `oncall-drill-scorecard.yml` | `docs/operations/on-call-drill-scorecard.md` |

## Workflow Lifecycle

| Workflow | Status | Owner | Notes |
| --- | --- | --- | --- |
| `pr-fast.yml` | Active | team-quality | Pull-request-only merge blockers with fork-safe aggregation. |
| `main-verify.yml` | Active | team-quality | Trusted post-merge verification and release-oriented aggregation on `main`. |
| `nightly-governance.yml` | Active | team-quality | Scheduled advisory scans, trend checks, and heavy diagnostics. |
| `codeql.yml` | Active | team-security | Dedicated CodeQL analysis on pull requests and main pushes. |
| `deploy.yml` | Active | team-platform | Promotion and production safety controls. |
| `terraform.yml` | Active | team-platform | Terraform validation and drift checks. |
| `compliance-evidence-export.yml` | Active | team-security | Scheduled compliance evidence export. |
| `secret-rotation-verification.yml` | Active | team-security | Daily secret metadata age verification for AWS Secrets Manager and Vault. |
| `oncall-drill-scorecard.yml` | Active | team-sre | Scheduled MTTR trend publication. |
| `accessibility.deprecated.yml.disabled` | Deprecated | team-quality | Accessibility checks were folded into the active CI entry points. |

## Branch Protection Required Checks

`main` branch protection must require the following checks:

- `pr-fast`
- `staging-deploy-release-gates`
- `codeql-analyze (js-ts)`

## Scanner Version Upgrade Workflow

To prevent drift between workflow scanner refs and CI verification scripts, scanner versions are centralized in `scripts/ci/security-tool-versions.json`.

When bumping scanner action versions:

1. Update version refs in `scripts/ci/security-tool-versions.json`.
2. Update `.github/workflows/pr-fast.yml`, `.github/workflows/main-verify.yml`, `.github/workflows/nightly-governance.yml`, and/or `.github/workflows/codeql.yml` to use the same refs.
3. Run these guards locally:
   - `node scripts/ci/security-baseline-verification.mjs`
   - `node scripts/ci/check-ci-security-control-matrix.mjs`
   - `node scripts/ci/check-ci-workflow-scanner-refs.mjs`
   - `node scripts/ci/check-required-check-workflow-consistency.mjs`
4. Include all related updates in the same PR. Scanner version bumps without paired manifest/workflow consistency updates must be treated as policy violations.

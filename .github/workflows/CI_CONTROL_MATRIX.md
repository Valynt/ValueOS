# CI Control Matrix

This is the single control matrix for workflows under `.github/workflows/`.

| Control Domain | Control | Enforced In Workflow | Evidence Artifact |
| --- | --- | --- | --- |
| Code Quality | Lint + typecheck + unit/integration tests | `ci.yml` | Coverage + test artifacts |
| Accessibility | WCAG 2.2 AA audit + trend gate + WCAG severity budgets (critical/serious=0) | `ci.yml` (`accessibility-audit` job) | `accessibility-trend` artifact (`a11y-metrics`, `wcag-severity-metrics`) |
| Localization | Key integrity + locale completeness coverage + pseudo-localization checks | `ci.yml` (`accessibility-audit` job) | `i18n-coverage-dashboard`, `i18n-release-coverage-dashboard`, pseudo-loc report |
| UX Performance | Bundle + route-level load budgets enforced in CI | `ci.yml` (`accessibility-audit` job) | `ux-performance-metrics`, `route-load-metrics` |
| Security | CodeQL (JavaScript/TypeScript) | `codeql.yml` (`codeql-analyze (js-ts)` job) | GitHub Code Scanning alerts (CodeQL SARIF) |
| Security | Gitleaks secret scanning | `ci.yml` (`security-gate` job) | GitHub Action run logs + `security-gate-*` artifact |
| Security | Semgrep SAST scanning | `ci.yml` (`security-gate` job) | `semgrep.sarif`, uploaded to code scanning |
| Security | Trivy filesystem + container image scanning (HIGH/CRITICAL fail threshold) | `ci.yml` (`security-gate` job) | `trivy-fs.sarif`, `trivy-image.sarif`, uploaded to code scanning |
| Security | Secret rotation metadata age verification (AWS Secrets Manager and Vault) | `secret-rotation-verification.yml`, `deploy.yml` (`secret-rotation-gate` job) | `secret-rotation-evidence-<environment>-<run_id>` artifact (`*.json`, `*.txt`) |
| Compliance | RLS and DSR checks + evidence export | `ci.yml`, `compliance-evidence-export.yml` | Compliance artifacts + export bundle |
| Infrastructure | Terraform fmt/validate/plan | `terraform.yml` | Terraform plan summary |
| Release Safety | Build/deploy, staging smoke tests, SLO guard, prod smoke | `deploy.yml` | SBOM/attestation + deployment summary |
| Release Integrity | Backend/frontend reproducibility rebuild from the same commit, container digest parity, packaged artifact SHA-256 parity, allowlisted diff report when needed | `release.yml` (`reproducibility-build` + `reproducibility-compare` jobs) | `release-reproducibility-<run_id>` artifact (`reproducibility-report.md`, `reproducibility-comparison.json`, `reproducibility-allowlisted-diff.json`) |
| Reliability Ops | On-call drill MTTR trend publication | `oncall-drill-scorecard.yml` | `docs/operations/on-call-drill-scorecard.md` |
| Reliability Ops | Disaster recovery validation evidence | `dr-validation.yml` | DR validation artifact bundle |
| Governance | Migration chain integrity validation | `migration-chain-integrity.yml` | Migration integrity run logs |
| Governance | Periodic access review evidence | `access-review-automation.yml` | `access-review-evidence-<run_id>` artifact |
| Maintenance | Dependency freshness reporting | `dependency-outdated.yml` | `dependency-outdated-<run_id>` artifact |
| Legacy Coverage | Backend service-focused legacy suite | `v1-core-services-test.yml` | Workflow run logs + Codecov upload |
| Supplemental Testing | Manual/full test execution | `test.yml` | Test workflow artifacts |

## Workflow Lifecycle

| Workflow | Status | Owner | Notes |
| --- | --- | --- | --- |
| `ci.yml` | Active | team-quality | Consolidated quality + blocking security, tenant isolation, and accessibility gates. |
| `codeql.yml` | Active | team-security | Dedicated CodeQL analysis on pull requests and main pushes. |
| `deploy.yml` | Active | team-platform | Promotion, DAST, and production safety controls. |
| `release.yml` | Active | team-platform | Release packaging, reproducibility, and publish automation. |
| `test.yml` | Active | team-quality | Supplemental/manual full test workflow. |
| `terraform.yml` | Active | team-platform | Terraform validation and drift-related infrastructure checks. |
| `compliance-evidence-export.yml` | Active | team-security | Scheduled compliance evidence export. |
| `secret-rotation-verification.yml` | Active | team-security | Daily secret metadata age verification and production-promotion evidence. |
| `oncall-drill-scorecard.yml` | Active | team-sre | Scheduled MTTR trend publication. |
| `access-review-automation.yml` | Active | team-security | Scheduled access review evidence generation. |
| `dependency-outdated.yml` | Active | team-developer-experience | Dependency freshness reporting and PR triage comments. |
| `dr-validation.yml` | Active | team-sre | Disaster recovery validation workflow. |
| `migration-chain-integrity.yml` | Active | team-data-platform | Migration ordering/integrity validation. |
| `v1-core-services-test.yml` | Active (legacy-scoped) | backend-agent-platform | Narrow legacy backend-service coverage retained pending consolidation. |
| `docs/archive/workflows/accessibility.deprecated.yml.disabled` | Archived reference | team-quality | Historical definition retained for audit history; active accessibility enforcement lives in `ci.yml`. |
| `docs/archive/workflows/unified-deployment-pipeline.reference.yml` | Archived reference | team-platform | Reference material only; active deployment automation lives in `deploy.yml` and `release.yml`. |

## Branch Protection Required Checks

`main` branch protection must require the following checks:

- `pr-fast-blocking-subsets`
- `staging-deploy-release-gates`
- `codeql-analyze (js-ts)`

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

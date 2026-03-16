# CI Control Matrix

This is the single control matrix for workflows under `.github/workflows/`.

| Control Domain | Control | Enforced In Workflow | Evidence Artifact |
| --- | --- | --- | --- |
| Code Quality | Lint + typecheck + unit/integration tests | `ci.yml` | Coverage + test artifacts |
| Accessibility | WCAG 2.2 AA audit + trend gate + WCAG severity budgets (critical/serious=0) | `ci.yml` (`accessibility-audit` job) | `accessibility-trend` artifact (`a11y-metrics`, `wcag-severity-metrics`) |
| Localization | Key integrity + locale completeness coverage + pseudo-localization checks | `ci.yml` (`unit-tests` + `release-readiness`) | `i18n-coverage-dashboard`, `i18n-release-coverage-dashboard`, pseudo-loc report |
| UX Performance | Bundle + route-level load budgets enforced in CI | `ci.yml` (`accessibility-audit` job) | `ux-performance-metrics`, `route-load-metrics` |
| Security | CodeQL (JavaScript/TypeScript) | `codeql.yml` (`codeql-analyze (js-ts)` job) | GitHub Code Scanning alerts (CodeQL SARIF) |
| Security | Gitleaks secret scanning | `ci.yml` (`security-gate` job) | GitHub Action run logs + `security-gate-*` artifact |
| Security | Semgrep SAST scanning | `ci.yml` (`security-gate` job) | `semgrep.sarif`, uploaded to code scanning |
| Security | Trivy filesystem + container image scanning (HIGH/CRITICAL fail threshold) | `ci.yml` (`security-gate` job) | `trivy-fs.sarif`, `trivy-image.sarif`, uploaded to code scanning |
| Compliance | RLS and DSR checks + evidence export | `ci.yml`, `compliance-evidence-export.yml` | Compliance artifacts + export bundle |
| Infrastructure | Terraform fmt/validate/plan | `terraform.yml` | Terraform plan summary |
| Release Safety | Build/deploy, staging smoke tests, SLO guard, prod smoke | `deploy.yml` | SBOM/attestation + deployment summary |
| Reliability Ops | On-call drill MTTR trend publication | `oncall-drill-scorecard.yml` | `docs/operations/on-call-drill-scorecard.md` |

## Workflow Lifecycle

| Workflow | Status | Owner | Notes |
| --- | --- | --- | --- |
| `ci.yml` | Active | team-quality | Consolidated quality + blocking security gates. |
| `codeql.yml` | Active | team-security | Dedicated CodeQL analysis on pull requests and main pushes. |
| `deploy.yml` | Active | team-platform | Promotion and production safety controls. |
| `terraform.yml` | Active | team-platform | Terraform validation and drift checks. |
| `compliance-evidence-export.yml` | Active | team-security | Scheduled compliance evidence export. |
| `oncall-drill-scorecard.yml` | Active | team-sre | Scheduled MTTR trend publication. |
| `accessibility.deprecated.yml.disabled` | Deprecated | team-quality | Folded into `ci.yml` to remove duplicate setup and execution paths. |

## Branch Protection Required Checks

`main` branch protection must require the following checks:

- `pr-fast-blocking-subsets`
- `post-merge-critical-subsets`
- `codeql-analyze (js-ts)`

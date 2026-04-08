# CI Control Matrix

This is the single control matrix for workflows under `.github/workflows/`.

## Tier Definitions

- `blocking-critical`: Release or production-safety controls. A failure blocks promotion and requires explicit remediation.
- `blocking-standard`: Standard merge/progression quality and security controls. A failure blocks the lane where the control is enforced.
- `informational`: Advisory/trend controls used for governance, ratchets, or periodic review; they do not directly block release promotion.

## Workflow Check Classification

| Tier | Control Domain | Control | Enforced In Workflow | Owner | Remediation Pointer | Evidence Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| blocking-standard | Code Quality | Lint + typecheck + unit/integration tests | `pr-fast.yml` and `main-verify.yml` (`unit/component/schema`) | team-quality | `docs/testing/pnpm-test-contract.md` | Coverage + backend debt artifacts |
| blocking-standard | Accessibility | WCAG 2.2 AA audit + trend gate + WCAG severity budgets (critical/serious=0) | `pr-fast.yml` / `main-verify.yml` (`accessibility-audit`) | team-quality | `scripts/ci/check-a11y-severity-budgets.mjs` | Accessibility and frontend-quality artifacts |
| blocking-standard | Localization | Key integrity + locale completeness coverage + pseudo-localization checks | `pr-fast.yml` and `main-verify.yml` (`accessibility-audit`) | team-quality | `scripts/ci/check-i18n-keys.mjs` | `artifacts/i18n/*` |
| blocking-standard | UX Performance | Bundle + route-level load budgets enforced in CI | `pr-fast.yml` and `main-verify.yml` (`accessibility-audit`) | team-quality | `scripts/ci/check-ux-performance-budgets.mjs` | `artifacts/frontend-quality/*` |
| blocking-standard | Security | CodeQL (JavaScript/TypeScript) | `codeql.yml` (`codeql`) | team-security | `docs/security-compliance/secret-scan-evidence.md` | GitHub Code Scanning alerts (CodeQL SARIF) |
| blocking-standard | Security | Gitleaks secret scanning — PR diff | `pr-fast.yml` (`secret-scan` lane, hard blocker) | team-security | `.gitleaks.toml` + `docs/security-compliance/secret-rotation-log.md` | `gitleaks-pr.sarif` → GitHub Code Scanning |
| blocking-standard | Security | Gitleaks secret scanning — full git history | `main-verify.yml` (`secret-scan/full-history`), `secret-scan.yml` (push + manual) | team-security | `.gitleaks.toml` + `docs/security-compliance/secret-rotation-log.md` | `artifacts/secret-scan/gitleaks-history.*` (90-day retention) |
| informational | Security | Gitleaks secret scanning — nightly trend replay | `nightly-governance.yml` | team-security | `scripts/ci/security-baseline-verification.mjs` | Action logs + uploaded security artifacts |
| blocking-standard | Security | Semgrep SAST scanning | `pr-fast.yml`, `main-verify.yml`, `nightly-governance.yml` | team-security | `scripts/ci/check-ci-workflow-scanner-refs.mjs` | `semgrep.sarif`, uploaded to code scanning where applicable |
| blocking-standard | Security | Trivy filesystem + container image scanning (HIGH/CRITICAL fail threshold) | `pr-fast.yml`, `main-verify.yml`, `nightly-governance.yml` | team-security | `scripts/ci/check-ci-workflow-scanner-refs.mjs` | `trivy-fs.sarif`, `trivy-image.sarif` |
| blocking-critical | Security | Secret rotation metadata age verification (AWS Secrets Manager and Vault) | `secret-rotation-verification.yml`, `deploy.yml` (`secret-rotation-gate` job) | team-security | `docs/security-compliance/secret-rotation-log.md` | `secret-rotation-evidence-<environment>-<run_id>` artifact |
| blocking-standard | E2E Correctness | Critical user flows: auth + dashboard data load | `pr-fast.yml` (`e2e-critical`) | team-quality | `docs/testing/pnpm-test-contract.md` | `artifacts/e2e/*`, `playwright-report/` |
| blocking-standard | Type Safety | Per-package TypeScript error count ratchet (no regressions) | `pr-fast.yml` (`ts-type-ratchet`) | team-quality | `scripts/ci/ts-error-ratchet.mjs` | `artifacts/ci-lanes/ts-type-ratchet/` |
| blocking-standard | Compliance | RLS and DSR checks + evidence export | `pr-fast.yml`, `main-verify.yml`, `compliance-evidence-export.yml` | team-security | `scripts/ci/check-rls-coverage.sh` | Compliance artifacts + export bundle |
| blocking-standard | Infrastructure | Terraform fmt/validate/plan | `terraform.yml` | team-platform | `infra/README.md` | Terraform plan summary |
| blocking-critical | Pod Security | PSA namespace labels (`restricted` enforce/warn/audit) | `infra/k8s/security/pod-security-admission.yaml`, `infra/k8s/base/namespace.yaml` | team-platform | `infra/k8s/security/pod-security-admission.yaml` | Applied at cluster admission time |
| blocking-critical | Pod Security | Kyverno policy-as-code (readOnlyRootFilesystem, seccomp, no-latest-tag, resource limits, drop-ALL caps, tenant label) | `infra/k8s/security/kyverno-policies.yaml` | team-platform | `infra/k8s/security/kyverno-policies.yaml` | Kyverno admission webhook |
| blocking-standard | Pod Security | PodSecurityPolicy removal guard — rejects any new PSP references in manifests | `pr-fast.yml`, `main-verify.yml` (`unit/component/schema`) | team-platform | `scripts/ci/check-psp-references.mjs` | CI step exit code |
| blocking-critical | Architecture Integrity | Infra readiness contract — NATS deployed, LLMCache tenant-scoped, RLS tests not silently skipped, UsageEmitter buffer bounded | `pr-fast.yml`, `main-verify.yml` (`unit/component/schema`) | team-platform | `scripts/ci/check-infra-readiness-contract.mjs` | CI step exit code |
| blocking-standard | Architecture Integrity | Architecture doc/runtime drift — eventing stack claims, agent names, runtime service dirs, MessageBus path, image Dockerfiles, agent count | `pr-fast.yml`, `main-verify.yml` (`unit/component/schema`) | team-quality | `scripts/ci/check-architecture-doc-drift.mjs` | CI step exit code |
| blocking-critical | Release Safety | Main-branch release aggregation, staging health verification, deploy-time gates | `main-verify.yml` (`main-verify`), `deploy.yml` (`release-readiness`) | team-platform | `scripts/ci/verify-release-gate-status.mjs` | `release-artifacts/release-control-summary.*` |
| blocking-critical | Release Integrity | Backend/frontend reproducibility rebuild from the same commit, container digest parity, packaged artifact SHA-256 parity, allowlisted diff report when needed | `release.yml` (`reproducibility-build` + `reproducibility-compare` jobs) | team-platform | `scripts/ci/reproducibility-verify.mjs` | `release-reproducibility-<run_id>` artifact |
| informational | Reliability Ops | On-call drill MTTR trend publication | `oncall-drill-scorecard.yml` | team-sre | `scripts/ci/publish-oncall-drill-trends.mjs` | `docs/operations/on-call-drill-scorecard.md` |

### Overlap Pruning Applied

- Consolidated repeated governance assertions from `pr-fast.yml` and `main-verify.yml` into `scripts/ci/run-shared-governance-assertions.mjs`.
- Removed duplicate execution wiring for these shared assertions in individual workflow steps.
- Preserved nightly scans as informational controls instead of duplicate blockers when equivalent merge-blocking scans already run in PR and main workflows.

## Workflow Lifecycle

| Workflow | Status | Owner | Notes |
| --- | --- | --- | --- |
| `pr-fast.yml` | Active | team-quality | Pull-request-only merge blockers with fork-safe aggregation. |
| `main-verify.yml` | Active | team-quality | Trusted post-merge verification and release-oriented aggregation on `main`. |
| `nightly-governance.yml` | Active | team-quality | Scheduled advisory scans, trend checks, and heavy diagnostics. |
| `codeql.yml` | Active | team-security | Dedicated CodeQL analysis on pull requests and main pushes. |
| `deploy.yml` | Active | team-platform | Promotion and production safety controls. |
| `release.yml` | Active | team-platform | Canonical release packaging and upstream gate evidence bundle. |
| `terraform.yml` | Active | team-platform | Terraform validation and drift checks. |
| `compliance-evidence-export.yml` | Active | team-security | Scheduled compliance evidence export. |
| `secret-rotation-verification.yml` | Active | team-security | Daily secret metadata age verification for AWS Secrets Manager and Vault. |
| `oncall-drill-scorecard.yml` | Active | team-sre | Scheduled MTTR trend publication. |
| `control-pruning-review.yml` | Active | team-quality | Monthly control-pruning review for obsolete/redundant checks. |
| `docs/archive/workflows/accessibility.deprecated.yml.disabled` | Archived reference | team-quality | Accessibility checks were folded into active CI entry points; retained for audit history only. |

## PR Branch-Protection Contract (Minimal)

`main` pull-request branch protection must require only:

- `pr-fast`
- `infra-plan` (conditional: required only for pull requests that touch `infra/terraform/**`)

`codeql` remains advisory by default. Leadership may explicitly opt-in to make `codeql` a required PR check.

## Post-Merge Governance Checks

Post-merge governance for release promotion is enforced separately from PR branch protection:

- `main-verify` (main verification aggregate)
- `release-readiness` (deploy workflow aggregate)
- `DAST Gate` (deploy-time security gate; job id dast-gate)

## Control-Pruning Review Cadence

A monthly review (`control-pruning-review.yml`, 12:00 UTC on day 1 of each month) must:

1. Identify stale workflow references and duplicate informational controls.
2. Propose retirement/downgrade candidates with owner assignment.
3. Publish `artifacts/governance/control-pruning-review.{json,md}` for auditability.
4. Open follow-up remediation work before the next monthly cycle when stale controls are detected.

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

## Control Plane Required Gate Matrix

This matrix is the canonical mapping used by CI drift checks to validate that required control domains are enforced per run.

| Workflow | Domain | Required Gate Job ID | Required | Waiver Justification |
| --- | --- | --- | --- | --- |
| `main-verify.yml` | security | `security-gate` | yes | |
| `main-verify.yml` | tenant-isolation | `tenant-isolation-gate` | yes | |
| `main-verify.yml` | accessibility | `accessibility-audit` | yes | |
| `main-verify.yml` | reliability | `main-verify` | yes | |
| `release.yml` | security | `await-upstream-release-gates` | yes | |
| `release.yml` | tenant-isolation | `await-upstream-release-gates` | yes | Upstream gate verification includes tenant-isolation status checks before release promotion. |
| `release.yml` | accessibility | `await-upstream-release-gates` | yes | Upstream gate verification includes accessibility-audit status checks before release promotion. |
| `release.yml` | reliability | `reproducibility-compare` | yes | |

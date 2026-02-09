# Security Automation Pipeline — Spec

**Date:** 2026-02-09
**Epic:** Security Infrastructure
**Status:** Draft

---

## Problem Statement

The ValueOS CI/CD pipeline has security scanning spread across 7+ workflow files with significant tool overlap and inconsistent enforcement:

| Workflow | Tools | Overlap |
|---|---|---|
| `security-scan.yml` | CodeQL, Semgrep, Trivy (fs+image), TruffleHog, Checkov, npm audit | Trivy #1, TruffleHog #1, Checkov #1 |
| `secure-ci.yml` | git-secrets, TruffleHog, SBOM, Snyk, Trivy | Trivy #2, TruffleHog #2 |
| `security-gate.yml` | GitHub code scanning API, Dependabot API | — |
| `production-security.yml` | Trivy (fs+image), Hadolint | Trivy #3 |
| `terraform-security-scan.yml` | tfsec, Checkov, Trivy IaC | Checkov #2, Trivy #4 |
| `release-security-gate.yml` | SBOM, pnpm audit | SBOM #2 |
| `security-agent.yml` | Custom Node.js scanner (every 30 min) | — |

Additionally:
- Pre-commit hooks are disabled (`exit 0`), so secrets can reach the remote before CI catches them.
- The security gate blocks on P0/P1 code scanning alerts but does not enforce zero-tolerance on detected secrets.
- No rotation failure monitoring/alerting exists despite rotation infrastructure being in place.

## Scope

### In Scope

1. **Replace all 7 security workflows** with a single unified `security-pipeline.yml`.
2. **Enable pre-commit secret scanning** via gitleaks in `.husky/pre-commit`.
3. **Add rotation failure monitoring** — a GitHub Actions workflow that checks rotation health and alerts on failures.
4. **Remove the 7 replaced workflow files** from `.github/workflows/`.

### Out of Scope

- DAST scanning (deferred — no persistent scan target available).
- Building new rotation services (existing `RotationService.ts`, `SecretRotationScheduler.ts`, K8s CronJob, and `/api/security/rotate-keys` are sufficient).
- Changes to the `security-agent` code in `.github/security-agent/` (it will be removed along with its workflow).
- Changes to `pr-validation.yml` (it has its own TruffleHog step that will become redundant; noted for future cleanup but not in this scope to avoid breaking the PR validation summary job).

---

## Requirements

### R1: Unified Security Pipeline (`security-pipeline.yml`)

Replace all 7 existing security workflows with a single file containing these jobs:

#### R1.1: Secret Detection (PR-blocking, zero tolerance)
- **Tool:** TruffleHog (single instance, replaces 2 duplicates)
- **Trigger:** `pull_request` to `main`/`develop`, `push` to `main`/`develop`
- **Behavior:** Scan diff between base and head. Fail the job on any verified secret. This is a **hard block** — no `continue-on-error`.
- **SARIF:** Not applicable (TruffleHog uses `--fail` flag directly).

#### R1.2: SAST — CodeQL
- **Tool:** CodeQL (`github/codeql-action` v3)
- **Languages:** `javascript-typescript` (single matrix entry — the existing `python` entry is unnecessary since the repo has no Python application code; `check_errors.py` is a one-off script)
- **Queries:** `security-extended,security-and-quality`
- **Trigger:** `pull_request`, `push` to `main`/`develop`, weekly schedule
- **SARIF:** Upload to GitHub Security tab

#### R1.3: SAST — Semgrep
- **Tool:** Semgrep CI (`semgrep ci --config=auto`)
- **Trigger:** Same as CodeQL
- **SARIF:** Upload to GitHub Security tab

#### R1.4: Dependency Audit
- **Tool:** `pnpm audit --audit-level=high` + `actions/dependency-review-action` (on PRs)
- **Trigger:** `pull_request`, `push` to `main`/`develop`
- **Behavior:** `dependency-review-action` blocks on `moderate+` severity and denies `GPL-3.0`/`AGPL-3.0` licenses. `pnpm audit` runs as informational (non-blocking) since Dependabot handles remediation.
- **SBOM:** Generate CycloneDX SBOM via existing `pnpm run security:sbom` script. Upload as artifact.

#### R1.5: Container Vulnerability Scanning
- **Tool:** Trivy (single instance, replaces 4 duplicates)
- **Scans:**
  1. Filesystem scan (`scan-type: fs`) — catches vulnerabilities in source/config files
  2. Build + scan backend image (`infra/docker/Dockerfile.backend`)
  3. Build + scan frontend image (`infra/docker/Dockerfile.frontend`)
- **Trigger:** `pull_request`, `push` to `main`/`develop`
- **Severity:** `CRITICAL,HIGH` (block on critical for image scans, report high)
- **SARIF:** Upload all three scan results to GitHub Security tab with distinct categories

#### R1.6: Infrastructure as Code Scanning
- **Tool:** Checkov (single instance, replaces 2 duplicates)
- **Target:** `infra/terraform/`
- **Trigger:** `pull_request` (paths: `infra/terraform/**`), `push` to `main`/`develop` (paths: `infra/terraform/**`), weekly schedule
- **SARIF:** Upload to GitHub Security tab
- **Note:** tfsec is deprecated in favor of Trivy IaC scanning. Drop tfsec; use Checkov + Trivy IaC config scan instead.

#### R1.7: Dockerfile Linting
- **Tool:** Hadolint
- **Target:** `infra/docker/Dockerfile.backend`, `infra/docker/Dockerfile.frontend`
- **Trigger:** `pull_request`, `push` to `main`/`develop`

#### R1.8: Security Gate (summary job)
- **Depends on:** All above jobs
- **Behavior:**
  - **Hard fail** if: secret detection failed OR critical container vulnerabilities found
  - **Hard fail** if: CodeQL or Semgrep found critical/high severity findings (checked via GitHub code scanning API, same as current `security-gate.yml`)
  - **Warn** on: Dependabot high alerts, medium SAST findings
- **Output:** GitHub Step Summary with table of all scan results
- **PR Comment:** Post summary comment on PRs (using `actions/github-script`)

#### R1.9: Workflow Structure
- **Concurrency:** `group: security-${{ github.ref }}`, `cancel-in-progress: true` (for PRs)
- **Permissions:** Minimal per-job (`contents: read`, `security-events: write` only where needed)
- **Caching:** Single pnpm cache setup shared via a reusable setup step

### R2: Pre-commit Secret Scanning

#### R2.1: Gitleaks Pre-commit Hook
- **Tool:** gitleaks (lightweight, fast, works offline)
- **Install:** Add `gitleaks` binary check to `.husky/pre-commit`. If not installed, print install instructions and skip (don't block developers who haven't installed it).
- **Behavior:** Run `gitleaks protect --staged --no-banner` on staged files only.
- **Config:** Create `.gitleaks.toml` at repo root with:
  - Allowlist for `.env.example`, `.env.ports.example`, test fixtures
  - Rules for common secret patterns (AWS keys, JWT tokens, API keys with known prefixes like `sk_live_`, `whsec_`, `sk-`, `together_`)

#### R2.2: Pre-push Hook
- Update `.husky/pre-push` to run `gitleaks detect --no-banner --log-opts="origin/main..HEAD"` as a second layer.

### R3: Rotation Failure Monitoring

#### R3.1: Rotation Health Check Workflow
- **File:** `.github/workflows/rotation-monitor.yml`
- **Trigger:** `schedule` (daily at 06:00 UTC, after the K8s CronJob runs at 04:00 UTC)
- **Behavior:**
  1. Call the existing `/api/security/rotate-keys` GET endpoint (against staging/production URL) to retrieve rotation history
  2. Check that the most recent rotation for each provider occurred within the expected interval (90 days for API keys, 180 days for Supabase, per existing config)
  3. If any rotation is overdue or the last rotation failed: create a GitHub issue with label `security` and `rotation-failure`
  4. If a Slack webhook is configured (`vars.SLACK_WEBHOOK_URL`), send an alert
- **Secrets needed:** `ROTATION_HEALTH_CHECK_URL` (the base URL of the staging/production API)

### R4: Cleanup

Remove these workflow files (replaced by `security-pipeline.yml`):
1. `.github/workflows/security-scan.yml`
2. `.github/workflows/security-gate.yml`
3. `.github/workflows/secure-ci.yml`
4. `.github/workflows/production-security.yml`
5. `.github/workflows/terraform-security-scan.yml`
6. `.github/workflows/release-security-gate.yml`
7. `.github/workflows/security-agent.yml`

Remove the security-agent directory (its functionality is subsumed by the unified pipeline):
8. `.github/security-agent/` (entire directory)

Update references:
9. `.github/workflows/ci.yml` — change `security-gate` job to reference the new `security-pipeline.yml` instead of the deleted `security-gate.yml`

---

## Files Changed

| Action | File | Purpose |
|---|---|---|
| Create | `.github/workflows/security-pipeline.yml` | Unified security scanning pipeline |
| Create | `.github/workflows/rotation-monitor.yml` | Rotation health check + alerting |
| Create | `.gitleaks.toml` | Gitleaks configuration with allowlists |
| Modify | `.husky/pre-commit` | Enable gitleaks secret scanning on staged files |
| Modify | `.husky/pre-push` | Enable gitleaks detection on unpushed commits |
| Modify | `.github/workflows/ci.yml` | Update security-gate reference |
| Delete | `.github/workflows/security-scan.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/security-gate.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/secure-ci.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/production-security.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/terraform-security-scan.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/release-security-gate.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/workflows/security-agent.yml` | Replaced by security-pipeline.yml |
| Delete | `.github/security-agent/` | Custom scanner replaced by standard tools |

**Total: 4 created/modified, 8 deleted, 2 modified**

---

## Acceptance Criteria

All criteria must pass for the implementation to be considered complete.

### AC1: Unified Pipeline Exists and Is Syntactically Valid
- [ ] `.github/workflows/security-pipeline.yml` exists and passes `actionlint` (or manual YAML validation)
- [ ] Contains jobs: `secret-detection`, `codeql`, `semgrep`, `dependency-audit`, `container-scan`, `iac-scan`, `dockerfile-lint`, `security-gate`
- [ ] Triggers on: `pull_request` (main, develop), `push` (main, develop), `schedule` (weekly)

### AC2: Old Workflows Removed
- [ ] All 7 listed workflow files are deleted
- [ ] `.github/security-agent/` directory is deleted
- [ ] `.github/workflows/ci.yml` references `security-pipeline.yml` instead of `security-gate.yml`

### AC3: Secret Detection Is Zero-Tolerance
- [ ] TruffleHog job uses `--fail` flag and does NOT have `continue-on-error: true`
- [ ] The `security-gate` summary job hard-fails if `secret-detection` job failed

### AC4: SARIF Uploads Are Deduplicated
- [ ] Trivy uploads use distinct `category` values (`trivy-fs`, `trivy-backend-image`, `trivy-frontend-image`)
- [ ] CodeQL uploads use `category: /language:javascript-typescript`
- [ ] Semgrep uploads use a distinct category
- [ ] Checkov uploads use `category: checkov`
- [ ] No duplicate SARIF uploads across jobs

### AC5: Pre-commit Hook Scans for Secrets
- [ ] `.husky/pre-commit` runs `gitleaks protect --staged` when gitleaks is installed
- [ ] `.husky/pre-commit` prints install instructions and continues (does not block) when gitleaks is not installed
- [ ] `.gitleaks.toml` exists with allowlists for `.env.example`, `.env.ports.example`, and test fixtures

### AC6: Pre-push Hook Scans for Secrets
- [ ] `.husky/pre-push` runs `gitleaks detect` on commits not yet pushed to origin/main

### AC7: Rotation Monitor Exists
- [ ] `.github/workflows/rotation-monitor.yml` exists
- [ ] Runs on a daily schedule
- [ ] Checks rotation recency against configured intervals
- [ ] Creates a GitHub issue on failure (with `security` + `rotation-failure` labels)
- [ ] Optionally sends Slack alert if webhook is configured

### AC8: Blocking Policy Is Correct
- [ ] Secrets: zero tolerance (hard block)
- [ ] SAST critical/high: hard block (via code scanning API check)
- [ ] Container critical: hard block (Trivy `--exit-code 1`)
- [ ] Dependabot high: warning only
- [ ] Medium/low findings: informational only

### AC9: No Functional Regression
- [ ] The `ci.yml` workflow still calls a security gate and the gate job name matches what branch protection rules expect
- [ ] SBOM generation still works (`pnpm run security:sbom`)
- [ ] All SARIF results still appear in the GitHub Security tab

---

## Implementation Approach

### Phase 1: Create new files (non-breaking)
1. Create `.gitleaks.toml` configuration
2. Create `.github/workflows/security-pipeline.yml` with all jobs
3. Create `.github/workflows/rotation-monitor.yml`

### Phase 2: Update hooks and references
4. Update `.husky/pre-commit` with gitleaks scanning
5. Update `.husky/pre-push` with gitleaks detection
6. Update `.github/workflows/ci.yml` to reference the new pipeline

### Phase 3: Remove old files
7. Delete the 7 old workflow files
8. Delete `.github/security-agent/` directory

### Validation
9. Run `yamllint` or equivalent on all new/modified YAML files
10. Verify the pre-commit hook works locally (with and without gitleaks installed)
11. Verify the workflow YAML is structurally valid

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Branch protection rules reference old workflow job names | `ci.yml` is updated to call the new pipeline; the gate job name is preserved as `security-gate` |
| Developers without gitleaks installed are blocked | Pre-commit gracefully skips with install instructions |
| Rotation monitor can't reach production API | Uses a configurable secret (`ROTATION_HEALTH_CHECK_URL`); fails gracefully with issue creation |
| Removing security-agent breaks something | The agent runs on a 30-min cron and posts to issues; the unified pipeline covers the same scanning on every PR/push, which is more timely |

---

## Completion Criteria (Ralph Loop)

The Ralph loop is done when:
1. All files listed in "Files Changed" are created, modified, or deleted as specified
2. All 9 acceptance criteria (AC1–AC9) are satisfied
3. YAML validation passes on all new/modified workflow files
4. The pre-commit hook is manually testable (runs gitleaks or prints instructions)

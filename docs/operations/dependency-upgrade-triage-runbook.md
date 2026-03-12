# Dependency upgrade triage runbook

## Purpose

Track dependency drift in the monorepo and triage high-risk upgrades before they create security, stability, or compatibility incidents.

## CI signal

The `Dependency Outdated Report` GitHub Actions workflow runs:

- On pull requests targeting `main` or `develop`
- Every Monday at 08:00 UTC (scheduled scan)
- On manual dispatch

It captures `pnpm outdated --format=json`, classifies updates by patch/minor/major, and publishes artifacts:

- `ci-artifacts/pnpm-outdated.json`
- `ci-artifacts/dependency-outdated-report.json`
- `ci-artifacts/dependency-outdated-summary.md`

When high-risk major updates are detected for critical packages, the workflow can post a PR comment to prompt explicit triage.

## Ownership

- **Primary owner:** Platform Engineering
- **Security reviewer:** Security Engineering (for major upgrades and deprecated packages)
- **Domain approver:** Service owners for affected workspaces/apps

## Triage cadence

1. **Weekly** (scheduled run):
   - Platform Engineering reviews latest markdown summary artifact.
   - Open/refresh backlog issues for major upgrades.
2. **Per PR** (when comment is posted):
   - Confirm whether the major upgrade is in scope for current PR.
   - If out of scope, create a follow-up issue and link it in the PR.
3. **Monthly dependency review:**
   - Reassess critical package list and age threshold policy.
   - Decide whether to move from warn-only to fail-on-policy.

## Triage checklist

1. Inspect `dependency-outdated-summary.md` artifact.
2. For each major update, evaluate:
   - Breaking changes and migration guide
   - Security advisories / deprecations
   - Runtime impact across apps/packages
3. Tag each major as one of:
   - `safe-now` (can be upgraded in current sprint)
   - `needs-migration` (requires refactor/test plan)
   - `defer-with-justification` (documented reason + revisit date)
4. Record decision in backlog issue and link workflow run.

## Policy configuration

The analysis script reads these environment variables:

- `OUTDATED_POLICY_MODE=warn|fail`
- `OUTDATED_FAIL_ON_CRITICAL_AGE=true|false`
- `OUTDATED_CRITICAL_MAJOR_MAX_AGE_DAYS=<number>`
- `OUTDATED_CRITICAL_PACKAGES=pkg1,pkg2,...`

Default mode is warn-only. Teams can tighten policy over time by enabling `OUTDATED_FAIL_ON_CRITICAL_AGE=true` and/or switching `OUTDATED_POLICY_MODE=fail`.

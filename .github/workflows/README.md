# GitHub Actions Workflows for ValueOS

## Canonical CI Documentation

- Use [`CI_CONTROL_MATRIX.md`](./CI_CONTROL_MATRIX.md) as the canonical workflow control map.
- Archived workflows are stored under `docs/archive/workflows/` as non-executable references and should not be restored under `.github/workflows/` without an owner + deprecation reversal plan.

## CI Entry Points

### `pr-fast.yml`
- Trigger: `pull_request` to `main` or `develop`.
- Purpose: fork-safe, merge-blocking checks only.
- Final required check name: `pr-fast`.
- Merge blockers included here:
  - `unit/component/schema`
  - `tenant-isolation-static-gate`
  - `tenant-isolation-gate` (same-repo PRs only)
  - `security-gate`
  - `accessibility-audit`

### `main-verify.yml`
- Trigger: `push` to `main`.
- Purpose: trusted verification after merge with full-depth lanes and release-oriented aggregation.
- Trusted/full-depth lanes live here, including:
  - `tenant-isolation-gate`
  - `critical-workflows-gate`
  - `devcontainer-build`
  - `vitest/package-matrix`
  - `main-verify`

### `nightly-governance.yml`
- Trigger: scheduled nightly cron (`0 3 * * *`) and manual dispatch.
- Purpose: advisory scans, accessibility trend checks, and heavy diagnostics without producing mostly skipped runs.
- Schedule-only jobs should be defined here instead of on the PR workflow.

## Governance command contract

The required blocking governance gate is `pnpm run typecheck:signal --verify`. This command must be enforced in protected CI either directly, or transitively through `pnpm run ci:verify`.

`pnpm run ci:governance:self-check` validates that:
- `package.json` keeps the canonical governance commands wired correctly, and
- the required application workflows (`pr-fast.yml` and `main-verify.yml`) still reference either `pnpm run ci:verify` or the direct governance command.

## Tenant isolation CI policy

ValueOS uses two complementary tenant-isolation lanes:

- `tenant-isolation-static-gate` — secrets-free, deterministic fallback that runs on every PR and main verification run.
- `tenant-isolation-gate` — secret-backed runtime lane that runs on trusted contexts.

In `pr-fast.yml`, the `pr-fast` aggregation job requires **at least one** tenant-isolation lane to succeed. A skipped runtime lane on fork PRs is acceptable only when the static fallback lane succeeds.

## Branch protection required checks

`main` pull-request branch protection should require only:

- `pr-fast`
staging-deploy-release-gates
codeql-analyze (js-ts)
infra-plan (only for PRs touching infra/terraform/**)

codeql is advisory unless leadership explicitly promotes it to a blocking requirement.

Archived Workflow References
docs/archive/workflows/unified-deployment-pipeline.reference.yml (archived reference; superseded by deploy.yml)
docs/archive/workflows/accessibility.deprecated.yml.disabled (archived disabled workflow retained for audit history)

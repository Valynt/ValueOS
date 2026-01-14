# Release Process & Environment Promotion

## Overview

This document defines the release process for ValueCanvas, including versioning, tagging, and promoting changes across environments (Dev, Staging, Production).

## Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| **Development** | `main` | `https://dev.valuecanvas.com` | Continuous integration, developer testing. |
| **Staging** | `release/x.y.z` | `https://staging.valuecanvas.com` | QA, UAT, Pre-release verification. |
| **Production** | `main` (tagged) | `https://app.valuecanvas.com` | Live user traffic. |

## Versioning Strategy

We follow [Semantic Versioning (SemVer)](https://semver.org/): `MAJOR.MINOR.PATCH`.

*   **MAJOR**: Incompatible API changes.
*   **MINOR**: Backwards-compatible functionality.
*   **PATCH**: Backwards-compatible bug fixes.

## Release Workflow

### 1. Code Freeze & Branching

When a feature set is ready for release:

1.  Create a release branch from `main`:
    ```bash
    git checkout main
    git pull
    git checkout -b release/1.2.0
    ```
2.  Bump the version in `package.json`:
    ```bash
    npm version 1.2.0 --no-git-tag-version
    git commit -am "chore: bump version to 1.2.0"
    ```
3.  Push the branch:
    ```bash
    git push origin release/1.2.0
    ```

### 2. Staging Deployment

The CI/CD pipeline (GitHub Actions) automatically deploys `release/*` branches to the **Staging** environment.

1.  **Verify**: QA team performs regression testing on Staging.
2.  **Fixes**: Bug fixes found in Staging are committed to the `release/1.2.0` branch.

### 3. Production Release

Once Staging is verified:

1.  **Merge** the release branch back into `main`.
    ```bash
    git checkout main
    git merge release/1.2.0
    ```
2.  **Tag** the release on `main`.
    ```bash
    git tag -a v1.2.0 -m "Release 1.2.0"
    git push origin main --tags
    ```
3.  **Deploy**: The presence of a `v*` tag triggers the Production deployment pipeline.

### 4. Post-Release

1.  **Monitor**: Watch logs and metrics (Sentry, Datadog/OTel) for 1 hour.
2.  **Smoke Test**: Run critical path tests.
3.  **Rollback (if needed)**:
    *   If critical issues arise, revert to the previous tag.
    *   `git checkout v1.1.0` and trigger deployment manually.

## Database Migrations

*   Migrations run automatically during deployment *before* the application starts.
*   **Backward Compatibility**: All migrations must be backward compatible to ensure zero-downtime deployments.
    *   *Bad*: Renaming a column (breaks old code running during rollout).
    *   *Good*: Add new column, backfill data, then drop old column in a future release.

## Hotfixes

For critical bugs in Production:

1.  Branch from the current release tag:
    ```bash
    git checkout -b hotfix/1.2.1 v1.2.0
    ```
2.  Apply fix.
3.  Bump version to `1.2.1`.
4.  Push, test on Staging.
5.  Tag `v1.2.1` and deploy to Production.
6.  Merge `hotfix/1.2.1` back to `main`.

# GitHub Actions Workflows for ValueOS

This directory contains the canonical CI/CD responsibility map for ValueOS.

## Responsibility tiers

### PR-only blocking

PR branch protection should require only the fast, secrets-free workflow lane:

- `pr-only-blocking-gate` from `ci.yml`
- responsibilities: lint, typecheck, unit tests, secret-free tenant static checks, lightweight security static checks, and conditional frontend checks only when frontend-relevant files change.
- implementation detail: `ci.yml` uses `dorny/paths-filter` so frontend-only checks do not run on backend-only changes and backend-only tenant gates do not run on frontend-only changes.

### Main-only blocking

Pushes to `main` run trusted branch controls in `ci.yml` and `codeql.yml`:

- `main-only-blocking-gate`
- `main-codeql-analyze (js-ts)`
- responsibilities: trusted tenant runtime suites, deeper security verification, devcontainer build validation, and full-repo validation that depends on a trusted branch and/or secrets.

### Nightly-only advisory

Advisory workflows are intentionally named with the `Advisory -` prefix so branch protection should **not** require them.

- `Advisory - Nightly Validation Trends`
- `Advisory - Dependency Freshness Report`
- responsibilities: reproducibility rebuilds, dependency freshness reporting, accessibility trend collection, deep image scanning that is not required for merge safety, and drift/trend reporting.

### Release-only blocking

`Release - Blocking Integrity` is the release-only blocking workflow.

- responsibilities: SBOM generation and signing, release artifact signing, and release manifest verification.

### Deploy-only blocking

`Deploy - Blocking Promotion Gates` owns deployment-time blocking.

- responsibilities: DAST against staging, smoke tests, SLO and error-budget gates, secret rotation verification, and approval-driven production promotion.

## Required checks

`main` branch protection should require only:

- `pr-only-blocking-gate`

Do **not** require `Advisory - *` workflows in branch protection.

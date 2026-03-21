# CI Control Matrix

This is the control matrix for workflows under `.github/workflows/` after responsibility reclassification.

| Tier | Workflow | Blocking | Primary Controls |
| --- | --- | --- | --- |
| PR-only | `ci.yml` | Yes | Lint, typecheck, unit tests, secret-free tenant static checks, lightweight security static checks, conditional frontend checks via `dorny/paths-filter`. |
| Main-only | `ci.yml` | Yes | Trusted tenant runtime suites, deeper full-repo validation, devcontainer build validation. |
| Main-only | `codeql.yml` | Yes | CodeQL (JavaScript/TypeScript) analysis on trusted `main` runs. |
| Main-only | `ci.yml` | Yes | Gitleaks secret scanning, Semgrep SAST scanning, and Trivy filesystem + container image scanning in `main-deeper-security-verification`. |
| Nightly-only advisory | `nightly-advisory.yml` | No | Reproducibility rebuilds, accessibility trends, deep image scanning, drift and trend reporting. |
| Nightly-only advisory | `dependency-outdated.yml` | No | Dependency freshness reporting and stale major-version triage. |
| Release-only | `release.yml` | Yes | SBOM generation/signing, release artifact signing, release manifest verification. |
| Deploy-only | `deploy.yml` | Yes | DAST, staging smoke tests, SLO/error-budget gates, secret rotation verification, approval-driven promotion. |

## Branch protection required checks

`main` branch protection must require only the PR fast lane:

- `pr-only-blocking-gate`

Advisory workflows must not be added as required checks.

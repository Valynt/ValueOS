# Release Gates and Backlog Lanes

This document defines the CI lane model in `.github/workflows/ci.yml`, ownership expectations, and service level agreements (SLAs) for triage.

## Trigger Policy

| Trigger | Required lanes |
| --- | --- |
| Pull Requests | `unit/component/schema`, `tenant-isolation-gate`, `security-gate`, `accessibility-audit`, `pr-fast-blocking-subsets` |
| Staging / Deploy (`push`, `release`, `v*` tags) | `unit/component/schema`, `tenant-isolation-gate`, `security-gate`, `staging-deploy-release-gates`, `codeql-analyze (js-ts)`, `dast-gate` |
| Nightly schedule | Repository-level scheduled workflows (`ci.yml` currently has no scheduled required lanes) |

## Lane Definitions, Ownership, and SLA

| Lane | Primary scope | Owner lane | SLA target |
| --- | --- | --- | --- |
| `unit/component/schema` | Lint, typecheck, unit tests, schema hygiene checks, architecture guardrails | App Platform | Investigate within 4 business hours |
| `tenant-isolation-gate` | RLS + tenant-boundary integration checks and DSR compliance suites | Data Platform + Security | Investigate within 2 business hours |
| `critical-workflows-gate` | Claims verification + workflow contract checks for release flows | Backend Agent Platform | Investigate within 2 business hours |
| `staging-deploy-release-gates` | Canonical CI release aggregator for the production gate set | Platform + Security | Investigate within 2 business hours |
| `codeql-analyze (js-ts)` | Dedicated CodeQL analysis required before production promotion | Security Engineering | Investigate within 2 business hours |
| `security-gate` | SAST, SCA, secret scanning, SBOM export (required artifact), SARIF upload | Security Engineering | Investigate within 2 business hours |
| `dast-gate` | OWASP ZAP baseline scan against deterministic staging target with severity threshold enforcement | Security Engineering + Platform | Investigate within 2 business hours |
| `accessibility-audit` | WCAG 2.2 AA automation + trend gate | Frontend Platform | Investigate within 4 business hours |

## Artifacts and Failure Summaries

Each lane emits artifacts under lane-specific names (`lane-<lane-name>-<run_id>` or `<lane-name>-<run_id>`) and writes a lane summary containing:

- workflow name
- workflow `run_id`
- `run_attempt`
- lane status
- upstream lane states for dependency-based lanes

The `dast-gate` additionally uploads:

- `artifacts/dast/zap-report.json`
- `artifacts/dast/zap-report.html`
- `artifacts/dast/zap-report.md`
- `artifacts/dast/dast-summary.md`

These summaries/artifacts are uploaded even when a lane fails (`if: always()`), so triage can start from the artifact payload without re-running CI.

## Dependency Graph (needs)

- `critical-workflows-gate` depends on `unit-component-schema` and `tenant-isolation-gate`.
- PR blocking gate (`pr-fast-blocking-subsets`) depends on `unit-component-schema`, `tenant-isolation-gate`, `security-gate`, and `accessibility-audit`.
- `security-gate` is merge-blocking and will fail if SBOM generation fails or if `sbom.json` is missing or empty.
- Staging/deploy gate (`staging-deploy-release-gates`) depends on `tenant-isolation-gate`, `critical-workflows-gate`, `security-gate`, and `accessibility-audit`.
- Deploy workflow production promotion now consumes the canonical manifest in `scripts/ci/release-gate-manifest.json` through the `release-gate-contract` job in `.github/workflows/deploy.yml`. That contract waits for `staging-deploy-release-gates`, `codeql-analyze (js-ts)`, and the local `dast-gate` result to be green before `deploy-production` can start.

This structure guarantees release blockers are surfaced with explicit lane names and workflow IDs in a single enforcement contract.

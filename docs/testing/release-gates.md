# Release Gates and Backlog Lanes

This document defines the CI lane model across `.github/workflows/pr-fast.yml`, `.github/workflows/main-verify.yml`, and `.github/workflows/nightly-governance.yml`, ownership expectations, and SLAs for triage.

## Trigger Policy

| Trigger | Required lanes |
| --- | --- |
| Pull Requests | `unit/component/schema`, `tenant-isolation-static-gate`, `security-gate`, `accessibility-audit`, `pr-fast` |
| Main branch pushes | `unit/component/schema`, `tenant-isolation-gate`, `security-gate`, `critical-workflows-gate`, `main-verify`, `codeql` (advisory by default) |
| Nightly schedule | `nightly/security-advisory`, `nightly/accessibility-trends`, `nightly/tenant-isolation`, `nightly/critical-workflows`, `nightly/devcontainer-build` |

## Lane Definitions, Ownership, and SLA

| Lane | Primary scope | Owner lane | SLA target |
| --- | --- | --- | --- |
| `unit/component/schema` | Lint, typecheck, unit tests, schema hygiene checks, architecture guardrails | App Platform | Investigate within 4 business hours |
| `tenant-isolation-static-gate` | Secrets-free static tenant-boundary checks for fork-safe PR coverage | Data Platform + Security | Investigate within 4 business hours |
| `tenant-isolation-gate` | RLS + tenant-boundary integration checks and DSR compliance suites | Data Platform + Security | Investigate within 2 business hours |
| `critical-workflows-gate` | Claims verification + workflow contract checks for release flows | Backend Agent Platform | Investigate within 2 business hours |
| `main-verify` | Canonical post-merge main-branch release aggregator for trusted CI lanes | Platform + Security | Investigate within 2 business hours |
| `codeql` | Dedicated CodeQL analysis; advisory unless leadership marks it blocking | Security Engineering | Investigate within 2 business hours |
| `security-gate` | SAST, SCA, secret scanning, SBOM export, and SARIF upload | Security Engineering | Investigate within 2 business hours |
| `accessibility-audit` | WCAG 2.2 AA automation, trend gate, localization evidence, and pseudo-loc QA artifacts | Frontend Platform | Investigate within 4 business hours |
| `pr-fast` | PR aggregation that enforces merge-blocking status semantics, including fork-safe tenant fallback | Platform + Security | Investigate within 2 business hours |
| `nightly/security-advisory` | Advisory nightly security scanning and image/filesystem diagnostics | Security Engineering | Investigate next business day |
| `nightly/accessibility-trends` | Scheduled accessibility trend publication and severity budget verification | Frontend Platform | Investigate next business day |
| `nightly/devcontainer-build` | Scheduled devcontainer diagnostics and build reproducibility | Developer Experience | Investigate next business day |

## Dependency Graph (`needs`)

- `pr-fast` depends on `unit-component-schema`, `tenant-isolation-static-gate`, `tenant-isolation-gate`, `security-gate`, and `accessibility-audit`.
- `critical-workflows-gate` depends on `unit-component-schema` and `tenant-isolation-gate` in `main-verify.yml`.
- `main-verify` (job id `staging-deploy-release-gates`) depends on `tenant-isolation-gate`, `critical-workflows-gate`, `security-gate`, and `accessibility-audit`.
- Nightly governance jobs intentionally avoid PR-style `if:` filters so scheduled runs execute meaningful work instead of mostly skipped lanes.
- Deploy workflow production promotion consumes the canonical manifest in `scripts/ci/release-gate-manifest.json` through the `release-readiness` aggregate (job id `release-gate-contract`) in `.github/workflows/deploy.yml`. That contract waits for `main-verify` plus local deploy gates (`dast-gate`, `release-manifest-gate`, and `emergency-skip-audit`) before `deploy-production` can start.

# Release Gates and Backlog Lanes

This document defines the CI lane model in `.github/workflows/ci.yml`, the durable branch-protection contract exposed to GitHub, and the post-merge release-governance checks used after a change lands on `main`.

## Target Branch-Protection Contract

- `pr-fast`
- `infra-plan` *(only when Terraform-owned paths change and `terraform.yml` runs)*

`codeql` remains a dedicated security signal, but it is advisory unless leadership explicitly configures it as a blocking required check.

## Post-Merge / Release Governance Checks

- `main-verify`
- `release-readiness`
- `deploy-staging`
- `deploy-production`

On `main` pushes, `codeql` continues to run as an advisory security signal by default.

## Lane Definitions, Ownership, and SLA

| Lane / Check | Primary scope | Owner lane | SLA target |
| --- | --- | --- | --- |
| `pr-fast` | Durable PR aggregate over unit/schema, tenant-isolation, security, and accessibility lanes | App Platform + Security | Investigate within 2 business hours |
| `infra-plan` | Terraform format, validate, and plan checks for infra-affecting PRs | Platform | Investigate within 4 business hours |
| `main-verify` | Canonical `main` aggregate over release-relevant CI lanes after merge | Platform + Security | Investigate within 2 business hours |
| `release-readiness` | Canonical deploy-workflow aggregate that waits for post-merge blockers before production promotion | Platform + Security | Investigate within 2 business hours |
| `deploy-staging` | Staging deployment and smoke validation | Platform | Investigate within 2 business hours |
| `deploy-production` | Production deployment after protected promotion gates pass | Platform | Investigate within 1 business hour |
| `codeql` | Dedicated CodeQL analysis for JavaScript/TypeScript | Security Engineering | Investigate within 2 business hours |
| `unit/component/schema` | Lint, typecheck, unit tests, schema hygiene checks, architecture guardrails | App Platform | Investigate within 4 business hours |
| `tenant-isolation-gate` | RLS + tenant-boundary integration checks and DSR compliance suites | Data Platform + Security | Investigate within 2 business hours |
| `critical-workflows-gate` | Claims verification + workflow contract checks for release flows | Backend Agent Platform | Investigate within 2 business hours |
| `security-gate` | SAST, SCA, secret scanning, SBOM export (required artifact), SARIF upload | Security Engineering | Investigate within 2 business hours |
| `dast-gate` | OWASP ZAP baseline scan against deterministic staging target with severity threshold enforcement | Security Engineering + Platform | Investigate within 2 business hours |
| `accessibility-audit` | WCAG 2.2 AA automation + trend gate, plus shipped-locale (`en`, `es`) localization evidence and pseudo-loc QA artifacts | Frontend Platform | Investigate within 4 business hours |

## Dependency Graph (needs)

- `pr-fast` depends on `unit-component-schema`, `security-gate`, and `accessibility-audit`, while accepting either `tenant-isolation-static-gate` or `tenant-isolation-gate` as the tenant-boundary success signal.
- `main-verify` depends on `tenant-isolation-gate`, `critical-workflows-gate`, `security-gate`, and `accessibility-audit`.
- `release-readiness` in `.github/workflows/deploy.yml` evaluates `scripts/ci/release-gate-manifest.json` and currently requires `main-verify` plus the local deploy-workflow gates declared in that manifest.
- `deploy-production` depends on `release-readiness` and the direct deployment prerequisites declared in `.github/workflows/deploy.yml`.

This structure keeps low-level CI lanes available for diagnostics while exposing only a small, durable set of governance checks to repository settings and release tooling.

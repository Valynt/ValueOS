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

## Localization regression ownership and escalation

- Primary owner for localization regressions detected in `accessibility-audit` is **Frontend Platform** (`@team/frontend`).
- If a shipped-locale regression (`en`, `es`) is unresolved by the end of the current release cycle:
  - escalate to **`@team/owners` + release captain** before production approval,
  - record owner, mitigation, and due date in `docs/quality/ux-quality-scorecard.md`,
  - require a time-bound exception in release review docs (`docs/cicd/GO_NO_GO.md`, `docs/cicd/RELEASE_CHECKLIST.md`) or block promotion.

## Dependency Graph (`needs`)

- `pr-fast` depends on `unit-component-schema`, `tenant-isolation-static-gate`, `tenant-isolation-gate`, `security-gate`, and `accessibility-audit`.
- `critical-workflows-gate` depends on `unit-component-schema` and `tenant-isolation-gate` in `main-verify.yml`.
- `main-verify` (job id `staging-deploy-release-gates`) depends on `tenant-isolation-gate`, `critical-workflows-gate`, `security-gate`, and `accessibility-audit`.

## Backend stability recovery controls

During the backend test-stability recovery window, the mandatory-vs-tracked split and weekly failure ceilings are defined in `docs/testing/backend-test-stability-recovery-plan.md`. The merge-blocking enforcement is executed by `scripts/ci/check-backend-test-stability-baseline.mjs` in `pr-fast.yml` (`unit/component/schema` lane).

## E2E test classification

Tests are classified as **blocking** (merge-blocking, must pass) or **tracked** (flake-monitored, non-blocking).

### Blocking E2E tests (`e2e-critical` lane in `pr-fast.yml`)

These tests must pass on every PR. A failure blocks merge.
The lane also enforces strict minimum executed-test-count + pass-rate assertions so a skipped suite cannot pass silently.

| Test | Location | What it covers |
|---|---|---|
| Webhook → aggregation → Stripe billing flow | `packages/backend/src/services/billing/__tests__/integration/` | End-to-end billing pipeline correctness |
| Workflow persistence fixtures (WF-1/WF-2) | `tests/e2e/workflows/` | Real backend + persistence path for core workflow lifecycle |
| Real backend auth/agent/billing critical flow | `tests/e2e/real-backend-critical-flows.spec.ts` | End-to-end auth, agent invoke, billing webhook + persistence |
| Tenant isolation end-to-end | `tests/security/api-tenant-isolation.test.ts` | Cross-tenant data access prevention |
| RLS policy matrix | `tests/security/supabase-rls-policy-matrix.test.ts` | Row-level security enforcement |
| Agent invocation tenant boundary | `tests/security/agent-invocation-tenant-boundary.test.ts` | Agent execution isolation |
| Tenant header spoofing | `packages/backend/src/__tests__/analytics.tenant-header-spoofing.test.ts` | Header injection prevention |

### Tracked tests (non-blocking, flake-monitored)

These tests run in CI and contribute to the flake rate metric but do not block merge on failure.
Failures are tracked in `artifacts/ci-lanes/flake-report/flake-summary.json`.

| Test | Location | What it covers |
|---|---|---|
| Accessibility audit | `tests/accessibility/` | WCAG compliance trends |
| Performance benchmarks | `packages/backend/src/services/billing/__tests__/load/` | Throughput regression detection |
| Nightly tenant isolation | `tests/security/rls-tenant-isolation.test.ts` | Extended RLS validation |

### Flake rate policy

- Maximum allowed flake rate: **2%** (enforced by `scripts/ci/flake-gate.mjs --threshold 2`)
- A test is considered flaky if it passes only after retry within a single CI run
- Tests exceeding 2% flake rate over a rolling window are automatically moved to tracked status pending investigation
- To promote a tracked test to blocking: fix the flake root cause, verify < 2% over 10 consecutive runs, then update this document
- Nightly governance jobs intentionally avoid PR-style `if:` filters so scheduled runs execute meaningful work instead of mostly skipped lanes.
- Deploy workflow production promotion consumes the canonical manifest in `scripts/ci/release-gate-manifest.json` through the `release-readiness` aggregate (job id `release-gate-contract`) in `.github/workflows/deploy.yml`. That contract waits for `main-verify` plus local deploy gates (`dast-gate`, `release-manifest-gate`, and `emergency-skip-audit`) before `deploy-production` can start.
- Deploy workflow also requires `reliability-indicators-gate`, which enforces release-time reliability thresholds for critical check pass-rate, flaky-test threshold, and rollback drill recency.

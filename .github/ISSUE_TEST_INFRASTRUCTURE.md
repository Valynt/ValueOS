# 🚨 Test Infrastructure Scope Regression Risk

## Priority: P0 - Critical

## Summary

The stale failure model for this repository was assuming a broad infrastructure outage inside the default `pnpm test` lane. The current problem is narrower and more actionable:

> **If backend Vitest scope drifts, the default `pnpm test` run can accidentally include non-unit backend suites that are intentionally excluded from the unit lane.**

That scope regression can turn the default CI run into an 800+ failure burst because the excluded suites expect dedicated infrastructure, longer runtimes, or different secrets/configuration than the unit lane provisions.

## Canonical contract

The unit-lane contract is enforced by:

1. `vitest.config.ts`
2. `packages/backend/vitest.config.ts`
3. `.github/workflows/test.yml`

Supporting documentation lives in `docs/testing/pnpm-test-contract.md`.

## Current failure model

### What `pnpm test` is supposed to run

- Workspace Vitest projects only
- Backend **unit-oriented** tests covered by `packages/backend/vitest.config.ts`
- Deterministic suites that do not require separate infrastructure orchestration

### What `pnpm test` is intentionally supposed to exclude

The backend package contains suites that are valid, but **must not** be part of the default run:

- `*.integration.{test,spec}.ts`
- `*.int.{test,spec}.ts`
- `*.e2e.{test,spec}.ts`
- `*.perf.{test,spec}.ts`
- `*.load.{test,spec}.ts`
- Integration-only directories such as:
  - `src/**/__tests__/integration/**`
  - `src/**/__integration__/**`
  - `src/**/integration/**`
- Security/RLS lanes that run through dedicated commands/configs, such as `pnpm run test:rls`

### Why the default lane fails so loudly when this regresses

These excluded suites commonly require one or more of the following:

- Real or provisioned databases
- Queue/streaming infrastructure
- Dedicated secrets or auth fixtures
- Longer timing budgets than the unit lane allows
- Suite-specific setup/teardown that is not part of the default GitHub Actions unit workflow

When those tests leak into `pnpm test`, CI reports a large failure count that looks like broad infrastructure breakage even though the underlying issue is test-scope drift.

## Concrete prevention strategy

### 1. Backend Vitest exclusions

`packages/backend/vitest.config.ts` explicitly excludes the non-unit backend patterns listed above.

### 2. Static CI guard

`scripts/ci/check-backend-unit-test-scope.mjs` scans backend tests and fails if a known non-unit test path would still be matched by the default backend config.

### 3. CI ordering

`.github/workflows/test.yml` runs the guard **before** the main Vitest invocation so scope regressions fail fast instead of generating another large, noisy failure run.

## Operational guidance

### Default lane

- Use `pnpm test` for workspace unit coverage only.

### Separate lanes/commands

- Use `pnpm run test:rls` for RLS/security policy coverage.
- Use `pnpm run test:e2e:gate` for the E2E gate.
- Use targeted backend Vitest commands/configs for integration, performance, and load suites.

## Resolution criteria

- [ ] `packages/backend/vitest.config.ts` excludes non-unit backend suites
- [ ] `scripts/ci/check-backend-unit-test-scope.mjs` passes locally and in CI
- [ ] `.github/workflows/test.yml` runs the guard before `pnpm test`
- [ ] `docs/testing/pnpm-test-contract.md` documents the contract
- [ ] Engineers stop treating `pnpm test` as a catch-all backend integration/perf/security lane

---

**Updated**: 2026-03-19T00:00:00Z
**Status**: Active repository contract

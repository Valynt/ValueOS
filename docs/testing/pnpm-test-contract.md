# `pnpm test` contract

## Default expectation

`pnpm test` is the repository's **unit-only** Vitest entrypoint.

Engineers should treat the following files as the canonical enforcement points for that contract:

- `vitest.config.ts`
- `packages/backend/vitest.config.ts`
- `.github/workflows/test.yml`

Those files define what the default CI/unit lane runs and what it must exclude.

## What the default run includes

`pnpm test` runs the workspace Vitest projects that are explicitly delegated by `vitest.config.ts`. For the backend, the default package config only includes unit-oriented `src/**/*.{test,spec}.ts` files after applying the backend exclusion list in `packages/backend/vitest.config.ts`.

## What the default run excludes

The default `pnpm test` lane must **not** pick up backend suites that require separate infrastructure, slower execution budgets, or different assertions. The excluded categories are:

- Integration suites: `*.integration.{test,spec}.ts`, `*.int.{test,spec}.ts`
- Integration-only directories: `src/**/__tests__/integration/**`, `src/**/__integration__/**`, `src/**/integration/**`
- Performance suites: `*.perf.{test,spec}.ts`
- Load suites: `*.load.{test,spec}.ts`
- End-to-end/backend workflow suites: `*.e2e.{test,spec}.ts`
- Security/RLS suites that use dedicated commands or configs, such as `pnpm run test:rls`

If any of those suites start matching the default backend Vitest config again, CI should fail before the main Vitest run.

## How to run non-unit suites

Use dedicated commands or targeted Vitest/config invocations instead of `pnpm test`:

- Workspace unit lane: `pnpm test`
- RLS/security policy lane: `pnpm run test:rls`
- Frontend/backend E2E gate: `pnpm run test:e2e:gate`
- Backend integration lane: run targeted backend Vitest files or directories, for example:
  - `pnpm --filter @valueos/backend exec vitest run src/**/*.integration.test.ts src/**/*.integration.spec.ts src/**/*.int.test.ts src/**/*.int.spec.ts`
  - `pnpm --filter @valueos/backend exec vitest run src/**/__tests__/integration/**/*.test.ts src/**/__tests__/integration/**/*.spec.ts`
- Backend performance/load lane: run targeted backend Vitest files, for example:
  - `pnpm --filter @valueos/backend exec vitest run src/**/*.perf.test.ts src/**/*.perf.spec.ts`
  - `pnpm --filter @valueos/backend exec vitest run src/**/*.load.test.ts src/**/*.load.spec.ts`

## Failure model

The current infrastructure risk is **scope drift**, not a blanket statement that all failing tests are broken infrastructure.

If the backend default include/exclude contract regresses, `pnpm test` can accidentally absorb integration, perf, load, or other infrastructure-dependent suites. When that happens, the unit lane produces a large failure burst because those suites expect dedicated databases, queues, secrets, or longer-running environments that the default lane intentionally does not provision.

To prevent that regression:

1. `packages/backend/vitest.config.ts` excludes non-unit backend suites.
2. `scripts/ci/check-backend-unit-test-scope.mjs` verifies those exclusions still cover the known backend non-unit patterns.
3. `.github/workflows/test.yml` runs the guard before the main Vitest invocation.

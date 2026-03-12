# E2E Path Consolidation Inventory

Canonical root: `tests/e2e/`  
Deprecated root: `tests/test/e2e/`

## Overlap inventory

A historical overlap existed between both roots for these specs:

- `CrossComponentIntegration.test.ts`
- `MultiUserWorkflow.test.ts`
- `ValueJourney.test.ts`
- `llm-workflow.test.ts`

Current status:

- `tests/e2e/` contains all release-gate and UI workflow specs.
- `tests/test/e2e/` is absent.

## Resolution

1. Kept canonical versions under `tests/e2e/`.
2. Deleted deprecated duplicates from `tests/test/e2e/`.
3. Updated runner include patterns so that **Vitest** only targets `tests/e2e/**/*.test.ts` and **Playwright** only targets `tests/e2e/**/*.spec.ts`.
4. Wired CI to run Vitest for e2e `.test.ts` suites (`pnpm test`) and Playwright for `.spec.ts` suites (`pnpm run test:e2e:gate`) in critical workflow gating.
5. Added static guard `scripts/ci/guard-deprecated-e2e-path.mjs` and script alias `pnpm run check:e2e-path`.

## Guard behavior

`check:e2e-path` fails CI if any new `*.test.ts` (Vitest) or `*.spec.ts` (Playwright) files appear under the deprecated root.

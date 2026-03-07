# E2E Path Consolidation Inventory

Canonical root: `tests/e2e/`
Deprecated root: `tests/test/e2e/`

## Overlapping specs identified

The following filenames existed in both locations:

- `CrossComponentIntegration.test.ts`
- `MultiUserWorkflow.test.ts`
- `ValueJourney.test.ts`
- `llm-workflow.test.ts`

## Resolution

- Kept canonical versions under `tests/e2e/`.
- Deleted deprecated duplicates from `tests/test/e2e/`.
- Added CI guard script: `scripts/ci/guard-deprecated-e2e-path.mjs`.
- Updated E2E Vitest include/exclude patterns so only `tests/e2e/` is targeted.

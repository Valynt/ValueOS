# Scripts TypeScript Tech Debt

> **Status**: Known debt — not blocking local dev
> **Last Updated**: 2026-02-01
> **Owner**: Platform Team

## Summary

Scripts in `scripts/` are excluded from the main `typecheck` command to unblock local development. This is intentional — scripts are not part of the runtime app and should not block the dev loop.

## How to Check Script Errors

```bash
pnpm typecheck:scripts
```

## Current Failing Files (as of 2026-02-01)

| File                                | Error Category               | Notes                        |
| ----------------------------------- | ---------------------------- | ---------------------------- |
| `scripts/test-preflight.ts`         | Unused vars, type mismatch   | Low priority                 |
| `scripts/test-rls-leakage.ts`       | Unused error binding         | Low priority                 |
| `scripts/test-vector-queries.ts`    | Missing `openai` module      | Needs dep install or removal |
| `scripts/validate-deployment.ts`    | Missing internal imports     | Broken import paths          |
| `scripts/validate-together-ai.ts`   | Missing module, implicit any | Broken import paths          |
| `scripts/verify-login.ts`           | Unused var                   | Low priority                 |
| `scripts/verify-metrics.ts`         | Missing module               | Broken import paths          |
| `scripts/test/playwright/*.spec.ts` | Unused vars                  | Test cleanup                 |

## Error Categories

### 1. Missing External Modules

- `openai` — add to devDependencies or remove script
- Fix: `pnpm add -D openai`

### 2. Broken Internal Imports

Scripts referencing paths like `../src/lib/logger` or `../src/config/secrets/SecretValidator` that have moved or don't exist.

- Fix: Update import paths or remove dead scripts

### 3. Unused Variables (TS6133)

Low-priority cleanup. Prefix with `_` or remove.

- Fix: `const _unused = ...` or delete

### 4. Implicit Any (TS7006)

Add explicit types to catch blocks and parameters.

- Fix: `catch (error: unknown)` or `(param: SomeType)`

## CI Strategy

- `pnpm typecheck:app` — runs on all PRs (must pass)
- `pnpm typecheck:scripts` — runs nightly on main, or on PRs touching `scripts/**`

## Remediation Plan

1. **Week 1**: Fix missing module errors (install deps or remove dead scripts)
2. **Week 2**: Fix broken internal imports
3. **Week 3**: Clean up unused vars and implicit any
4. **Week 4**: Enable `pnpm typecheck:all` in CI for all PRs


## Why This Approach

- **Dev velocity**: App development isn't blocked by script maintenance
- **Quality pressure**: `typecheck:scripts` keeps errors visible
- **Proportional effort**: CI runs script checks on relevant changes only

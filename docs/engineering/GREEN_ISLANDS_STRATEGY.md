# TypeScript Green Islands Strategy

## Overview

ValueOS uses a "green islands" approach to incrementally restore type safety across the codebase. Instead of requiring global typecheck to pass (which would block development), we:

1. **Enforce type safety in "island" packages** - These are packages that are fully type-clean and must remain so
2. **Track global debt as a signal** - The overall error count is monitored but doesn't block PRs
3. **Gradually expand islands** - As debt is reduced, more packages become islands

## Current Islands (Enforced in CI)

| Package          | Status   | Errors | Notes                   |
| ---------------- | -------- | ------ | ----------------------- |
| `packages/infra` | ✅ Green | 0      | Infrastructure adapters |

## Candidate Islands (Near-Clean)

| Package              | Status   | Errors | Blockers                              |
| -------------------- | -------- | ------ | ------------------------------------- |
| `packages/shared`    | 🟡 Close | ~61    | NodeNext module resolution, DOM types |
| `packages/mcp`       | 🟡 Close | ~54    | Missing module imports                |
| `apps/mcp-dashboard` | 🟡 Close | ~57    | UI component imports                  |
| `packages/config-v2` | ✅ Green | 0      | Config only (no TS source files)      |

## High-Debt Packages (Track Only)

| Package            | Errors | Top Issues                                      |
| ------------------ | ------ | ----------------------------------------------- |
| `apps/ValyntApp`   | 4,216  | Path aliases, unused vars, strict mode          |
| `packages/backend` | 2,895  | Service layer types, exactOptionalPropertyTypes |
| `apps/VOSAcademy`  | 496    | UI components                                   |

## Commands

```bash
# Check island packages only (MUST pass on every PR)
pnpm run typecheck:islands

# Full telemetry report (informational)
pnpm run typecheck:signal

# JSON output for CI artifact storage
pnpm run typecheck:signal:json

# Quick summary
pnpm run typecheck:signal:summary
```

## CI Enforcement Rules

### PR Checks (Blocking)

- `typecheck:islands` - All island packages must have 0 errors
- Island failures BLOCK merge

### Main Branch (Tracking)

- `typecheck:signal:json` - Generate telemetry artifact
- Track error count trend over time
- Alert if error count increases by >5% in a week

## Promoting a Package to Island Status

1. Run `pnpm --filter <package> typecheck` to see current errors
2. Fix all errors in the package
3. Ensure package has its own `tsconfig.json` with appropriate settings
4. Add package to `typecheck:islands` script in root `package.json`
5. Add to the "Current Islands" table above
6. Update CI to enforce the new island

## Root Cause Categories

Based on telemetry analysis:

| Category                                       | Errors | Fix Strategy                       |
| ---------------------------------------------- | ------ | ---------------------------------- | ---------------------------- |
| **TS6133** (unused vars)                       | 1,411  | Add `_` prefix or remove dead code |
| **TS2307** (missing modules)                   | 1,107  | Fix path aliases in tsconfig       |
| **TS2339** (missing props)                     | 964    | Add proper type definitions        |
| **TS7006** (implicit any)                      | 476    | Add explicit type annotations      |
| **TS2375/TS2379** (exactOptionalPropertyTypes) | 510    | Use `                              | undefined` in optional types |

## Path Alias Issues

The top missing modules are `@/components/ui/*` - these need path alias fixes:

```
81x: @/components/ui/button
72x: @/components/ui/card
64x: @/components/ui/badge
57x: @/lib/utils
```

Ensure `tsconfig.json` has correct `baseUrl` and `paths` for the package scope.

## Policy: No New Debt in Islands

Once a package becomes an island:

- PRs that add TypeScript errors to that package will be blocked
- Exceptions require explicit approval with a tracking issue
- Debt must be repaid within the same sprint

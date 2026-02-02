# Quality Governor: Governance Pulse

**Scorecard:**
- **Total Errors:** `9782` 
- **Error Density:** `100.0%` of files impacted
- **Island Coverage:** `2` packages locked

## 🎯 Priority Packages (by error count)
| Rank | Package | Errors | Notes |
| :--- | :--- | ---: | :--- |
| 1 | `apps/ValyntApp` | 4725 | Primary UI surface; highest impact. |
| 2 | `packages/backend` | 4016 | Core service layer; API and orchestration. |
| 3 | `packages/mcp` | 468 | Integration surface; smaller but high leverage. |

## 🧭 Top Error Categories (top packages)
> Source: `tsc --noEmit` per-package spot checks to classify dominant error codes.

### `apps/ValyntApp`
- **Unused locals/params** (TS6133): cleanup/noise reduction first.
- **Missing modules / path aliases** (TS2307): fix import roots + alias resolution.
- **Property does not exist / shape drift** (TS2339): tighten component props + API types.
- **Null/undefined safety** (TS18047/TS2532/TS18048): add guards or explicit unions.
- **Call/assignment mismatches + implicit `any`** (TS2554/TS2322/TS2345/TS7006): add generics + explicit types.

### `packages/backend`
- **Property does not exist / shape drift** (TS2339/TS2551): align DTOs and domain models.
- **Type assignability + generics** (TS2345/TS2322/TS2353): add generics, tighten interfaces.
- **Null/undefined safety** (TS2532/TS18048): explicit guards or optional chaining.
- **Missing exports** (TS2305): fix barrel exports and re-exports.
- **Implicit `any` / call mismatch** (TS7006/TS2554): type params + update signatures.

### `packages/mcp`
- **Argument type mismatches** (TS2345): align request/response types.
- **Wrong arg count / call signatures** (TS2554): update helper signatures.
- **Import/export mismatches** (TS2459/TS2561): clean up module boundaries.
- **Property does not exist / missing module** (TS2339/TS2307): fix types + aliases.

## 📆 Weekly Burn-Down Plan (highest impact first)
1. **Week 1 — unblock cascades**
   - Fix TS2307 in `apps/ValyntApp` + `packages/mcp` (alias config + missing deps).
   - Remove TS6133 noise in `apps/ValyntApp` (unused variables/params).
2. **Week 2 — strict null safety**
   - Target TS2532/TS18047/TS18048 in `apps/ValyntApp` + `packages/backend`.
   - Add guards + `undefined` unions module-by-module (routes → services → components).
3. **Week 3 — type shape alignment**
   - Resolve TS2339/TS2551 in `packages/backend` and `apps/ValyntApp`.
   - Stabilize DTOs + shared model interfaces first, then downstream consumers.
4. **Week 4 — generics + call signatures**
   - Address TS2345/TS2322/TS2353/TS2554 in `packages/backend` and UI call sites.
   - Standardize helpers and add missing generic parameters.

## 🧱 CI Budget Gate (regression prevention)
- **Budget file:** `.typecheck-budget.json` with `maxTotalErrors`.
- **Gate:** `pnpm run typecheck:signal --verify` fails CI when total errors exceed budget or per-package baselines regress.
- **Update flow:** after weekly burn-down wins, lower `maxTotalErrors` and update per-package `.ts-debt.json` baselines.

## 📊 Weekly Error Delta Tracking
| Week (Mon) | Total Errors | Δ vs prior | Notes |
| :--- | ---: | ---: | :--- |
| 2026-02-02 | 9782 | — | Baseline from Governance Pulse. |

## 🏝️ Green Island Status
| Package | Status | Errors | Dependency Health |
| :--- | :--- | :--- | :--- |
| `apps/ValyntApp` | 🌊 Debt | 4725 | 🔗 2 deps |
| `apps/mcp-dashboard` | 🌊 Debt | 56 | 🍃 Leaf |
| `packages/agents` | 🌊 Debt | 164 | 🔗 2 deps |
| `packages/backend` | 🌊 Debt | 4016 | 🔗 1 deps |
| `packages/infra` | 🌊 Debt | 6 | 🍃 Leaf |
| `packages/mcp` | 🌊 Debt | 468 | 🍃 Leaf |
| `packages/sdui` | 🌊 Debt | 313 | 🍃 Leaf |
| `packages/services` | 🌊 Debt | 28 | 🍃 Leaf |
| `packages/shared` | 🌊 Debt | 6 | 🍃 Leaf |

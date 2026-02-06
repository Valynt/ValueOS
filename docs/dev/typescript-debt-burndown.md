# TypeScript Debt Burn-down Plan

- Generated: 2026-02-06
- Cadence: Weekly
- Horizon: 12 weeks
- Next checkpoint: 2026-02-13

## Weekly targets by package

| Package | Current baseline | Weekly reduction target | Week 4 budget | Week 8 budget | Week 12 budget | 12-week goal |
|---|---:|---:|---:|---:|---:|---:|
| `apps/ValyntApp` | 4516 | 136 | 3972 | 3428 | 2884 | 2884 |
| `apps/mcp-dashboard` | 54 | 2 | 46 | 38 | 30 | 30 |
| `packages/agents` | 86 | 3 | 74 | 62 | 50 | 50 |
| `packages/backend` | 2952 | 89 | 2596 | 2240 | 1884 | 1884 |
| `packages/infra` | 6 | 1 | 2 | 0 | 0 | 0 |
| `packages/mcp` | 411 | 13 | 359 | 307 | 255 | 255 |
| `packages/sdui` | 179 | 6 | 155 | 131 | 107 | 107 |
| `packages/services` | 20 | 1 | 16 | 12 | 8 | 8 |
| `packages/shared` | 5 | 1 | 1 | 0 | 0 | 0 |
| **Total** | **8229** | **252** | **7221** | **6218** | **5218** | **5218** |

## Operating rules

1. Run `pnpm typecheck:signal --verify` in CI and block package regressions.
2. During weekly checkpoint, compare each package current error count to its weekly budget.
3. If a package beats target, update that package baseline with `pnpm typecheck:signal --update-baseline` to lock gains.
4. Keep burn-down plans in each package `.ts-debt.json` sidecar as the source of truth.

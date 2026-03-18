# TS `any` Debt Dashboard

_Generated: 2026-08-18 (Sprint 43)_

## Global

- Baseline (2026-03-13): **1522**
- Current: **340**
- Long-term target: **<100**
- Baseline updated: **2026-08-18T00:00:00Z**
- Sprints elapsed since re-measurement: entering Sprint 43

## Generation notes

- Canonical explicit-`any` pattern: `:\s*any`, `as any`, `<any>`
- Included files: `apps/**`, `packages/**`, `src/**` with `.ts`/`.tsx` suffixes
- Excluded paths/files: `node_modules`, `dist`, `__tests__`, `*.test.*`, `*.spec.*`, `*.d.ts`
- Source of truth: `.ona/context/debt.md` section `DEBT-ANY-BURNDOWN`

## Module burn-down

| Module | Current | Sprint Target | Status |
| --- | ---: | ---: | :---: |
| `packages/backend` | 153 | <50 by S46 | 🔥 Active |
| `apps/ValyntApp` | 58 | <20 by S45 | 🔥 Active |
| `apps/VOSAcademy` | 66 | 0 by S44 | 🔥 Active |
| `packages/sdui` | 37 | 0 by S43 | 🔥 Active |
| `packages/shared` | 26 | 0 by S43 | 🔥 Active |
| `packages/mcp` | 0 | — | ✅ Resolved |
| `packages/components` | 0 | — | ✅ Resolved |
| `packages/infra` | verify | Re-measure S45 | ⏳ Pending |

## Sprint targets (burn-down order)

| Sprint | Package | Target | Notes |
| ------ | ------- | ------ | ------------------------------------------ |
| S43 | `packages/shared` | 26 → 0 | Re-measured; replaces original S43-44 row |
| S43 | `packages/sdui` | 37 → 0 | Pulled forward from original S51-54 |
| S44 | `apps/VOSAcademy` | 66 → 0 | Re-measured; replaces original S45-46 row |
| S45 | `apps/ValyntApp` | 58 → <20 | Re-measured; replaces original S55-60 row |
| S46 | `packages/backend` | 153 → <50 | Re-measured; replaces original S61-72 row |
| Post-46 | `apps/ValyntApp` | <20 → 0 | Deferred — complex event handler types |
| Post-46 | `packages/backend` | <50 → 0 | Deferred — systematic service layer audit |

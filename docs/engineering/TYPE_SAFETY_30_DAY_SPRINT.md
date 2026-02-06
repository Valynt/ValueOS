# Type Safety 30-Day Stabilization Sprint

## Objective
Reduce the TypeScript error backlog over a fixed 30-day sprint while protecting delivery throughput. This plan prioritizes highest-impact packages identified in `GOVERNANCE_PULSE.md`.

## Baseline (Governance Pulse)

| Package | Current Errors | Priority | Reason |
| --- | ---: | --- | --- |
| `apps/ValyntApp` | 4725 | P0 | Largest error concentration and highest product surface area. |
| `packages/backend` | 4016 | P0 | API/runtime correctness and tenant/security controls depend on this package. |
| `packages/mcp` | 468 | P1 | Integration reliability for orchestration pathways. |
| `packages/sdui` | 313 | P1 | UI rendering correctness and schema safety. |
| `packages/agents` | 164 | P2 | Agent workflow resiliency. |
| `apps/mcp-dashboard` | 56 | P2 | Dev/operator tooling quality. |
| `packages/services` | 28 | P2 | Shared service contracts. |
| `packages/infra` | 6 | P3 | Near-green; protect as island. |
| `packages/shared` | 6 | P3 | Near-green; protect as island. |

## 30-Day Execution Plan

### Days 1-7: Error Budget Lock + Guardrails
- Freeze the baseline error counts by package.
- Enable ratchet policy: no package may increase TypeScript errors.
- Create package owners and daily burn-down targets.
- Expand strict mode in leaf packages first (`packages/infra`, `packages/shared`, `packages/services`).

### Days 8-14: P0 Package Burn-Down
- Focus squads on `apps/ValyntApp` and `packages/backend`.
- Remove unsafe `any`, nullable misuse, and untyped API boundaries.
- Prioritize files that sit on critical paths (auth, security, orchestration, billing).

### Days 15-21: P1 Package Hardening
- Burn down `packages/mcp` and `packages/sdui` errors.
- Enforce schema-driven typing for cross-package payloads.
- Add regression tests for fixed type boundaries.

### Days 22-30: Island Expansion + Ratchet Tightening
- Graduate near-clean packages to green-island lock.
- Tighten `typecheck:signal` thresholds for P0/P1 packages.
- Publish final scorecard delta and next 30-day target.

## Acceptance Criteria
- `apps/ValyntApp` and `packages/backend` each reduce error count by at least 25%.
- `packages/mcp` + `packages/sdui` each reduce error count by at least 40%.
- No package regresses above its day-1 baseline.
- CI remains green on canonical `pnpm run ci:verify` pipeline.

## Reporting Cadence
- Daily: package-level delta posted to Governance Pulse report.
- Weekly: risk review of blocked error classes (API contracts, nullable paths, inferred `any`).
- Day 30: closeout report with remaining debt and next sprint scope.

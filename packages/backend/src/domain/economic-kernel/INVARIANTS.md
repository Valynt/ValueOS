# Economic Kernel Invariants

Mathematical properties that must hold for any overlay or domain pack.
Tested in `__tests__/economic_kernel.test.ts`.

## DCF / NPV

- `sum(presentValues) == npv` — no rounding drift between components and total
- `NPV(flows, 0%) == sum(flows)` — zero discount means no time-value adjustment
- `NPV(flows, r1) > NPV(flows, r2)` when `r1 < r2` and future flows are positive

## IRR

- `NPV(flows, IRR) ≈ 0` within convergence tolerance
- `IRR > discountRate` iff `NPV > 0` (for conventional cash flows with single sign change)

## Payback

- `cumulativeFlows[paybackPeriod] >= 0`
- `cumulativeFlows[paybackPeriod - 1] < 0` (for period > 0)
- Payback exists when `sum(flows) >= 0`
- `discountedPayback >= undiscountedPayback`

## EVF

- `riskAdjustedValue == netValue * (1 - riskFactor)`
- `riskFactor ∈ [0, 1]`
- Components (revenue, cost, risk) are preserved in output

## ROI

- `ROI == (benefits - costs) / costs`
- `costs != 0` (division guard)
- `NPV > 0` implies `ROI > 0` for same undiscounted flows

## Sensitivity

- Output at base value (multiplier = 1.0) matches direct calculation
- Monotonic input → monotonic output (for monotonic evaluation functions)

## KPI Registry

- All metric IDs are valid UUIDs
- All metric names are snake_case
- No duplicate IDs or names
- No narrative text in metric names

## Overlay Contract

- `kpiOverrides[].metricId` must exist in `appliesTo`
- `benchmarks[].metricId` must exist in `appliesTo`
- Regulated overlays must specify at least one regulatory framework
- All IDs are UUIDs, names are kebab-case, versions are semver

# Frontend Quality Dashboard

This dashboard centralizes frontend quality signals so PR reviewers can validate accessibility, localization, and UX performance in one place. The durable release scorecard lives in `docs/quality/ux-quality-scorecard.md`, which promotes the most important CI outputs into a stable document that can be reviewed over time.

## What CI publishes

The `accessibility-audit` lane in `.github/workflows/ci.yml` now emits:

- `artifacts/accessibility/a11y-metrics.json` and `a11y-trend-summary.md` (route a11y trend metrics).
- `artifacts/accessibility/wcag-severity-metrics.json` (severity budget gate outcome).
- `artifacts/i18n/extracted-keys.json` (source locale extraction catalog).
- `artifacts/i18n/coverage-dashboard.json` (locale key completeness and coverage).
- `artifacts/i18n/pseudo-localization-report.json` (pseudo-localization expansion/token integrity checks).
- `artifacts/frontend-quality/dashboard.md` + `dashboard.json` (aggregated scorecard).

## Quality gates

### Accessibility merge blockers

- **Critical WCAG violations block merge** via Playwright axe route checks (`tests/accessibility/axe-a11y.spec.ts`).
- **Serious WCAG violations also block merge** via `scripts/ci/check-a11y-severity-budgets.mjs` and `.github/metrics/wcag-severity-budgets.json` budgets.

### Non-blocking trend reporting

- Moderate/minor categories are tracked in `wcag-severity-metrics.json` and trend outputs; they do not fail merge unless they exceed configured budgets.
- Regression drift on pass-rate and keyboard coverage is reported by `scripts/ci/a11y-trend-gate.mjs` against `.github/metrics/accessibility-baseline.json`.

### Localization quality

- Locale completeness and key integrity are enforced through `scripts/ci/check-i18n-keys.mjs`.
- Pseudo-localization readiness and token preservation are enforced by `scripts/ci/check-pseudo-localization.mjs`.

## KPI definitions

- **Bundle KPI:** total built frontend asset size from `apps/ValyntApp/dist`.
- **Route-load KPI:** p95 `domContentLoaded` timing collected from accessibility route tests.
- **Localization KPI:** locale coverage/completeness thresholds + pseudo-localization status.

## Reviewer workflow

1. Open the `accessibility-audit` artifact bundle on each PR.
2. Inspect `artifacts/frontend-quality/dashboard.md` for at-a-glance status.
3. Promote the release summary, route regressions, and ownership updates into `docs/quality/ux-quality-scorecard.md`.
4. Drill into linked JSON artifacts when a metric regresses.
5. If thresholds are intentionally updated, update the metrics baseline/budget files in the same PR.

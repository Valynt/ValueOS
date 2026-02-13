# Accessibility CI Acceptance Criteria (WCAG 2.2 AA)

This repository enforces a minimum automated accessibility baseline for high-traffic routes in:

- `apps/ValyntApp`
- `apps/VOSAcademy`

## Minimum acceptance gate

1. **WCAG scope:** axe scan uses WCAG A/AA tags (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`).
2. **Blocking threshold:** CI fails on any **serious** or **critical** axe violation.
3. **Keyboard-only checks:** auth, dashboard, and key workflow pages must remain keyboard reachable.
4. **Focus order checks:** tab traversal must not trap focus and must progress through multiple focusable controls.
5. **Artifacts:** JSON + HTML reports and a trend snapshot (`a11y-trend.json`) are published for each CI run.

## How to run locally

```bash
pnpm test:a11y
```

Generate report + trend summary:

```bash
pnpm test:a11y:report
```

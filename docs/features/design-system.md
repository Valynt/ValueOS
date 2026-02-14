# Design System

**Last Updated**: 2026-02-08

**Consolidated from 4 source documents**

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Valynt Design System](#valynt-design-system)
3. [Untitled](#untitled)
4. [Canonical palette mapping](#canonical-palette-mapping)

---

## Design Principles

*Source: `features/design-system/principles.md`*

These core values guide every design decision at Valynt.

## 1. Clarity Over Cleverness

Our users are here to analyze complex data and make high-value decisions. The UI should fade into the background.

- **Avoid** decorative elements that don't add meaning.
- **Prioritize** readability and data density.
- **Label** everything unambiguously.

## 2. Dark Mode First (Eye Health)

Valynt is a "Command Center" tool used for long sessions.

- We design for **Dark Mode** first to reduce eye strain.
- We use **Contrast** to guide attention, not just brightness.

## 3. The "Glass Box" (Trust)

We are an Agentic Platform. Users must trust the AI.

- **Show Confidence**: Always display confidence scores for AI actions.
- **Explain Reasoning**: Provide tooltips or "Why?" affordances.
- **Feedback Loops**: Make it easy to correct the system.

## 4. Building a Consistent Design System

This is the task of creating a single, reusable library of components (buttons, form fields, icons), styles (colors, typography), and guidelines.

**Why it makes the difference:** Consistency builds trust and reduces cognitive load. When a button or link looks and behaves the same way everywhere in your app, users don't have to re-learn how to use your interface on every new screen. It makes the entire product feel cohesive, professional, and predictable, rather than a jumbled collection of different designs.

## 5. Progressive Disclosure

Don't overwhelm the user.

- Show the **Summary** first.
- Allow **Drill-down** on demand.
- Keep the "Zero State" clean and inviting.

## 6. Consistency is Trust

If it looks the same, it should act the same.

- Re-use **Core Components** (`Button`, `Card`, `Input`).
- Adhere rigidly to the **8px Spacing Grid**.

---

## Valynt Design System

*Source: `features/design-system/README.md`*

Welcome to the official design system for Valynt (ValueOS). This living style guide defines the visual language, components, and patterns used to build our agentic SaaS platform.

## 📚 Documentation Structure

- **[Foundation](./foundation/)**: The atomic visual decisions.
  - [Colors](./foundation/colors.md)
  - [Typography](./foundation/typography.md)
  - [Spacing](./foundation/spacing.md)
  - [Elevation](./foundation/elevation.md)
  - [Motion](./foundation/motion.md)
- **[Components](./components/)**: Reusable UI elements.
  - [Button](./components/button.md)
  - [Input](./components/input.md)
  - [Card](./components/card.md)
  - [Modal](./components/modal.md)
  - [State Matrix](./components/state-matrix.md)
- **[Layout](./layout/)**: Grid and container standards.
  - [Layout & Grid](./layout/grid.md)
- **[Patterns](./patterns/)**: UX flows and compositions.
  - [Forms](./patterns/forms.md)
  - [Navigation](./patterns/navigation.md)
  - [Data Display](./patterns/data-display.md)
- **[Principles](./principles.md)**: Our design philosophy.

## 🎨 Implementation

The source of truth for design tokens is located in `tokens.css`.

```css
@import "/design-system/tokens.css";
```

## 🛠 Tools Stack

- **Figma**: Primary design tool for UI/UX.
- **Tailwind CSS**: Utility-first framework used for implementation (mapped to our tokens).
- **Lucide React**: Iconography library.
- **Radix UI**: Headless accessible primitives for complex components (Dialogs, Popovers).

## 🧩 Icon Usage Guidance

Use the shared icon utility classes to keep icon sizing and color consistent across headers, cards, and empty states:

- **Sizing**: `icon-sm`, `icon-md`, `icon-lg` for 16/20/32px icons.
- **Color**: `icon-muted` for secondary iconography, `icon-accent` for emphasis.
- **Inheritance**: Use size utilities only when the icon should inherit the surrounding text color.
- **Consistency**: Prefer these utilities over ad-hoc `h-* w-*` classes in UI surfaces.

## ⚖️ Governance & Maintenance

### Contribution Process

1. **Explore**: Check existing patterns first.
2. **Propose**: Discuss new component needs in `#design-system` channels.
3. **Draft**: Create a Figma mockup or code prototype.
4. **Review**: Design + Eng review for visual consistency and API design.
5. **Merge**: Update documentation and tokens upon release.

### Versioning

- **Major (1.0)**: Breaking changes to core tokens or component APIs.
- **Minor (1.1)**: New components or additive changes.
- **Patch (1.1.1)**: Bug fixes or slight visual tweaks.

### Accessibility Standards

- All text must meet **WCAG AA** contrast (4.5:1).
- Interactive elements must be at least **44px** tall/wide.
- All forms must have explicit `<label>` elements.
- Components must be keyboard navigable (`Tab` focusable).

---

## Untitled

*Source: `design-system/DESIGN_SYSTEM_MASTER.md`*

**Design System**

This design system package provides canonical design tokens and a small set of accessible primitives.

Design Tokens

- Color: semantic tokens exposed as CSS custom properties. See `packages/components/design-system/src/css/tokens.css`.
- Spacing: 8-point scale in `--vds-space-*` variables.
- Typography: sizes and family in `--vds-type-*` and `--vds-font-family-base`.
- Elevation: shadow tokens `--vds-elev-*`.

Accessible Components

- `Button` (use native `<button>`; supports `Enter`/`Space` and visible focus)
- `Input` (label + helper + error with `aria-describedby`)
- `Label` (accessible label primitive)
- `Dialog` (role=dialog, aria-modal, Escape to close; use focus-trap lib for production)
- `Tooltip` (role=tooltip, referenced by `aria-describedby`)

Usage

Install or import from the local package and ensure token CSS is loaded at app root or Storybook preview.

Versioning

- Follow semver. Breaking changes require deprecation shims and migration docs.

ARIA & Keyboard Patterns

- Dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, trap focus, return focus to opener.
- Tooltip: attach via `aria-describedby`, show on focus/hover, hide on escape/blur.

Next steps

- Add Storybook stories and accessibility tests.
- Migrate app-local primitives into the package and add CI checks for token integrity.

---

## Canonical palette mapping

*Source: `features/design-system/canonical-palette.md`*

The source-of-truth palette for ValueOS lives in `apps/ValyntApp/src/styles/valueos-palette.css`. It defines the shared primary/secondary/accent/neutral roles plus success/warning/error status colors, with light and dark variants using the same token names.

Apps should map their local semantic tokens to these canonical values instead of redefining raw hex/OKLCH/HSL colors. See:

- `apps/VOSAcademy/src/index.css`
- `apps/mcp-dashboard/src/index.css`
- `apps/ValyntApp/src/styles/ai-indigo-tokens.css`

If you need new semantic colors, add them to the canonical palette first and then map downstream tokens to those names.

---

## UX Quality Scorecard

Track quality weekly and review at release readiness.

| Metric | Definition | Target | Regression Threshold | Source |
|---|---|---:|---:|---|
| a11y pass rate | % of accessibility tests passing across audited routes | ≥ 98% | Drop > 2 points vs baseline | `tests/accessibility` + CI trend gate |
| keyboard coverage | % of audited routes passing keyboard navigation checks | 100% | Drop > 5 points vs baseline | `tests/accessibility/axe-a11y.spec.ts` |
| contrast regressions | Count of new serious/critical contrast-related violations | 0 | Any increase > 0 | axe run annotations + trend artifact |
| localization completeness | % translated keys per supported locale vs source (`en`) | ≥ 90% (dev), ≥ 98% (release) | Any locale below threshold | `scripts/ci/check-i18n-keys.mjs` dashboard |

### Operational cadence

1. CI publishes scorecard artifacts (`accessibility-trend`, `i18n-coverage-dashboard`).
2. Release pipeline enforces stricter localization threshold.
3. Any metric crossing regression thresholds blocks merge/release until resolved.

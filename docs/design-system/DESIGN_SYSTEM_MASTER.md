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

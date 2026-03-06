# Canonical Palette Mapping (ValueOS)

## Source of truth

The canonical ValueOS color palette is defined in:

- `apps/ValyntApp/src/styles/valueos-theme.css` (`--vos-color-*` semantic palette)
- Backed by primitives in `apps/ValyntApp/src/styles/valueos-palette.css` (`--valueos-*`)

Use these tokens instead of introducing app-local hex/OKLCH/HSL values.

## App mappings

### `apps/VOSAcademy/src/index.css`

- Core theme tokens (`--primary`, `--secondary`, `--accent`, `--background`, `--foreground`, etc.) map to `--valueos-*` tokens.
- Status tokens now map consistently:
  - `--destructive` → `--valueos-error`
  - `--success` → `--valueos-success`
  - `--warning` → `--valueos-warning`
- Chart tokens now derive from canonical palette roles instead of app-local blue steps.

### `apps/mcp-dashboard/src/index.css`

- Core theme tokens map to `--valueos-*` tokens.
- Added explicit semantic status mappings for parity with other apps:
  - `--success` / `--success-foreground`
  - `--warning` / `--warning-foreground`

### `apps/ValyntApp/src/styles/ai-indigo-tokens.css`

- Theme-specific visual tokens remain derived from canonical `--valueos-*` palette.
- Added semantic status aliases (`--status-success`, `--status-warning`, `--status-error`, `--status-info`) so state tokens map through consistent status naming.

## Light/dark alignment rule

Light and dark themes must keep the same semantic token names; only underlying palette values should change via `.dark` token overrides in the canonical palette/theme files.

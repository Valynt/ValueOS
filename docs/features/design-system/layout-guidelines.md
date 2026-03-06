# Layout & Grid Guidelines

These guidelines standardize container and spacing behavior across ValueOS apps.

## Shared layout tokens

Use shared tokens from `packages/shared/src/styles/layout-tokens.css`:

- `--space-0` → `0` (Tailwind equivalent: `0`)
- `--space-1` → `0.5rem` (Tailwind: `2`)
- `--space-2` → `1rem` (Tailwind: `4`)
- `--space-3` → `1.5rem` (Tailwind: `6`)
- `--space-4` → `2rem` (Tailwind: `8`)
- `--space-5` → `2.5rem` (Tailwind: `10`)
- `--space-6` → `3rem` (Tailwind: `12`)
- `--space-8` → `4rem` (Tailwind: `16`)

Container tokens:

- `--container-max`: `80rem` (1280px)
- `--container-padding-sm`: `1rem` (16px)
- `--container-padding-md`: `1.5rem` (24px)
- `--container-padding-lg`: `2rem` (32px)

## Container standard

Use the shared `.container` class for all page-level content wrappers.

Behavior:

- Always centered (`margin-inline: auto`)
- Horizontal padding scales at breakpoints:
  - base: `--container-padding-sm`
  - `sm` and up: `--container-padding-md`
  - `lg` and up: `--container-padding-lg`
- Max width applies at `lg` and up: `--container-max`

## Grid usage

- Use Tailwind grid primitives (`grid`, `grid-cols-*`, `gap-*`) for layout structure.
- Use token-aligned gaps for consistency (`gap-4`, `gap-6`, `gap-8`, `gap-10`, `gap-12`, `gap-16`).
- Prefer 12-column desktop layouts for complex pages, collapsing to 1–2 columns on smaller screens.
- Keep content rhythm aligned to the shared spacing scale (`--space-*` / matching Tailwind spacing utilities).

## App adoption

Current apps aligned to this standard:

- `apps/VOSAcademy`
- `apps/ValyntApp`
- `apps/mcp-dashboard`

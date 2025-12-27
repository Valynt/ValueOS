# Elevation & Shadows

Elevation in a dark interface is achieved primarily through **Surface Lightness** and subtly through **Shadows** and **Borders**.

## Depth Hierarchy

We use a "Lighter is Higher" model.

1.  **Level 0 (Background)**: `--color-surface-1` (#0B0C0F). The canvas.
2.  **Level 1 (Card)**: `--color-surface-2` (#13141A). Primary content containers.
3.  **Level 2 (Elevated)**: `--color-surface-3` (#1A1C24). Modals, popovers, dropdowns.

## Shadow Tokens

While subtle in dark mode, shadows add definition.

| Token           | CSS Value                          | Usage                                  |
| --------------- | ---------------------------------- | -------------------------------------- |
| `--shadow-sm`   | `0 1px 2px 0 rgb(0 0 0 / 0.5)`     | Buttons, Inputs.                       |
| `--shadow-md`   | `0 4px 6px -1px rgb(0 0 0 / 0.5)`  | Dropdowns, Hover states.               |
| `--shadow-glow` | `0 0 15px rgba(16, 185, 129, 0.3)` | **Active/Brand** elements (Teal Glow). |

## Borders as Elevation

in ultra-dark interfaces, shadows can disappear. We use **1px Borders** to reinforce separation.

- **Default Border**: `1px solid --color-border-default` (#2A2A2A). Used on Cards.
- **Active Border**: `1px solid --color-teal-500` (#10B981). Used on Focus/Active states.

## Z-Index Scale

- **Dropdowns**: 100
- **Sticky Headers**: 500
- **Modals/Overlays**: 1000
- **Tooltips**: 1500

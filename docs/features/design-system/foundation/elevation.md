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

## Normalized Shadow Tokens

To prevent drift between product surfaces and shared UI utilities, normalize on the shared shadow scale
used by `packages/shared/src/styles/motion-shadows.css`. Map localized shadow tokens to this scale:

| Shared Token  | Recommended Usage                     | Notes |
| ------------ | ------------------------------------- | ----- |
| `--shadow-1` | Inputs, buttons, small cards          | Subtle elevation. |
| `--shadow-2` | Hover states, dropdowns, menus        | Default hover lift. |
| `--shadow-3` | Drawers, modals, floating panels      | Use sparingly. |
| `--shadow-4` | Hero overlays or high-emphasis states | Avoid stacking. |

## Borders as Elevation

in ultra-dark interfaces, shadows can disappear. We use **1px Borders** to reinforce separation.

- **Default Border**: `1px solid --color-border-default` (#2A2A2A). Used on Cards.
- **Active Border**: `1px solid --color-teal-500` (#10B981). Used on Focus/Active states.

## Z-Index Scale

- **Dropdowns**: 100
- **Sticky Headers**: 500
- **Modals/Overlays**: 1000
- **Tooltips**: 1500

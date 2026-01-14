# Color Palette

Valynt uses a **Dark-First** color system designed to minimize eye strain and convey a premium, data-centric aesthetic. Our primary accent is **Teal**, representing growth and precision.

## Surfaces (Dark Mode)

Our UI is built on layers of dark grey, not pure black, to allow for depth perception via shadows and contrast.

| Token               | Value (HSL)     | Hex       | Usage                                               |
| ------------------- | --------------- | --------- | --------------------------------------------------- |
| `--color-surface-1` | `230, 10%, 4%`  | `#0B0C0F` | **Main Background**. The deepest layer (body).      |
| `--color-surface-2` | `230, 12%, 9%`  | `#13141A` | **Cards & Sidebar**. The primary component surface. |
| `--color-surface-3` | `230, 12%, 12%` | `#1A1C24` | **Elevated**. Popovers, dropdowns, and modals.      |

## Brand Accents

| Token              | Value (HSL)     | Hex       | Usage                                                       |
| ------------------ | --------------- | --------- | ----------------------------------------------------------- |
| `--color-teal-500` | `169, 70%, 43%` | `#10B981` | **Primary Brand**. Actions, success states, active borders. |
| `--color-teal-400` | `170, 77%, 51%` | `#34D399` | **Highlight**. Hover states, info indicators.               |

## Semantic Colors

| Role             | Token                  | Usage                                              |
| ---------------- | ---------------------- | -------------------------------------------------- |
| **Action**       | `--color-action`       | Primary buttons, links, active tab indicators.     |
| **Success**      | `--color-success`      | Positive trends, "Complete" status.                |
| **Warning**      | `--color-warning`      | "Needs Attention" thresholds, alerts.              |
| **Error**        | `--color-error`        | Critical failures, destructive actions.            |
| **Text Primary** | `--color-text-primary` | Main headings and body text.                       |
| **Text Muted**   | `--color-text-muted`   | Secondary labels, descriptions, deactivated items. |

## Implementation Rules

- **Never use hex codes directly**. Always use CSS variables or Tailwind utility classes (e.g., `bg-surface-1`, `text-primary`).
- **Teal is precious**. Do not overuse the primary accent. Use it to guide attention, not to decorate.

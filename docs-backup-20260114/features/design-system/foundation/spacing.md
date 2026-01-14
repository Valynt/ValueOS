# Spacing System

Valynt utilizes an **8px Linear Scale** (`0.5rem`). This grid ensures consistent rhythm and alignment across the platform.

## The 8px Grid

All spacing values (margins, paddings, gaps, heights) are multiples of **8px**.

| Token       | Value (rem) | Value (px) | Usage                                          |
| ----------- | ----------- | ---------- | ---------------------------------------------- |
| `--space-1` | `0.5rem`    | `8px`      | **Atomic Unit**. Tight grouping (icon + text). |
| `--space-2` | `1rem`      | `16px`     | Standard Padding (Buttons, Inputs, Cards).     |
| `--space-3` | `1.5rem`    | `24px`     | Section separation inside cards.               |
| `--space-4` | `2rem`      | `32px`     | Major component separation.                    |
| `--space-6` | `3rem`      | `48px`     | Layout sectioning.                             |
| `--space-8` | `4rem`      | `64px`     | Page-level spacing.                            |

## Layout Guidelines

### Containers

- **Dashboard Full**: `100vw` / `100vh` (No max width).
- **Content Max Width**: `1200px` for centered documents/forms.

### Component Spacing

- **Internal Padding**: Use `--space-2` (16px) for standard cards.
- **Form Gaps**: Use `--space-2` (16px) between stacked inputs.
- **Button Groups**: Use `--space-1` (8px) between buttons.

### Touch Targets

Ensure all interactive elements have a minimum touch target or visual height of **44px** (closest token is often a mix of padding + line-height or explicit height of `3rem`/48px).

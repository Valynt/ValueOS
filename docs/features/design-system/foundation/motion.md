# Motion

Motion should feel restrained and intentional. Use the shared motion tokens to keep
transitions consistent across ValueOS surfaces.

## Motion Tokens

These tokens are defined in `packages/shared/src/styles/motion-shadows.css` and are the
canonical values for motion timing and easing.

| Token                     | Value                               | Usage |
| ------------------------- | ----------------------------------- | ----- |
| `--motion-duration-micro` | `100ms`                              | Tap/press feedback. |
| `--motion-duration-standard` | `200ms`                           | Hover, input focus, small reveals. |
| `--motion-duration-page`  | `500ms`                              | Page transitions, large panels. |
| `--motion-ease-standard`  | `ease-out`                           | Default ease for UI elements. |
| `--motion-ease-emphasized`| `ease-in-out`                        | Emphasized transitions. |
| `--motion-ease-decelerate`| `cubic-bezier(0, 0, 0.2, 1)`         | Entering surfaces. |

## Guidelines

1. **Respect reduced motion**: Prefer CSS that honors `prefers-reduced-motion`.
2. **Keep feedback immediate**: Use `--motion-duration-micro` for click/tap feedback.
3. **Avoid stacking long transitions**: Use `--motion-duration-page` only once per interaction flow.

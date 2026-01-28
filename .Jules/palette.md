## 2024-05-23 - Icon Button Loading States
**Learning:** For fixed-size icon buttons (like `size="icon"`), appending a loading spinner causes layout shifts or overflow.
**Action:** When `loading` is true for icon buttons, replace the child icon with the spinner instead of appending it.

## 2024-05-24 - Loading State Consistency
**Learning:** Custom implementations of loading text (e.g., "Sending...") often miss the visual spinner provided by the design system's `Button` component.
**Action:** Always check if `Button` supports a `loading` prop and use it to ensure consistent spinner behavior alongside text updates.

## 2026-01-28 - Password Visibility Toggle
**Learning:** Raw input fields are often used for passwords to avoid complexity, missing standard accessibility features like visibility toggles and proper ARIA labels.
**Action:** Use the `PasswordInput` component which encapsulates the toggle logic and accessibility attributes, while supporting custom styling via `className`.

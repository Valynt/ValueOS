## 2024-05-23 - Icon Button Loading States
**Learning:** For fixed-size icon buttons (like `size="icon"`), appending a loading spinner causes layout shifts or overflow.
**Action:** When `loading` is true for icon buttons, replace the child icon with the spinner instead of appending it.

## 2024-05-24 - Icon Button Accessibility
**Learning:** `size="icon"` buttons lack inherent accessibility labels, making them invisible to screen readers.
**Action:** Always add `aria-label` to the button and `aria-hidden="true"` to the inner icon for icon-only buttons.

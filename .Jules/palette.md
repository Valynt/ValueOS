## 2024-05-23 - Icon Button Loading States
**Learning:** For fixed-size icon buttons (like `size="icon"`), appending a loading spinner causes layout shifts or overflow.
**Action:** When `loading` is true for icon buttons, replace the child icon with the spinner instead of appending it.

## 2026-01-24 - Accessibility in Inputs
**Learning:** Decorative icons in inputs (like search icons) need `aria-hidden="true"` to avoid confusing screen readers, and interactive icon-only buttons (like clear) need `aria-label`. Also, `aria-invalid` should only be present when true to keep the accessibility tree clean.
**Action:** Always audit `Input` and `SearchInput` components for these attributes and ensure `aria-invalid` is conditionally rendered as `undefined` when false.

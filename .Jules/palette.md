## 2024-05-23 - Icon Button Loading States
**Learning:** For fixed-size icon buttons (like `size="icon"`), appending a loading spinner causes layout shifts or overflow.
**Action:** When `loading` is true for icon buttons, replace the child icon with the spinner instead of appending it.

## 2026-01-23 - Accessible Inputs & Search
**Learning:** Decorative icons (like search magnifying glasses) inside inputs must be explicitly hidden (`aria-hidden="true"`) to avoid confusing screen readers, while interactive elements (like clear buttons) must have descriptive `aria-label`s.
**Action:** Always verify `aria-hidden` on decorative icons and `aria-label` on icon-only buttons within composite input components.

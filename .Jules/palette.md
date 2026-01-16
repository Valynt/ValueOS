## 2025-05-22 - Icon-only Buttons Need Labels
**Learning:** Icon-only buttons (like "Copy" or "Share") are often implemented with just an icon component, missing the `aria-label` required for screen reader users to understand the button's purpose. The `size="icon"` prop provides visual styling but does not enforce accessibility.
**Action:** When using `size="icon"` or icon-only buttons, always ensure an `aria-label` is present. Also add `aria-hidden="true"` to the icon itself to prevent redundant announcements.

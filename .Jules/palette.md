## 2024-05-23 - Icon Button Loading States
**Learning:** For fixed-size icon buttons (like `size="icon"`), appending a loading spinner causes layout shifts or overflow.
**Action:** When `loading` is true for icon buttons, replace the child icon with the spinner instead of appending it.

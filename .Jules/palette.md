# Palette's Journal

## 2024-05-20 - CitationTooltip Accessibility
**Learning:** `CitationTooltip` uses a `button` for the tooltip trigger but lacks proper ARIA attributes to indicate it controls a popup (the tooltip).
**Action:** Add `aria-expanded` and `aria-haspopup="dialog"` or similar to the trigger button.

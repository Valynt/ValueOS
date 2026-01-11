# Palette's Journal

## 2024-05-20 - CitationTooltip Accessibility
**Learning:** `CitationTooltip` uses a `button` for the tooltip trigger but lacks proper ARIA attributes to indicate it controls a popup (the tooltip).
**Action:** Add `aria-expanded` and `aria-haspopup="dialog"` or similar to the trigger button.

## 2024-05-24 - Async Button States
**Learning:** Buttons that trigger long-running processes (like "Generate Business Case") are often hidden or lack feedback, confusing users about whether the action is progressing or if they can cancel/retry.
**Action:** Instead of hiding the button, disable it and show a loading spinner with "Drafting..." text. Persist the button after completion to allow re-runs.

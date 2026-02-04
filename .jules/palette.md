## 2026-02-04 - Native Search Inputs vs Custom UI
**Learning:** Browsers like Chrome add a native clear button (`x`) to `input[type="search"]` which clashes with custom clear buttons in design systems, causing double controls.
**Action:** When using `type="search"` with custom clear actions, always apply `[&::-webkit-search-cancel-button]:hidden` (or equivalent CSS) to the input.

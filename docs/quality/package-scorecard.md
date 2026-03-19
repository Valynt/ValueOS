# Package Quality Scorecard

Generated from `.quality/package-scorecard.config.json` and `.quality/package-scorecard-baselines.json`.

## Summary

- Packages tracked: 6
- Regressions: 0
- High-priority ratchets: packages/backend, packages/sdui, packages/mcp

## Budget table

| Package | Priority | Any | TS errors | ESLint warnings | TODO/FIXME | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| apps/ValyntApp | medium | 6 (base 6, 0) | 945 (base 945, 0) | 773 (base 773, 0) | 5 (base 5, 0) | 122 (base 122, 0) | ✅ within budget |
| packages/backend | high | 41 (base 41, 0) | 1329 (base 1329, 0) | 2473 (base 2473, 0) | 2 (base 2, 0) | 537 (base 537, 0) | ✅ within budget |
| packages/sdui | high | 12 (base 12, 0) | 0 (base 0, 0) | 967 (base 967, 0) | 0 (base 0, 0) | 28 (base 28, 0) | ✅ within budget |
| packages/mcp | high | 123 (base 123, 0) | 0 (base 0, 0) | 1349 (base 1349, 0) | 0 (base 0, 0) | 7 (base 7, 0) | ✅ within budget |
| packages/infra | medium | 21 (base 21, 0) | 0 (base 0, 0) | 56 (base 56, 0) | 0 (base 0, 0) | 4 (base 4, 0) | ✅ within budget |
| packages/components | medium | 31 (base 31, 0) | 3 (base 3, 0) | 207 (base 207, 0) | 0 (base 0, 0) | 9 (base 9, 0) | ✅ within budget |

## Ratchet focus

- **packages/backend**: current any count is 41. Next target is 35.
- **packages/sdui**: current any count is 12. Next target is 10.
- **packages/mcp**: current any count is 123. Next target is 110.

## CI artifact locations

- `artifacts/package-quality/scorecard.json`
- `artifacts/package-quality/scorecard.md`

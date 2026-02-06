# Quality baselines

This directory stores repo-level ratchet baselines used by CI quality checks.

- `baselines.json`
  - `tsErrors`: max allowed TypeScript error count (`current <= baseline`)
  - `coverage.linesPct`: minimum allowed line coverage (`current >= baseline`)
  - `todoFixme.strictZones`: max TODO/FIXME count in strict zones (`current <= baseline`)

Update baselines only in dedicated debt-management PRs after intentional quality wins/losses.

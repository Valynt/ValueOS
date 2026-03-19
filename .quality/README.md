# Quality baselines

This directory stores CI ratchets and per-package scorecards used by quality checks.

- `baselines.json`
  - Legacy repo-wide baselines for coarse aggregate checks.
- `package-scorecard.config.json`
  - Package definitions, production paths, and ratchet priorities for the package quality scorecard.
- `package-scorecard-baselines.json`
  - Baselines for per-package budgets. CI fails on net-new regressions for `any`, TypeScript errors, ESLint warnings, TODO/FIXME comments in production paths, and test counts.

Regenerate the package scorecard baselines and docs with:

```bash
pnpm run quality:scorecard -- --write-baseline --json-out artifacts/package-quality/scorecard.json --md-out artifacts/package-quality/scorecard.md --docs-out docs/quality/package-scorecard.md
```

Update baselines only in dedicated debt-management PRs after intentional quality wins or approved debt changes.

# mcp-dashboard (experimental)

## Lifecycle policy

- **Classification:** `valueos.classification=experimental`.
- **Release posture:** excluded from release automation (`valueos.ci.release.status=excluded`).
- **Root CI posture:** excluded from root Vitest (`valueos.ci.rootVitest.status=excluded`) until debt baseline is reduced.
- **Debt baseline owner:** `team-ai-platform` owns the baseline and promotion plan.
- **Build behavior:** `build` is intentionally disabled for release contexts and fails fast; use `build:disabled` only for explicit no-op governance checks.

Promotion to active/release-eligible status requires updating `config/ci/workspace-package-policy.json` and `apps/mcp-dashboard/package.json` together, then re-enabling root Vitest/release coverage intentionally.

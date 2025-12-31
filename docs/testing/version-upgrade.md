# Version Upgrade Plan for Test & CI Dependencies

This plan outlines how to upgrade testing and CI-related dependencies in a safe, reproducible way.

1. Strategy

- Use Dependabot to propose patch & minor updates, review and merge automatically after CI passes.
- Major upgrades require a canary branch + full test matrix and a security review.

2. Pre-upgrade checks

- Confirm no blocked PRs or active patches rely on the current major version.
- Update `CHANGELOG` or release notes for overarching changes.

3. Upgrade steps

- Run unit & lint tests locally after bumping versions.
- Run integration suite with testcontainers or Supabase test CLI.
- Run full E2E Playwright suite (or targeted smoke) prior to full release.
- Run security scanning (npm audit, Snyk).

4. CI considerations

- Use a canary PR to run the entire CI matrix.
- Add `--dry-run` flags or local smoke runs before merging.
- Pin working versions and protect PR approvals if upgrading major versions.

5. Rollbacks

- If a major failure occurs, revert the PR and reintroduce the old version with a patch release.
- Notify QA to run regression tests and record the failing scenario.

6. Patching timeline

- Minor/patch: weekly (Dependabot auto-merge if tests pass).
- Major: schedule and coordinate across teams; require 48-hour staging verification.

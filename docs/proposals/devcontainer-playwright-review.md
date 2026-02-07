# Draft: DevContainer Playwright + Subagents (for review)

This draft PR collects the recent devcontainer improvements for review and discussion. It is intentionally small (docs-only) so reviewers can comment on the design and testing plan without being blocked by CI diffs (the implementation changes are already present in the repository).

## Summary of implemented changes
- Added subagents for parallel dev tasks: `subagent-installer`, `subagent-lint`, `subagent-test`, `subagent-playwright` in `.devcontainer/docker-compose.subagents.yml`.
- Added helper scripts: `.devcontainer/scripts/{install-optional-tools.sh, install-playwright-deps.sh, start-subagents.sh, wait-subagents.sh}`.
- Conditional Playwright OS deps arg in `.devcontainer/Dockerfile.dev` (`INSTALL_PLAYWRIGHT_DEPS=1`).
- `postCreateCommand` in `.devcontainer/devcontainer.json` will optionally run Playwright install if `INSTALL_PLAYWRIGHT_DEPS=1`.
- Added a sharding helper script `scripts/test/run-vitest-shard.sh` and a Playwright subagent test script.
- Added integration tests to assert presence of compose entries and README docs.
- Added CI workflow `.github/workflows/devcontainer-playwright-verify.yml` to verify Playwright and run Vitest shard matrix.

## How to review/test locally
1. Reopen the repo in a DevContainer and run:
   - `pnpm run dev:subagents:up` (detached, runs installer/lint/test/playwright)
   - `docker compose -f .devcontainer/docker-compose.devcontainer.yml -f .devcontainer/docker-compose.subagents.yml logs -f subagent-playwright`
2. For headed browser testing:
   - `make build-playwright-image`
   - Open in container image and run `pnpm playwright install --with-deps` and `pnpm playwright test --headed --project=chromium`
3. Run a Vitest shard locally:
   - `SHARD_COUNT=2 SHARD_INDEX=0 pnpm run test:shard`

## Notes & Discussion
- The Dockerfile policy and security constraints (non-root `USER`, seccomp profile) have been maintained.
- Husky hooks may fail on CI/automation runners that do not have `pnpm` installed; the automation uses `--no-verify` when needed.

Please review for correctness, security implications, and CI runtime impact.


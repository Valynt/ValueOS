# CI Runbook: Test Execution & Best Practices

This runbook documents the CI testing process and introduces checks to keep test quality high.

CI pipeline entry point:

- Standard workflow runs `pnpm run ci:verify`.
- The command executes checks in this order: lint → typecheck → test → build.
- Additional CI-only checks (legacy route validation, docs path linting, typecheck telemetry) are included inside `ci:verify`.

Detailed test stages (within or adjacent to `ci:verify`):

1. Lint: `pnpm run lint` — fail fast on style & console usage
2. Typecheck: `pnpm run typecheck:islands` + telemetry — TypeScript type correctness
3. Tests: `pnpm run test` — unit + integration through Turbo
4. Build: `pnpm run build` — production build validation
5. RLS: `pnpm run test:rls` — Supabase policy enforcement checks
6. E2E: `pnpm run test:smoke` — Playwright runs on the running app

Architecture & operational notes:

- Runs-on: `ubuntu-latest`
- Integration runner uses GitHub Actions services: Postgres 15 & Redis 7
- Use `$GITHUB_ENV` to set `DATABASE_URL` and `REDIS_URL`
- RLS tests run against a local, ephemeral Supabase stack started via `pnpm supabase start`
- No production keys are required; the CLI supplies local anon/service keys
- CI sets `SUPABASE_DB_PASSWORD=postgres` to align with the default local stack credentials
- Upload artifacts from integration & E2E runs into `test-results/` and `playwright-report/`
- Retention: 14–30 days based on artifact size and workflow cost

Failure handling:

- Unit tests failing blocks the PR immediately.
- Integration tests failing triggers log capture and supabase RLS command-run checks.
- E2E failing triggers application and environment logs capture.

Best practices:

- Keep unit tests fast and deterministic.
- Isolate integration tests with unique fixtures and cleanup.
- Use `supabase test db` when verifying RLS in migration slots.
- Run `npx playwright install --with-deps` before Playwright invocation.
- Limit the Playwright scope in PR pipelines (once `main` merges, run full suite nightly).

# CI Runbook: Test Execution & Best Practices

This runbook documents the CI testing process and introduces checks to keep test quality high.

CI test stages:

1. Lint: `pnpm run lint` — fail fast on style & console usage
2. Typecheck: `pnpm run typecheck` — TypeScript type correctness
3. Unit: `pnpm run test:unit` — Quick feedback; must pass before other stages
4. Integration: `pnpm run test:integration` — Postgres/Redis/Message bus checks; uses services
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

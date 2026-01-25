# Testing & Engineering Standards for ValueOS

This document lists recommended, mature standards aligned to our stack and compliance needs. Use this as the source-of-truth for CI, QA, and dev practices.

1. Test Pyramid (priority)

- Unit tests: 70%+ of tests. Fast, pure logic, mocks.
- Integration tests: 20% of tests. Use testcontainers or the Supabase test CLI when verifying RLS and DB behavior.
- E2E tests: 10% of tests. Playwright for critical user flows and orchestration.

2. Tools and Standards (stack-specific)

- Unit: Vitest (jsdom/node), mocking with `vi` and `msw` for network. Test runners: `vitest run --config vitest.config.unit.ts`.
- Integration: Vitest with `testcontainers` + `test/setup-integration.ts` using Postgres/Redis MS images or `supabase test db`. Tests: `vitest run --config vitest.config.integration.ts`.
- E2E: Playwright (`@playwright/test`) for browser/automation flows. CI: install browsers and run Playwright with `pnpm run test:e2e`.
- DB-as-a-service: Supabase (Postgres) — rely on `supabase` CLI for RLS and verification tests.
- Message Queue: Redis + BullMQ — test by running Redis service in integration tests (or testcontainers).
- Observability: OpenTelemetry & Prometheus compatible metrics; users must instrument long-running jobs and health checks.
- Security: RLS/Row-level security on Postgres; cryptographic primitives using Node built-ins or vetted libs; Zod for LLM outputs validation.

Note: Performance and timing assertions in tests should be environment-tolerant. CI runners and developer machines exhibit different CPU and I/O characteristics — avoid strict per-operation thresholds (e.g., <1ms). Use averaged durations, relaxed thresholds, and guardrails for noisy environments (e.g., CI headroom +2x).

3. CI Flow

- `lint` → `typecheck` → `test:unit` → `test:integration` → `test:e2e`.
- Use dedicated CI stages; fail fast on lint/typecheck.
- Integration stage: spin up Postgres & Redis services; set environment variables `DATABASE_URL` and `REDIS_URL`.
- E2E stage: bring up the app (docker compose) and run Playwright.

4. Test Isolation Best Practices

- Each test should use unique IDs and tear down created data. Use `uuid()` or `timestamp` suffixes.
- Avoid coupling unit tests to external services - use `msw` or mock Supabase. Reserve integration tests for real DB checks.
- Seed fixtures with unique markers and ensure cleanup in `afterAll`/`afterEach`.
- For RLS tests, prefer the `supabase test db` CLI when reproducible; otherwise use the `testcontainers` setup with the migration suite.

5. Version Upgrade & Maintenance

- Pin critical dependencies (`vitest`, `playwright`, `supabase`, `redis`) and use Dependabot for minor/patch updates.
- Schedule monthly upgrades; test with Canary PRs that run the full CI matrix.
- Maintain `scripts/check-coverage.cjs` to enforce coverage thresholds and document exceptions.

6. Reporting & Artifacts

- Upload test results and Playwright reports to CI artifacts. Keep 30-day retention.
- Generate coverage and store LCOV for further analysis.

7. Security & Compliance

- Sanitize credentials; do NOT store production secrets in CI.
- RLS: include tenant-scoped verification tests that assert `auth.jwt()` behavior and `auth.uid()` in DB.
- Agents: use `secureInvoke()` wrapper and Zod validators (already enforced by agent security policies).

8. How to get started locally

- Unit: `pnpm run test:unit`
- Integration: `pnpm run test:integration` (requires Docker or the supabase CLI)
- E2E: `pnpm run test:e2e` (requires application to be running; the CI uses a Compose definition to run the app)

9. Contact & Ownership

- `@value-os/qa` or team lead owns the standards and release cadence.

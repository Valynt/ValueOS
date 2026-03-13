# ADR 0016: CI Security Gate Model

- **Status:** Accepted
- **Date:** 2026-07-15
- **Context:**
  - ValueOS handles multi-tenant business data with strict isolation requirements. A security regression in CI (e.g., a query missing `organization_id`, a direct `service_role` use outside permitted callers, or a new `any` cast that bypasses type safety) can reach production undetected.
  - The existing CI pipeline ran unit tests and a lint pass but had no dedicated security validation layer. RLS policies were tested manually and infrequently.
  - The `spec-production-readiness.md` audit identified 13 skipped E2E tests, a TypeScript `any` count of 816, and no automated enforcement of the tenant isolation rules defined in `AGENTS.md`.

- **Decision:**
  - Add a dedicated security gate stage to `.github/workflows/ci.yml` that runs after unit tests and before deployment promotion. The gate comprises:
    1. **RLS policy tests** (`pnpm run test:rls`): validate that every tenant-scoped table enforces `organization_id` / `tenant_id` isolation at the database level using the `security.user_has_tenant_access` function.
    2. **Agent security suite** (`bash scripts/test-agent-security.sh`): validates that no agent calls `llmGateway.complete()` directly, that all memory queries include `tenant_id`, and that `service_role` usage is confined to `AuthService`, tenant provisioning, and cron jobs.
    3. **TypeScript `any` gate**: the CI coverage step enforces `--coverage.thresholds.lines=75 --coverage.thresholds.functions=70 --coverage.thresholds.branches=70`. The `any` count is tracked in `docs/debt/ts-any-dashboard.md` with a sprint target; the gate fails if the count regresses above the sprint baseline.
    4. **E2E critical path**: Playwright runs `tests/e2e/critical-*.spec.ts` and `tests/e2e/auth-*.spec.ts`. Waivers are tracked in `config/release-risk/release-1.0-skip-waivers.json` with owner and expiry; expired waivers fail the gate.
  - The ESLint config enforces structural rules at PR time (before CI): `no-restricted-imports` bans cross-tenant data paths, `no-restricted-syntax` bans direct `llmGateway.complete()` calls and `process.env` access outside `getEnvVar()`.

- **Consequences:**
  - Security regressions are caught at the PR stage (ESLint) or at the CI gate (RLS + agent security tests), not in production.
  - The waiver file (`release-1.0-skip-waivers.json`) makes skip decisions explicit, auditable, and expiry-enforced. Waivers without a valid owner or past their expiry date fail CI.
  - The `any` gate creates pressure to reduce the count over time but does not block PRs that hold the line — only regressions fail.
  - Adding a new tenant-scoped table requires a corresponding RLS test entry before the PR can merge.
  - The agent security suite must be updated when new agents are added or when the permitted `service_role` caller list changes.

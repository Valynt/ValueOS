# integration-supabase Required Matrix

Last updated: 2026-03-27.

This matrix defines the **minimum real-Supabase suites** that must pass in `.github/workflows/pr-fast.yml` `integration-supabase`.

## AUTH-04 — Minimum RLS merge-gate matrix

The following tests are mandatory because they validate tenant isolation, DB-level idempotency guards, and auth/RLS invariants that cannot be trusted with pure mocks:

1. `src/services/billing/__tests__/security/rls-policies.test.ts`
   - Asserts billing table RLS separation across tenants.
2. `src/services/billing/__tests__/resiliency/advisory-lock-idempotency.test.ts`
   - Asserts advisory-lock and duplicate-delivery safety in concurrent execution.

## BILLING-07 — Billing suites that require real Supabase in CI

The following billing suites are classified as **real DB required** and are run by `integration-supabase`:

1. `src/services/billing/__tests__/integration/subscription-lifecycle.test.ts`
2. `src/services/billing/__tests__/integration/quota-enforcement.test.ts`
3. `src/services/billing/__tests__/integration/metering-pipeline.test.ts`
4. `src/services/billing/__tests__/integration/webhook-events.test.ts`

## CI contract

- These suites run with:
  - `VALUEOS_TEST_REAL_INTEGRATION=true`
  - Supabase started via `supabase start`
  - `SUPABASE_URL=http://127.0.0.1:54321`
- Any edits to this matrix must be reflected in `.github/workflows/pr-fast.yml`.

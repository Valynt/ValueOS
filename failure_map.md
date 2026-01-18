# Failure Map - ValueOS Test Suite

**Date:** 2026-01-18
**Total Failed Files:** 367
**Total Passed Files:** 133
**Total Tests Failed:** 671

## Top Error Signatures

| Signature                                                           | Count (est) | Category   | Root Cause                                                                          |
| ------------------------------------------------------------------- | ----------- | ---------- | ----------------------------------------------------------------------------------- |
| `Failed to resolve import "./lib/database" from "src/bootstrap.ts"` | 50+         | Resolution | Missing `src/lib/database.ts` file.                                                 |
| `AssertionError: expected undefined to be defined`                  | 20+         | Smoke      | `App` component failing to import/init.                                             |
| `TypeError: ... .eq(...).eq is not a function`                      | 30+         | Logic      | Supabase client mock or library version inconsistency in `WorkflowStateRepository`. |
| `AssertionError: expected 403 to be 501`                            | 10+         | Security   | `secureRouter` or `RateLimitService` active in tests.                               |
| `ENOENT: ... /causal_truth_db.json`                                 | 15+         | Fixture    | Missing data file for `CausalTruthService`.                                         |
| `AssertionError: expected 401 to be 403`                            | 5+          | Security   | Permission vs Auth error mismatch.                                                  |
| `[Sentry Stub] Security audit write failed`                         | Global      | Harness    | `SecurityAuditService` failing due to missing mock setup or persistence.            |

## Top Failing Files

1. `src/__tests__/smoke.test.tsx` (Critical path)
2. `src/api/auth.test.ts` (Core Auth)
3. `src/services/__tests__/WorkflowStateService.integration.test.ts`
4. `src/services/__tests__/Billing-patches.test.ts`
5. `src/legacy-restored/services/__tests__/CausalTruthService.test.ts`

## Systemic Indicators

- **Module Resolution:** Broken internal paths after refactor (e.g., `./lib/database`).
- **Mock Regressions:** `WorkflowStateRepository` chain issues suggest `vi.fn()` mock returned objects that didn't support chaining properly.
- **Node vs JSDOM:** Many API tests running in Node environment now hitting security middleware that might be expecting browser-like headers or session state.
- **Environment:** `VITE_SUPABASE_URL` warnings suggest `.env.test` is not fully provisioned for all test environments.

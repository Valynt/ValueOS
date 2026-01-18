# Test Recovery Plan - ValueOS

## Swarm Assignments

### 1. Harness Engineer (Primary: Agent)

**Charter:** Fix top-level resolution, environment, and global mock issues.
**Tasks:**

- Resolve `src/lib/database` import error in `src/bootstrap.ts`.
- Fix the `WorkflowStateRepository` Supabase chaining issue (The `.eq().eq()` failure).
- Ensure `SecurityAuditService` doesn't block tests when it fails (or mock it correctly).
- **Target Files:** `src/bootstrap.ts`, `src/lib/database.ts` (create/fix), `test/setup.ts`.

### 2. Security & Auth Specialist

**Charter:** Resolve the 403 vs 501/401 logic shifts in API tests.
**Tasks:**

- Update `auth.test.ts` to handle `strict` router settings or bypass them in tests.
- Investigate `secureRouter.ts` for automated blocking of test agents.
- **Target Files:** `src/api/auth.test.ts`, `src/middleware/secureRouter.ts`.

### 3. ServiceSquad Alpha (Workflow & Storage)

**Charter:** Fix failures in Workflow and Repository layers.
**Tasks:**

- Fix `WorkflowStateService` integration tests.
- Address `Billing-patches` test failures.
- **Target Files:** `src/services/__tests__/WorkflowStateService.ts`, `src/services/__tests__/billing-patches.test.ts`.

### 4. Fixture & Data Specialist

**Charter:** Resolve ENOENT errors and missing data dependencies.
**Tasks:**

- Create mock data for `causal_truth_db.json`.
- Fix `WebScraperService` and `UsageTrackingService` failures.
- **Target Files:** `src/legacy-restored/services/__tests__/CausalTruthService.test.ts`.

## Burn Down Table

| Date       | Failed Files | Failed Tests | Status   |
| ---------- | ------------ | ------------ | -------- |
| 2026-01-18 | 367          | 671          | Baseline |

## Priorities

1. **Critical Path:** Smoke tests and `bootstrap` (Phase 1).
2. **Core Auth:** Get `auth.test.ts` to green.
3. **Repository Chaining:** Fix the systemic Supabase mock issue.

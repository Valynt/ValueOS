# Spec: Address Test Suite Failures

## Problem Statement

The workspace test suite has ~1,194 failing tests across 6 packages. Failures fall into distinct, diagnosable root causes — not widespread logic bugs. This spec covers all of them.

---

## Packages in Scope

| Package | Failing Tests | Root Cause Category |
|---|---|---|
| `@valueos/backend` | 1,174 | Module-load Supabase guard (99 suites) + mock mismatches + contract drift |
| `mcp-ground-truth` | 9 | API contract drift + missing env var in test setup |
| `@valueos/components` | 5 | Tests assert against stale text/aria-labels |
| `@valueos/shared` | 3 | Missing export + error message regex mismatch |
| `domain-validator` | 0 tests run | Package not in pnpm workspace → deps not linked |
| `@valueos/infra` | 1 suite fails to load | Missing `@valueos/shared` alias in root vitest config |

---

## Requirements

### 1. `@valueos/backend` — Lazy-init Supabase in `ComplianceControlStatusService`

**Root cause:** `ComplianceControlStatusService` declares `private readonly supabase = createServerSupabaseClient()` as a class field initializer. This runs at `new ComplianceControlStatusService()` time, which happens when the module-level singleton `complianceControlStatusService` is created at line 425. Any test that imports from `src/services/security/index.ts` (directly or transitively) triggers this, hitting `assertRealSupabaseAllowed()` and throwing before any test runs.

**Fix:** Change the field initializer to lazy initialization — only call `createServerSupabaseClient()` on first use.

```typescript
// Before
private readonly supabase = createServerSupabaseClient();

// After
private _supabase: ServiceRoleSupabaseClient | undefined;
private get supabase(): ServiceRoleSupabaseClient {
  if (!this._supabase) this._supabase = createServerSupabaseClient();
  return this._supabase;
}
```

**Acceptance criteria:**
- Running any backend test that previously failed with `"Unexpected Supabase client creation during tests (createServerSupabaseClient)"` no longer throws at suite collection time.
- The 99 previously-blocked suites now collect and run.

---

### 2. `@valueos/backend` — Triage remaining ~156 failing files

After the lazy-init fix, re-run the backend suite and categorize remaining failures. Fix the following clear-cut categories:

**2a. Mock export mismatches — `createLogger` not in mock factory**

Several tests mock `lib/logger.js` with only `{ logger: { ... } }` but the module under test also calls `createLogger(...)`. The mock factory must include `createLogger`.

Affected files include:
- `src/services/security/__tests__/audit-logger-server-side-delivery.unit.test.ts`
- `src/services/__tests__/EventConsumer.test.ts`
- Any other file with `[vitest] No "createLogger" export is defined on the "...logger" mock`

**Fix:** Add `createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))` to each affected mock factory.

**2b. Mock export mismatches — `createServiceRoleSupabaseClient` not in mock factory**

Two test files mock `@shared/lib/supabase.js` but omit `createServiceRoleSupabaseClient`.

**Fix:** Add the missing export to the mock factory in each affected file.

**2c. Contract drift — remaining failures after the above**

After fixing 2a and 2b, re-run and assess. Fix any remaining failures where the fix is unambiguous (wrong assertion value, renamed method, etc.). Document any failures that require deeper investigation as known issues rather than leaving them silently broken.

**Acceptance criteria:**
- All `[vitest] No "X" export is defined on the "Y" mock` errors are resolved.
- Net failing test count in `@valueos/backend` is materially reduced from 1,174.

---

### 3. `mcp-ground-truth` — Two distinct fixes

**3a. `GroundTruthIntegrationService.ingestSECData` — update tests to new contract**

The implementation was changed to return a `SECIngestionAggregateResult` object (with fields `cik`, `period`, `tenantId`, `metricsRequested`, `metricsPersisted`, `metricFailures`, `success`) instead of a `ModuleResponse[]` array. The tests in `services/__tests__/GroundTruthIntegrationService.test.ts` still assert the old array contract.

**Fix:** Update the 4 failing tests to assert against the new object shape:
- Empty metrics → `{ success: true, metricsRequested: [], metricsPersisted: [], metricFailures: [] }`
- All succeed → `success: true`, `metricsPersisted.length === metrics.length`
- Partial failure → `success: false`, `metricFailures` contains the failed metric
- Non-Error throw → `success: false`, `metricFailures[0].error` contains the string

**3b. `WebSocketServer.validateAuthToken` — fix env var name in test setup**

The test sets `process.env.WS_AUTH_JWT_SECRET` but `WebSocketServer.validateAuthToken()` reads `process.env.SUPABASE_JWT_SECRET ?? process.env.JWT_SECRET`. When neither is set, the method logs a warning and returns `null` instead of validating.

**Fix:** In `WebSocketServer.test.ts` `beforeEach`, also set `process.env.SUPABASE_JWT_SECRET` to the test signing key, and clear it in `afterEach`. The `jwtVerifyMock` is already set up to control outcomes.

**3c. `MCPServer.security.test.ts` — fix invalid assignment syntax**

Lines 86 and 95 use `require("crypto") = undefined` which is an invalid assignment target in ESM/esbuild. This file fails to compile entirely.

**Fix:** Replace with `vi.mock("crypto", ...)` or use `vi.spyOn` to simulate the crypto failure, removing the invalid `require()` assignment.

**Acceptance criteria:**
- All 9 `mcp-ground-truth` failures resolved.
- `MCPServer.security.test.ts` compiles and runs.

---

### 4. `@valueos/components` — Fix tests to match current component behavior

**4a. `ConfidenceBadge` — threshold boundary**

The component uses `score >= 0.8` for "High". Score `0.75` is "Medium". The test at `it("includes aria-label with confidence info")` asserts `"Confidence: 75% - High confidence"` — this is wrong.

**Fix:** Change the assertion to `"Confidence: 75% - Medium confidence"`.

**4b. `ProvenancePanel` — text and aria-label drift**

The component renders:
- `<h2>Data Lineage</h2>` (not "Provenance")
- `aria-label="Close panel"` (not "Close provenance panel")

Three tests assert the stale strings.

**Fix:** Update the three failing tests:
- `getByText("Provenance")` → `getByText("Data Lineage")`
- `getByLabelText("Close provenance panel")` → `getByLabelText("Close panel")`
- Loading/error state tests: verify they still render correctly with the updated selectors

**Acceptance criteria:**
- All 5 `@valueos/components` failures resolved with no component source changes.

---

### 5. `@valueos/shared` — Export and error message fixes

**5a. Missing export: `createRequestRlsSupabaseClient`**

The test imports `createRequestRlsSupabaseClient` from `./supabase` but the function does not exist in `packages/shared/src/lib/supabase.ts`. The existing equivalent is `createRequestSupabaseClient` (takes `{ accessToken }`) which has a different signature.

**Fix:** Add `createRequestRlsSupabaseClient` as a named export that accepts `{ headers: { authorization?: string } }`, extracts the bearer token, throws with message matching `/will not fall back to anon or service-role credentials/` when no valid token is present, and delegates to `createRequestSupabaseClient` when a token is found.

**5b. Error message regex mismatch**

Test expects: `/service role key is required for elevated server-side operations/`
Actual message: `"Supabase service role key is required for server-side operations"`

**Fix:** Update the error message in `createServiceRoleSupabaseClient()` to: `"Supabase service role key is required for elevated server-side operations"`.

**Acceptance criteria:**
- All 3 `@valueos/shared` failures resolved.

---

### 6. `domain-validator` — Add to pnpm workspace

**Root cause:** `packages/services/domain-validator` is not matched by the `"packages/*"` glob in `pnpm-workspace.yaml` because it is nested one level deeper under `packages/services/`. As a result, `winston` and `supertest` are declared as dependencies but never linked into the package's `node_modules`.

**Fix:** Add `"packages/services/*"` to `pnpm-workspace.yaml`, then run `pnpm install` to link the dependencies.

**Acceptance criteria:**
- `pnpm --filter @valuecanvas/domain-validator vitest run` collects and runs all 3 test files without import errors.

---

### 7. `@valueos/infra` — Add `@valueos/shared` alias to root vitest config

**Root cause:** The root `vitest.config.ts` defines the `infra` project inline without a `resolve.alias` block. The package-local `packages/infra/vitest.config.ts` has the alias, but the root workspace runner uses its own inline definition which lacks it. `packages/infra/eso/sec/index.ts` imports `@valueos/shared` which cannot be resolved.

**Fix:** Add a `resolve.alias` block to the `"packages/infra"` inline project definition in the root `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    "@valueos/shared": path.resolve(root, "packages/shared/src/index.ts"),
  },
},
```

**Acceptance criteria:**
- `pnpm vitest run --project infra` runs all 4 infra test files without `ERR_MODULE_NOT_FOUND` for `@valueos/shared`.

---

## Implementation Order

1. **`@valueos/infra`** — root vitest config alias (1 file, unblocks infra suite immediately)
2. **`domain-validator`** — add `packages/services/*` to pnpm-workspace.yaml + `pnpm install`
3. **`@valueos/shared`** — add `createRequestRlsSupabaseClient` export + fix error message
4. **`@valueos/components`** — update ConfidenceBadge + ProvenancePanel tests
5. **`mcp-ground-truth`** — update ingestSECData tests + fix WebSocket env + fix MCPServer.security.test.ts
6. **`@valueos/backend`** — lazy-init `ComplianceControlStatusService` (highest-impact single change)
7. **`@valueos/backend`** — re-run suite, fix all `createLogger` and `createServiceRoleSupabaseClient` mock mismatches
8. **`@valueos/backend`** — re-run suite, triage and fix remaining clear-cut failures
9. **Verify** — run full workspace `pnpm test` and confirm net improvement

---

## Out of Scope

- `@valueos/sdui` `AccessibilityCompliance.test.tsx` jsdom collection failure (affects valynt-app too — separate investigation needed)
- `@valueos/sdui` `performance.benchmark.test.ts` flaky timing assertion
- `@valueos/backend` failures that require deeper investigation after triage in step 8
- `auth_leaked_password_protection` and `extension_in_public` Supabase linter warnings (project-level settings, not fixable via migration)

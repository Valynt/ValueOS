# Spec: ModelStage API Completion + E2E Test Harness

## Problem Statement

Three gaps block the Model Creation MVP from being production-ready:

1. **`backHalf.ts` has a syntax error** (unterminated template literal at line 254) that causes 10 TypeScript parse errors and makes 9 tests fail at transform time. This is a blocking bug.

2. **Two route handlers are stubs** in `packages/backend/src/api/valueCases/index.ts`:
   - `generateScenarios` (POST `/:caseId/scenarios`) — computes scenario multipliers but never calls the Economic Kernel and never persists to `financial_model_snapshots`.
   - `updateAssumption` (PATCH `/:caseId/assumptions/:assumptionId`) — validates the body but has a `TODO: Persist assumption change to database` comment and returns a fake response.

3. **No E2E test harness exists** for the full model-creation flow (create case → financial model → scenarios → assumption edit → integrity check).

---

## Requirements

### R1 — Fix `backHalf.ts` syntax error

**File:** `packages/backend/src/api/valueCases/backHalf.ts`

Line 254 opens a template literal with a backtick but closes it with a double-quote:
```typescript
// BROKEN (line 254):
`${hardBlockResult.soft_warnings.length} warning(s) detected. These do not block advancement but should be reviewed."

// FIXED:
`${hardBlockResult.soft_warnings.length} warning(s) detected. These do not block advancement but should be reviewed.`
```

**Acceptance criteria:**
- `tsc --noEmit` on `packages/backend` produces zero errors in `backHalf.ts`
- All 9 previously-failing `backHalf.test.ts` and `backHalf.pdf-ssrf.test.ts` tests pass

---

### R2 — Fix `backHalf.test.ts` supabase mock

**File:** `packages/backend/src/api/valueCases/__tests__/backHalf.test.ts`

The mock at line 107 exports `createServerSupabaseClient` but `backHalf.ts` does not import from `lib/supabase` — it uses `req.supabase` (injected by middleware). The mock is unnecessary but the import chain (`billing/PriceVersionService`, `billing/EntitlementSnapshotService`) pulls in `lib/supabase` and expects a `supabase` named export. Fix: add `supabase: { from: vi.fn() }` to the existing mock, or use `importOriginal` to spread the real module.

**Acceptance criteria:**
- All 5 `backHalf.test.ts` tests pass

---

### R3 — Complete `generateScenarios` handler

**File:** `packages/backend/src/api/valueCases/index.ts`, function `generateScenarios`

**Current state:** Computes scenario assumption multipliers in memory but returns them without calling the Economic Kernel and without persisting to `financial_model_snapshots`.

**Required behaviour:**

The handler must support a `mode` field (`"manual" | "rerun" | "both"`, default `"manual"`):

#### `mode: "manual"` (or omitted)
1. Parse `ScenarioRequestSchema` body (already exists).
2. For each scenario (`conservative`, `base`, `upside`), apply multipliers to `baseAssumptions` using `Decimal.js`.
3. Derive cash flows from the adjusted assumptions: use an optional `cashFlows` array from the body if provided; otherwise synthesise period-0 outflow as the negated sum of all assumption values and period-1 inflow as the sum.
4. Call `calculateNPV`, `calculateIRR`, `calculateROI`, `calculatePayback` from `domain/economic-kernel/economic_kernel.ts` for each scenario.
5. Persist a new snapshot via `FinancialModelSnapshotRepository.createSnapshot()` with:
   - `scenarios` jsonb: `[{ scenario: "conservative"|"base"|"upside", npv, irr, roi, payback_months, assumptions }]`
   - `assumptions_json`: the base assumptions array
   - `outputs_json`: `{ scenarios, mode: "manual", generatedAt }`
   - `roi`, `npv`, `payback_period_months`: from the `base` scenario
6. Return `{ data: { snapshotId, scenarios, source: "manual", generatedAt }, requestId }`.

#### `mode: "rerun"`
1. Log intent and return `{ data: { snapshotId: null, agentRunId: <uuid>, source: "agent", status: "running" }, requestId }` immediately. Full agent dispatch is deferred to a future sprint.

#### `mode: "both"`
1. Persist manual scenarios immediately (same as `manual`).
2. Log rerun intent (stub — no actual agent dispatch).
3. Return the manual snapshot result with `agentRunId` included.

**Schema addition** to `ScenarioRequestSchema` in `types.ts`:
```typescript
mode: z.enum(["manual", "rerun", "both"]).default("manual").optional(),
cashFlows: z.array(CashFlowInputSchema).optional(),
```

**Acceptance criteria:**
- `POST /cases/:caseId/scenarios` with `mode: "manual"` returns `snapshotId` (UUID), `scenarios` array with `npv`/`irr`/`roi`/`payback_months` for all three scenario types, and `source: "manual"`.
- NPV values are Decimal-precision strings (not floats).
- A new row appears in `financial_model_snapshots` with `snapshot_version` incremented.
- `mode: "rerun"` returns `status: "running"` and a non-null `agentRunId`.
- Tenant isolation: `organization_id` always set from `authReq.tenantId`.
- Invalid body returns HTTP 400 with `VALIDATION_ERROR`.

---

### R4 — Complete `updateAssumption` handler

**File:** `packages/backend/src/api/valueCases/index.ts`, function `updateAssumption`

**Current state:** Validates body, returns a fake response without touching the database.

**Required behaviour:**

1. Fetch the latest snapshot via `FinancialModelSnapshotRepository.getLatestSnapshotForCase(caseId, organizationId)`.
2. If no snapshot exists → HTTP 404 `{ error: "NO_SNAPSHOT", message: "No financial model snapshot found. Run the financial model first." }`.
3. Find the assumption by `assumptionId` in `snapshot.assumptions_json`. If not found → HTTP 404 `{ error: "ASSUMPTION_NOT_FOUND" }`.
4. Merge the update (`value`, `sensitivity_low`, `sensitivity_high`) into the assumption; increment its `version` field.
5. If `recalc: true` (default):
   - Re-derive cash flows from the updated assumptions array.
   - Recompute NPV/IRR/ROI/payback via Economic Kernel.
   - Persist a new snapshot version via `createSnapshot()` with updated `assumptions_json`, `roi`, `npv`, `payback_period_months`, and `outputs_json.recalc_triggered_by: assumptionId`.
   - Return `{ data: { assumption: updatedAssumption, recalculation: { snapshotId, npv, irr, roi, payback_months } } }`.
6. If `recalc: false`:
   - Persist new snapshot with updated `assumptions_json` only (no kernel call).
   - Return `{ data: { assumption: updatedAssumption, recalculation: null } }`.

**Acceptance criteria:**
- PATCH with valid `value` returns updated assumption with incremented `version`.
- When `recalc: true`, response includes `recalculation.snapshotId` (UUID) and `recalculation.npv` (string).
- When `recalc: false`, response includes `recalculation: null`.
- Missing snapshot → HTTP 404 `NO_SNAPSHOT`.
- Missing assumption → HTTP 404 `ASSUMPTION_NOT_FOUND`.
- Invalid body → HTTP 400.
- Tenant isolation enforced.

---

### R5 — E2E Test Harness

**File:** `tests/e2e/model-creation.test.ts`

**Runner:** Vitest (uses existing `vitest.e2e.config.ts`). Supertest for HTTP. Mocked LLM and Supabase. Economic Kernel runs real (no mock).

**Flow under test:**
```
1. POST /api/v1/cases                          → creates case, returns caseId
2. POST /api/v1/cases/:caseId/calculate        → Economic Kernel calculation
3. POST /api/v1/cases/:caseId/scenarios        → generates 3 scenarios, persists snapshot
4. PATCH /api/v1/cases/:caseId/assumptions/:id → updates assumption, triggers recalc
5. GET  /api/v1/cases/:caseId/model-snapshots/latest → returns latest snapshot
6. GET  /api/v1/cases/:caseId/integrity        → returns integrity output
```

**Test cases:**

| # | Name | Assertion |
|---|------|-----------|
| 1 | Full happy path | All 6 steps return 2xx; `snapshotId` from step 3 matches step 5 |
| 2 | Scenario NPV ordering | `conservative.npv < base.npv < upside.npv` (for positive cash flows) |
| 3 | Assumption recalc changes NPV | NPV after step 4 differs from NPV before |
| 4 | Decimal precision | NPV values are strings; `0.1 + 0.2` scenario produces `"0.3"` not `"0.30000000000000004"` |
| 5 | Tenant isolation | Step 3 with wrong `organization_id` returns 401 |
| 6 | Missing snapshot on assumption update | Step 4 before step 3 returns 404 `NO_SNAPSHOT` |
| 7 | Timing gate | Full flow (steps 1–5) completes in < 5 seconds (mocked LLM) |

**Mocking strategy:**
- `vi.mock` Supabase — `FinancialModelSnapshotRepository` uses an in-memory store keyed by `(caseId, organizationId)`.
- `vi.mock` auth middleware to inject `tenantId = "org-test-1"` and `user.id = "user-test-1"`.
- `vi.mock` rate limiters (pass-through).
- Do NOT mock the Economic Kernel — it must run real calculations.

---

## Implementation Order

1. Fix `backHalf.ts` syntax error (R1) — unblocks 9 failing tests immediately
2. Fix `backHalf.test.ts` supabase mock (R2) — gets remaining 5 tests green
3. Extend `ScenarioRequestSchema` in `types.ts` with `mode` and optional `cashFlows`
4. Complete `generateScenarios` (R3) — manual mode first, then rerun/both stubs
5. Complete `updateAssumption` (R4) — fetch snapshot, merge, persist, recalc
6. Write E2E harness (R5) — after R3 and R4 are complete
7. Run full test suite — verify no regressions; confirm 14 previously-failing tests now pass

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/backend/src/api/valueCases/backHalf.ts` | Fix unterminated template literal (line 254) |
| `packages/backend/src/api/valueCases/__tests__/backHalf.test.ts` | Add `supabase` export to supabase mock |
| `packages/backend/src/api/valueCases/types.ts` | Add `mode` + `cashFlows` to `ScenarioRequestSchema` |
| `packages/backend/src/api/valueCases/index.ts` | Complete `generateScenarios` and `updateAssumption` |
| `tests/e2e/model-creation.test.ts` | New file — E2E harness |

## Files NOT to Modify

- `packages/backend/src/domain/economic-kernel/economic_kernel.ts` — already correct
- `packages/backend/src/repositories/FinancialModelSnapshotRepository.ts` — already correct
- `packages/backend/src/api/integrity.ts` — already complete
- `apps/ValyntApp/src/views/canvas/ModelStage.tsx` — already wired to real API hooks

---

## Out of Scope

- `lib/economic-kernel/` wrapper layer — not needed; agents import directly from `domain/`
- Playwright browser smoke test — deferred
- Full agent dispatch for `mode: "rerun"` — stub only; full wiring is a separate sprint
- `value-cases-repository-uses-user-client` test failures — separate concern, not blocking this work

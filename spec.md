# Spec: Value Modeling Engine — Schema & Calculation Remediation

**Target:** `Valynt/ValueOS` — Value Modeling Engine & Data Model  
**Trigger:** Manus AI DevOps Review (March 26, 2026) — NO-SHIP verdict  
**Status:** Ready for implementation

---

## Problem Statement

The Value Modeling Engine is broken at three layers simultaneously:

1. **Schema layer** — Critical tables (`value_hypotheses`, `scenarios`, `sensitivity_analysis`, `promise_baselines` and related) are absent from the schema snapshot. The `assumptions` table in the snapshot is a legacy polymorphic version that bears no resemblance to the domain model the application code expects. Two conflicting migrations define `assumptions` and `scenarios` with different tenant column names (`tenant_id` vs `organization_id`), and no migration has ever created `value_hypotheses`.

2. **Calculation layer** — `ScenarioBuilder` hardcodes investment as 30% of total value and spreads benefits evenly over exactly 3 years. `SensitivityAnalyzer` uses a hardcoded `impactFactor = 0.5` instead of calling the economic kernel. The API layer (`ValueModelScenariosService`) independently invents its own ROI/payback formulas (`roiPercent = annualSavings / 10000`) that diverge entirely from the domain model.

3. **Type safety layer** — The `assumptions` table in migration `20260318000000` enforces `source_type = 'CRM-derived'` (capital C, capital R, capital M) while all TypeScript types and agent code use `'crm-derived'` (lowercase). Every insert from application code will fail the CHECK constraint.

The system will crash in production on any attempt to generate hypotheses, run integrity checks, or produce scenario outputs. Financial outputs that do not crash will be mathematically invalid.

---

## Requirements

### R1 — Schema Consolidation

**R1.1** Write a single new consolidating migration that:
- Creates `value_hypotheses` with all columns required by `HypothesisGenerator` and `ValueIntegrityService`
- Creates `scenarios` normalized to `organization_id` (superseding both `20260318000000` and `20260318160647`)
- Creates `sensitivity_analysis` normalized to `organization_id`
- Creates `promise_baselines`, `promise_kpi_targets`, `promise_checkpoints`, `promise_handoff_notes` normalized to `organization_id`
- Is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`)
- Detects whether `tenant_id` or `organization_id` currently exists on affected tables and normalizes to `organization_id` (handles partially-drifted environments)
- Drops `tenant_id` only after data, constraints, indexes, and RLS policies are fully migrated

**R1.2** The `assumptions` table in the new migration must:
- Use `organization_id uuid NOT NULL` (not `tenant_id`, not the legacy polymorphic `related_table`/`related_id` pattern)
- Use a strict foreign key `case_id uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE`
- Enforce `source_type` CHECK constraint with lowercase values matching the TypeScript enum: `'customer-confirmed'`, `'crm-derived'`, `'call-derived'`, `'note-derived'`, `'benchmark-derived'`, `'externally-researched'`, `'inferred'`, `'manually-overridden'`
- Include `name`, `value`, `unit`, `confidence_score`, `benchmark_reference_id`, `original_value`, `overridden_by_user_id`, `created_at`, `updated_at`

**R1.3** The `value_hypotheses` table must include:
- `id`, `organization_id`, `case_id` (FK → `value_cases`), `value_driver`, `description`
- `estimated_impact_min`, `estimated_impact_max`, `impact_unit`
- `evidence_tier` (smallint, 1–3), `confidence_score` (numeric 0–1)
- `benchmark_reference_id` (nullable FK → `benchmarks`)
- `status` CHECK constraint: `'pending'`, `'accepted'`, `'rejected'`, `'modified'`
- `source_context_ids` (uuid[])
- `created_at`, `updated_at`
- RLS policies using `security.user_has_tenant_access(organization_id)`
- Indexes on `(organization_id, case_id)` and `(case_id, status)`

**R1.4** The `scenarios` table must include:
- `id`, `organization_id`, `case_id` (FK → `value_cases`)
- `scenario_type` CHECK: `'conservative'`, `'base'`, `'upside'`
- `assumptions_snapshot_json jsonb`, `evf_decomposition_json jsonb`, `sensitivity_results_json jsonb`
- `roi`, `npv`, `payback_months`
- `cost_input_usd` (nullable numeric) — records the actual cost input used for calculation
- `timeline_years` (nullable numeric) — records the actual timeline used
- `investment_source` text — records provenance: `'explicit'`, `'assumptions_register'`, `'default'`
- `created_at`, `updated_at`

**R1.5** Write a corresponding `.rollback.sql` for the new migration.

**R1.6** Update `docs/db/schema_snapshot.sql` to reflect the post-migration state of all affected tables.

---

### R2 — Fix the `source_type` Enum Mismatch

**R2.1** The CHECK constraint on `assumptions.source_type` must use lowercase `'crm-derived'` everywhere — in the new consolidating migration and in any existing migration that is still in the active chain.

**R2.2** The `promise_kpi_targets.source_classification` CHECK constraint in `20260318000300` also uses `'CRM-derived'`. Fix it to `'crm-derived'` in the new migration (via `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT`).

---

### R3 — Fix `ScenarioBuilder` Calculation Inputs

**R3.1** Extend `ScenarioBuildInput` with optional cost and timeline fields:
```typescript
estimatedCostUsd?: number;   // explicit investment cost
timelineYears?: number;      // benefit realization horizon
discountRate?: number;       // WACC override; defaults to 0.10
```

**R3.2** `callEconomicKernel` must resolve inputs using this precedence:
1. Explicit values in `ScenarioBuildInput` (wins when present)
2. Assumptions register — look for assumptions named `'implementation_cost'` or `'timeline_years'` in the passed `assumptions` array
3. Policy defaults: `discountRate = 0.10`, `timelineYears = 3`, `estimatedCostUsd = null` (if null and no explicit value, throw a descriptive error rather than silently inventing 30%)

**R3.3** Record provenance on each scenario: set `investment_source` to `'explicit'`, `'assumptions_register'`, or `'default'` based on which path resolved the cost input.

**R3.4** Remove the hardcoded `estimatedInvestment = totalValue * 0.3 * investmentMultiplier` formula entirely. If cost cannot be resolved from inputs or assumptions, `buildScenarios` must throw with a clear message: `"Cannot build scenario: no cost input provided and no 'implementation_cost' assumption found"`.

**R3.5** The 3-year annual benefit spread (`annualBenefit = totalValue / 3`) must be replaced with a timeline-driven spread using the resolved `timelineYears`. The cash flow series length must equal `timelineYears + 1` (period 0 = investment outlay).

**R3.6** `ScenarioBuilder` must write `cost_input_usd`, `timeline_years`, and `investment_source` to the `scenarios` table on persist.

---

### R4 — Fix `SensitivityAnalyzer` to Use the Economic Kernel

**R4.1** Remove the hardcoded `impactFactor = 0.5` from `calculateImpact`.

**R4.2** `calculateImpact` must call the economic kernel (`calculateNPV`) with the modified assumption value substituted into the cash flow series. The caller must pass the resolved `costInputUsd` and `timelineYears` from the scenario so the kernel can reconstruct the cash flows.

**R4.3** Extend `SensitivityAnalysisInput` with:
```typescript
costInputUsd: number;
timelineYears: number;
discountRate?: number;
```

**R4.4** The impact calculation must be deterministic: same inputs → same output. No approximation factors.

---

### R5 — Unify API Layer with Domain Model

**R5.1** Replace the body of `ValueModelScenariosService.create()` with a call to `ScenarioBuilder.buildScenarios()`. The service is responsible only for:
- Mapping API input (`ScenarioUpsertInput`) to `ScenarioBuildInput`
- Passing `tenantId`, `modelId` (as `caseId`), `assumptions`, and any explicit cost/timeline inputs
- Returning the persisted scenario from the builder result

**R5.2** Remove `roiPercent = Math.max(0, Math.round(annualSavings / 10000))` and `paybackMonths = Math.max(1, Math.round(36 - Math.min(30, roiPercent / 5)))` entirely.

**R5.3** `ValueModelScenariosService.list()` is unchanged — it remains a pass-through to the repository.

---

### R6 — Fix Tenant Column References in Service Layer

**R6.1** `ScenarioBuilder` currently writes `tenant_id` to the `scenarios` table. After the schema migration normalizes to `organization_id`, update `persistScenarios` to write `organization_id` instead of `tenant_id`.

**R6.2** Update `ScenarioBuildInput` and the `Scenario` schema in `ScenarioBuilder.ts` to use `organization_id` consistently.

**R6.3** Apply the same fix to `SensitivityAnalyzer.persistResults()` and `SensitivityAnalyzer.updateScenario()`.

**R6.4** Apply the same fix to `PromiseBaselineService` — it currently writes `tenant_id` to `promise_baselines`, `promise_kpi_targets`, and `promise_checkpoints`. After the migration normalizes these tables to `organization_id`, update all inserts and queries accordingly.

---

### R7 — Tests

**R7.1 Unit tests — `ScenarioBuilder`:**
- Explicit `estimatedCostUsd` in input → used as investment, `investment_source = 'explicit'`
- No explicit cost, but `implementation_cost` assumption present → used, `investment_source = 'assumptions_register'`
- No cost anywhere → throws with descriptive error
- `timelineYears = 5` → cash flow series has 6 periods (0–5)
- ROI, NPV, payback are computed via economic kernel (not hardcoded formulas)

**R7.2 Unit tests — `SensitivityAnalyzer`:**
- `calculateImpact` calls `calculateNPV` with modified cash flows, not `baseNpv * valueChangePct * 0.5`
- Top-N ranking is deterministic for a given input set

**R7.3 Unit tests — `ValueModelScenariosService`:**
- `create()` delegates to `ScenarioBuilder`, not inline math
- Input mapping from `ScenarioUpsertInput` → `ScenarioBuildInput` is correct

**R7.4 DB integration tests** (run against local Supabase):
- New consolidating migration applies cleanly from zero
- `value_hypotheses` table exists with correct columns, constraints, and RLS
- `assumptions` table has `organization_id`, strict FK to `value_cases`, lowercase `source_type` CHECK
- `scenarios` table has `organization_id`, `cost_input_usd`, `timeline_years`, `investment_source`
- `promise_baselines` and related tables have `organization_id`
- `HypothesisGenerator.persistHypotheses()` succeeds against real DB
- `ScenarioBuilder.persistScenarios()` succeeds against real DB
- RLS correctly isolates rows by `organization_id`
- Inserting `source_type = 'CRM-derived'` (uppercase) fails the CHECK constraint
- Inserting `source_type = 'crm-derived'` (lowercase) succeeds

---

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-1 | `value_hypotheses` table exists in the active migration chain and in `schema_snapshot.sql` |
| AC-2 | `scenarios`, `sensitivity_analysis`, `promise_baselines`, `promise_kpi_targets`, `promise_checkpoints` exist in the schema snapshot |
| AC-3 | All affected tables use `organization_id`, not `tenant_id` |
| AC-4 | `assumptions.source_type` CHECK constraint uses lowercase `'crm-derived'` |
| AC-5 | `ScenarioBuilder` throws if no cost input is resolvable; never silently uses 30% |
| AC-6 | `ScenarioBuilder` cash flow series length equals `timelineYears + 1` |
| AC-7 | `SensitivityAnalyzer.calculateImpact` calls `calculateNPV`; no `impactFactor = 0.5` |
| AC-8 | `ValueModelScenariosService.create()` contains no ROI/payback formulas; delegates to `ScenarioBuilder` |
| AC-9 | All unit tests pass |
| AC-10 | DB integration tests pass against local Supabase |
| AC-11 | `schema_snapshot.sql` reflects the post-migration state of all affected tables |

---

## Implementation Order

1. **Write the consolidating migration** (`20260923000000_value_modeling_schema_consolidation.sql` + `.rollback.sql`)
   - Create `value_hypotheses`
   - Create/normalize `assumptions` (organization_id, strict FK, lowercase enum)
   - Create/normalize `scenarios` (organization_id, add cost/timeline provenance columns)
   - Create/normalize `sensitivity_analysis` (organization_id)
   - Create/normalize `promise_baselines`, `promise_kpi_targets`, `promise_checkpoints`, `promise_handoff_notes` (organization_id)
   - Fix `source_type` and `source_classification` CHECK constraints to lowercase
   - RLS policies for all tables

2. **Update `schema_snapshot.sql`** to reflect post-migration state

3. **Fix `ScenarioBuilder`**
   - Extend `ScenarioBuildInput` with optional cost/timeline/discount fields
   - Implement input resolution with precedence (explicit → assumptions register → error)
   - Replace hardcoded 30%/3-year formulas with resolved inputs
   - Add provenance tracking (`investment_source`)
   - Switch `tenant_id` → `organization_id` in persist

4. **Fix `SensitivityAnalyzer`**
   - Extend `SensitivityAnalysisInput` with `costInputUsd`, `timelineYears`, `discountRate`
   - Replace `impactFactor = 0.5` with actual `calculateNPV` call
   - Switch `tenant_id` → `organization_id` in persist

5. **Fix `ValueModelScenariosService`**
   - Replace inline math with `ScenarioBuilder` delegation
   - Map `ScenarioUpsertInput` → `ScenarioBuildInput`

6. **Fix `PromiseBaselineService`**
   - Switch all `tenant_id` references to `organization_id` in inserts and queries

7. **Write unit tests** for ScenarioBuilder, SensitivityAnalyzer, ValueModelScenariosService

8. **Write DB integration tests** covering schema correctness and service-to-DB flows

---

## Files Affected

| File | Change |
|------|--------|
| `infra/supabase/supabase/migrations/20260923000000_value_modeling_schema_consolidation.sql` | New — consolidating migration |
| `infra/supabase/supabase/migrations/20260923000000_value_modeling_schema_consolidation.rollback.sql` | New — rollback |
| `docs/db/schema_snapshot.sql` | Update affected table definitions |
| `packages/backend/src/services/value/ScenarioBuilder.ts` | Fix inputs, formulas, column names |
| `packages/backend/src/services/value/SensitivityAnalyzer.ts` | Fix calculateImpact, column names |
| `packages/backend/src/api/valueModels/service.ts` | Replace inline math with ScenarioBuilder |
| `packages/backend/src/services/realization/PromiseBaselineService.ts` | tenant_id → organization_id |
| `packages/backend/src/services/__tests__/value/ScenarioBuilder.test.ts` | Expand unit tests |
| `packages/backend/src/services/__tests__/value/SensitivityAnalyzer.test.ts` | Expand unit tests |
| `packages/backend/src/api/__tests__/valueModels.test.ts` | Update to verify ScenarioBuilder delegation |
| `packages/backend/src/services/__tests__/integration/valueModeling.db.test.ts` | New — DB integration tests |

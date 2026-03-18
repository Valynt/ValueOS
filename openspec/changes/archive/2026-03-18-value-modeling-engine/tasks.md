# Tasks

## 1. Database Schema

- [x] 1.1 Create `assumptions` table: id, tenant_id, case_id, name, value, unit, source_type (enum), confidence_score, benchmark_reference_id, original_value, overridden_by_user_id, created_at, updated_at
- [x] 1.2 Create `scenarios` table: id, tenant_id, case_id, scenario_type (conservative|base|upside), assumptions_snapshot_json, roi, npv, payback_months, evf_decomposition_json, created_at
- [x] 1.3 Add RLS policies on both tables using `security.user_has_tenant_access()`
- [x] 1.4 Add indexes on (tenant_id, case_id)
- [x] 1.5 Write rollback SQL

## 2. Hypothesis Generation

- [x] 2.1 Implement `HypothesisGenerator` service
- [x] 2.2 Accept DealContext with extracted value driver candidates
- [x] 2.3 Generate 3–5 value hypotheses each with: value driver, estimated impact range, evidence tier, confidence score
- [x] 2.4 Constrain hypotheses against benchmark ranges (flag claims outside plausible range)
- [x] 2.5 Return hypotheses for user accept/reject/edit

## 3. Baseline Establishment

- [x] 3.1 Implement `BaselineEstablisher` service
- [x] 3.2 For each value driver, find current-state baseline metric
- [x] 3.3 Priority: customer-confirmed > CRM-derived > call-derived > benchmark-derived > inferred
- [x] 3.4 Tag each baseline with source classification
- [x] 3.5 Flag benchmark-derived and inferred baselines as requiring customer confirmation

## 4. Assumption Register

- [x] 4.1 Implement `AssumptionRegister` service with CRUD operations
- [x] 4.2 Every assumption MUST have a source tag on creation
- [x] 4.3 On user override: change source to `manually-overridden`, preserve original value in audit trail
- [x] 4.4 Flag assumptions with no evidence and no benchmark reference as `unsupported`
- [x] 4.5 Expose assumptions via API: `GET /api/cases/:caseId/assumptions`

## 5. TargetAgent Persistence

- [x] 5.1 Modify `TargetAgent` to persist value drivers to `value_tree_nodes` table after generation
- [x] 5.2 Include: node_key, label, driver_type, impact_estimate, confidence, source_agent
- [x] 5.3 Write to `financial_model_snapshots` after financial computation
- [x] 5.4 Verify data survives page refresh (no more empty ModelStage)

## 6. Financial Modeling Agent Enhancement

- [x] 6.1 Modify `FinancialModelingAgent` to consume DealContext and accepted hypotheses
- [x] 6.2 Build three scenario assumption sets (conservative: p25, base: p50, upside: p75)
- [x] 6.3 Call economic kernel for each scenario: ROI, NPV, payback period
- [x] 6.4 Compute EVF decomposition per scenario (revenue uplift, cost reduction, risk mitigation, efficiency gain)
- [x] 6.5 Persist all three scenarios to `scenarios` table
- [x] 6.6 Ensure all arithmetic uses economic kernel (no LLM math)

## 7. Sensitivity Analysis

- [x] 7.1 After model completion, run sensitivity analysis varying key assumptions by ±20%
- [x] 7.2 Identify top-3 highest-leverage assumptions
- [x] 7.3 Persist sensitivity results alongside scenario data
- [x] 7.4 Surface sensitivity in SDUI value model workbench

## 8. Recalculation on Upstream Changes

- [x] 8.1 When a baseline metric or assumption is modified, trigger downstream recalculation
- [x] 8.2 Recalculate all three scenarios
- [x] 8.3 Flag narrative components referencing changed values for refresh
- [x] 8.4 Emit `saga.state.transitioned` event for recalculation

## 9. Workflow Integration

- [x] 9.1 Add modeling steps to `WorkflowDAGDefinitions.ts`
- [x] 9.2 Wire hypothesis generation → baseline → assumptions → scenarios → sensitivity
- [x] 9.3 Add compensation handler: revert value tree to previous version on failure

## 10. Tests

- [x] 10.1 Unit test HypothesisGenerator with mocked DealContext
- [x] 10.2 Unit test BaselineEstablisher source priority logic
- [x] 10.3 Unit test AssumptionRegister CRUD and override audit
- [x] 10.4 Unit test ScenarioBuilder three-scenario output
- [x] 10.5 Unit test sensitivity analysis leverage ranking
- [x] 10.6 Integration test: DealContext → hypotheses → baselines → scenarios → persisted output
- [x] 10.7 Verify recalculation triggers on assumption change

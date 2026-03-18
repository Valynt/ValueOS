# Tasks

## 1. Database Schema

- [ ] 1.1 Create `assumptions` table: id, tenant_id, case_id, name, value, unit, source_type (enum), confidence_score, benchmark_reference_id, original_value, overridden_by_user_id, created_at, updated_at
- [ ] 1.2 Create `scenarios` table: id, tenant_id, case_id, scenario_type (conservative|base|upside), assumptions_snapshot_json, roi, npv, payback_months, evf_decomposition_json, created_at
- [ ] 1.3 Add RLS policies on both tables using `security.user_has_tenant_access()`
- [ ] 1.4 Add indexes on (tenant_id, case_id)
- [ ] 1.5 Write rollback SQL

## 2. Hypothesis Generation

- [ ] 2.1 Implement `HypothesisGenerator` service
- [ ] 2.2 Accept DealContext with extracted value driver candidates
- [ ] 2.3 Generate 3–5 value hypotheses each with: value driver, estimated impact range, evidence tier, confidence score
- [ ] 2.4 Constrain hypotheses against benchmark ranges (flag claims outside plausible range)
- [ ] 2.5 Return hypotheses for user accept/reject/edit

## 3. Baseline Establishment

- [ ] 3.1 Implement `BaselineEstablisher` service
- [ ] 3.2 For each value driver, find current-state baseline metric
- [ ] 3.3 Priority: customer-confirmed > CRM-derived > call-derived > benchmark-derived > inferred
- [ ] 3.4 Tag each baseline with source classification
- [ ] 3.5 Flag benchmark-derived and inferred baselines as requiring customer confirmation

## 4. Assumption Register

- [ ] 4.1 Implement `AssumptionRegister` service with CRUD operations
- [ ] 4.2 Every assumption MUST have a source tag on creation
- [ ] 4.3 On user override: change source to `manually-overridden`, preserve original value in audit trail
- [ ] 4.4 Flag assumptions with no evidence and no benchmark reference as `unsupported`
- [ ] 4.5 Expose assumptions via API: `GET /api/cases/:caseId/assumptions`

## 5. TargetAgent Persistence

- [ ] 5.1 Modify `TargetAgent` to persist value drivers to `value_tree_nodes` table after generation
- [ ] 5.2 Include: node_key, label, driver_type, impact_estimate, confidence, source_agent
- [ ] 5.3 Write to `financial_model_snapshots` after financial computation
- [ ] 5.4 Verify data survives page refresh (no more empty ModelStage)

## 6. Financial Modeling Agent Enhancement

- [ ] 6.1 Modify `FinancialModelingAgent` to consume DealContext and accepted hypotheses
- [ ] 6.2 Build three scenario assumption sets (conservative: p25, base: p50, upside: p75)
- [ ] 6.3 Call economic kernel for each scenario: ROI, NPV, payback period
- [ ] 6.4 Compute EVF decomposition per scenario (revenue uplift, cost reduction, risk mitigation, efficiency gain)
- [ ] 6.5 Persist all three scenarios to `scenarios` table
- [ ] 6.6 Ensure all arithmetic uses economic kernel (no LLM math)

## 7. Sensitivity Analysis

- [ ] 7.1 After model completion, run sensitivity analysis varying key assumptions by ±20%
- [ ] 7.2 Identify top-3 highest-leverage assumptions
- [ ] 7.3 Persist sensitivity results alongside scenario data
- [ ] 7.4 Surface sensitivity in SDUI value model workbench

## 8. Recalculation on Upstream Changes

- [ ] 8.1 When a baseline metric or assumption is modified, trigger downstream recalculation
- [ ] 8.2 Recalculate all three scenarios
- [ ] 8.3 Flag narrative components referencing changed values for refresh
- [ ] 8.4 Emit `saga.state.transitioned` event for recalculation

## 9. Workflow Integration

- [ ] 9.1 Add modeling steps to `WorkflowDAGDefinitions.ts`
- [ ] 9.2 Wire hypothesis generation → baseline → assumptions → scenarios → sensitivity
- [ ] 9.3 Add compensation handler: revert value tree to previous version on failure

## 10. Tests

- [ ] 10.1 Unit test HypothesisGenerator with mocked DealContext
- [ ] 10.2 Unit test BaselineEstablisher source priority logic
- [ ] 10.3 Unit test AssumptionRegister CRUD and override audit
- [ ] 10.4 Unit test ScenarioBuilder three-scenario output
- [ ] 10.5 Unit test sensitivity analysis leverage ranking
- [ ] 10.6 Integration test: DealContext → hypotheses → baselines → scenarios → persisted output
- [ ] 10.7 Verify recalculation triggers on assumption change

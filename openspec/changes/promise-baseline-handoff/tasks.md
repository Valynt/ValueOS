# Tasks

## 1. Database Schema

- [ ] 1.1 Create `promise_baselines` table: id, tenant_id, case_id, scenario_id, scenario_type (conservative|base|upside), status (active|amended|archived), created_by_user_id, approved_at, created_at
- [ ] 1.2 Create `promise_kpi_targets` table: id, tenant_id, baseline_id, metric_name, baseline_value, target_value, unit, timeline_months, source_classification, confidence_score, benchmark_reference_id
- [ ] 1.3 Create `promise_checkpoints` table: id, tenant_id, baseline_id, kpi_target_id, measurement_date, expected_value_min, expected_value_max, data_source_for_actuals, status (pending|measured|missed|exceeded)
- [ ] 1.4 Create `promise_assumptions` table: id, tenant_id, baseline_id, assumption_id (FK to assumptions), name, value, source_type, confidence_score, benchmark_reference
- [ ] 1.5 Create `promise_handoff_notes` table: id, tenant_id, baseline_id, section (deal_context|buyer_priorities|implementation_assumptions|key_risks), content_text, created_at
- [ ] 1.6 Add RLS policies on all tables using `security.user_has_tenant_access()`
- [ ] 1.7 Add indexes on (tenant_id, case_id, baseline_id)
- [ ] 1.8 Write rollback SQL

## 2. Promise Baseline Service

- [ ] 2.1 Implement `PromiseBaselineService`
- [ ] 2.2 `createFromApprovedCase(caseId, scenarioId, userId)` — create baseline from approved scenario
- [ ] 2.3 Copy KPI targets from scenario value drivers with timelines
- [ ] 2.4 Carry forward all critical assumptions with source tags and confidence scores intact
- [ ] 2.5 Baseline is immutable after creation — amendments create new version
- [ ] 2.6 `getBaseline(baselineId)` — retrieve with all targets, checkpoints, assumptions, notes
- [ ] 2.7 Validate tenant_id on all operations

## 3. KPI Target Creation

- [ ] 3.1 For each accepted value driver in the approved scenario, create a KPI target
- [ ] 3.2 Each target includes: metric name, current baseline value, target value, expected timeline, source classification
- [ ] 3.3 Tag source classification from the original assumption

## 4. Checkpoint Scheduler

- [ ] 4.1 Implement `CheckpointScheduler`
- [ ] 4.2 Auto-generate quarterly checkpoints for each KPI target based on timeline
- [ ] 4.3 Each checkpoint: measurement_date, KPI to measure, expected value range, data source for actuals
- [ ] 4.4 Allow CS team to adjust checkpoint dates (but not remove)
- [ ] 4.5 Mark checkpoints as pending by default

## 5. Handoff Notes Generator

- [ ] 5.1 Implement `HandoffNotesGenerator`
- [ ] 5.2 Use NarrativeAgent to generate contextual notes in four sections: deal context, buyer priorities, implementation assumptions, key risks
- [ ] 5.3 Notes should enable CS team to understand what was promised, why, and what the buyer cares about — without re-reading the full value case
- [ ] 5.4 Use `secureInvoke` with Zod-validated output

## 6. RealizationAgent Enhancement

- [ ] 6.1 Modify `RealizationAgent` to trigger baseline creation when case transitions to FINALIZED
- [ ] 6.2 Accept the approved scenario selection (conservative, base, or upside)
- [ ] 6.3 Record scenario choice in baseline metadata
- [ ] 6.4 Emit `saga.case.finalized` domain event with baseline_id

## 7. Workflow Integration

- [ ] 7.1 Add handoff step to `WorkflowDAGDefinitions.ts` after FINALIZED transition
- [ ] 7.2 Compensation handler: delete baseline and associated records on rollback
- [ ] 7.3 Ensure no manual re-entry needed — baseline provides all targets, assumptions, checkpoints

## 8. API Endpoints

- [ ] 8.1 Add `POST /api/cases/:caseId/approve` — approve case with selected scenario, trigger baseline creation
- [ ] 8.2 Add `GET /api/cases/:caseId/baseline` — retrieve promise baseline with full detail
- [ ] 8.3 Add `GET /api/cases/:caseId/baseline/checkpoints` — list checkpoints
- [ ] 8.4 Add `PATCH /api/cases/:caseId/baseline/checkpoints/:id` — adjust checkpoint date
- [ ] 8.5 Validate tenant_id on all endpoints

## 9. Tests

- [ ] 9.1 Unit test PromiseBaselineService creation from approved scenario
- [ ] 9.2 Unit test KPI target creation with source classification carry-forward
- [ ] 9.3 Unit test CheckpointScheduler quarterly generation
- [ ] 9.4 Unit test HandoffNotesGenerator with mocked NarrativeAgent
- [ ] 9.5 Unit test immutability — verify baseline cannot be modified after creation
- [ ] 9.6 Integration test: approve case → baseline created → checkpoints generated → handoff notes produced

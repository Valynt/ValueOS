# Tasks

## 1. Database Schema

- [x] 1.1 Create `case_artifacts` table: id, tenant_id, case_id, artifact_type (executive_memo|cfo_recommendation|customer_narrative|internal_case), content_json, status (draft|final), readiness_score_at_generation, generated_by_agent, created_at, updated_at
- [x] 1.2 Create `artifact_edits` table: id, tenant_id, artifact_id, field_path, old_value, new_value, edited_by_user_id, reason, created_at
- [x] 1.3 Add RLS policies on both tables
- [x] 1.4 Write rollback SQL

## 2. Prompt Templates

- [x] 2.1 Create `executive-memo.hbs` — value hypothesis summary, top drivers with impact ranges, confidence assessment, key assumptions, clear recommendation
- [x] 2.2 Create `cfo-recommendation.hbs` — ROI across scenarios, NPV and payback, financial assumptions with source tags, sensitivity highlights, benchmark references
- [x] 2.3 Create `customer-narrative.hbs` — industry-tailored framing, buyer-persona-appropriate language, benchmark comparisons for buyer context
- [x] 2.4 Create `internal-case.hbs` — deal economics, competitive context, risk factors, assumption quality summary, recommended next steps

## 3. Artifact Generators

- [x] 3.1 Implement `ExecutiveMemoGenerator` — consume validated model, produce structured executive memo
- [x] 3.2 Implement `CFORecommendationGenerator` — consume financial scenarios, produce CFO-targeted note with no claim without confidence score
- [x] 3.3 Implement `CustomerNarrativeGenerator` — consume model + account context, produce industry-tailored narrative
- [x] 3.4 Implement `InternalCaseGenerator` — consume full case data, produce internal deal justification
- [x] 3.5 All generators use `secureInvoke` with Zod-validated output schemas

## 4. NarrativeAgent Enhancement

- [x] 4.1 Modify `NarrativeAgent` to orchestrate full artifact suite generation (not just single narrative block)
- [x] 4.2 Accept readiness score as input — if < 0.8, mark all outputs as `draft`
- [x] 4.3 Surface readiness blockers within draft outputs
- [x] 4.4 Wire hallucination checker between generation and persistence

## 5. Traceability

- [x] 5.1 Every financial figure in generated artifacts MUST include a provenance reference
- [x] 5.2 Add `data-claim-id` attributes to structured output for UI drill-down
- [x] 5.3 Verify no figure appears without confidence score and citation

## 6. Inline Editing

- [x] 6.1 Implement `ArtifactEditService` — persist user edits to `artifact_edits` table
- [x] 6.2 Log: original value, new value, editor user_id, optional reason
- [x] 6.3 Apply edits to artifact content_json
- [x] 6.4 Add `PATCH /api/cases/:caseId/artifacts/:artifactId` endpoint
- [x] 6.5 Validate tenant_id on all edit operations

## 7. ArtifactComposer Integration

- [x] 7.1 Modify `ArtifactComposer` to generate SDUI pages for each artifact type
- [x] 7.2 Add artifact preview rendering in the Executive Output Studio surface
- [x] 7.3 Support switching between artifact types in the UI

## 8. API Endpoints

- [x] 8.1 Add `POST /api/cases/:caseId/artifacts/generate` — trigger full artifact suite generation
- [x] 8.2 Add `GET /api/cases/:caseId/artifacts` — list all artifacts for a case
- [x] 8.3 Add `GET /api/cases/:caseId/artifacts/:artifactId` — retrieve single artifact
- [x] 8.4 Add `PATCH /api/cases/:caseId/artifacts/:artifactId` — inline edit

## 9. Tests

- [x] 9.1 Unit test each generator with mocked validated model input
- [x] 9.2 Unit test hallucination checker integration (figure mismatch → flag)
- [x] 9.3 Unit test ArtifactEditService audit trail
- [x] 9.4 Unit test draft marking when readiness < 0.8
- [x] 9.5 Integration test: validated model → full artifact suite → persisted with traceability

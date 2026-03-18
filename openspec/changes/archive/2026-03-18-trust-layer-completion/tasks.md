# Tasks

## 1. Readiness Scoring

- [ ] 1.1 Implement `ReadinessScorer` service
- [ ] 1.2 Compute composite score from: assumption validation rate, mean evidence grounding score, benchmark coverage percentage, unsupported assumption count
- [ ] 1.3 Score >= 0.8 when validation rate >= 80% and mean grounding >= 0.8 → mark case as presentation-ready
- [ ] 1.4 Score < 0.6 when validation rate < 60% or grounding < 0.4 → identify specific blockers
- [ ] 1.5 Expose readiness via `GET /api/cases/:caseId/readiness`
- [ ] 1.6 Wire readiness into IntegrityAgent output

## 2. Benchmark Plausibility Testing

- [ ] 2.1 Implement `PlausibilityClassifier` service
- [ ] 2.2 Compare modeled KPI improvements against benchmark p25/p50/p75/p90 ranges
- [ ] 2.3 Classify: within p25–p75 → `plausible`, p75–p90 → `aggressive`, > p90 → `unrealistic`
- [ ] 2.4 Include benchmark reference (source, date, sample size) in classification result
- [ ] 2.5 Surface classification in SDUI assumption register view

## 3. Unsupported Assumption Detection

- [ ] 3.1 Implement `UnsupportedAssumptionDetector` service
- [ ] 3.2 Scan all assumptions: flag those with no attached evidence AND no benchmark reference
- [ ] 3.3 Persist flags in assumption register
- [ ] 3.4 Include unsupported count in readiness score calculation
- [ ] 3.5 Surface flags in readiness panel UI

## 4. Confidence Scoring Enhancements

- [ ] 4.1 Add corroboration boost to `ConfidenceScorer`: each additional independent source increases confidence (up to cap of 0.15 boost)
- [ ] 4.2 Add expired evidence penalty: evidence exceeding max age for its tier receives freshness penalty
- [ ] 4.3 Ensure claims with confidence < 0.5 are flagged as requiring additional evidence
- [ ] 4.4 Ensure no financial claim appears in final outputs without a confidence score

## 5. Hallucination Defense

- [ ] 5.1 Implement `NarrativeHallucinationChecker` service
- [ ] 5.2 Parse financial figures from generated narrative text
- [ ] 5.3 Cross-reference each figure against economic kernel deterministic calculations
- [ ] 5.4 Flag any discrepancy as a hallucination with severity and location
- [ ] 5.5 Wire checker into narrative generation pipeline (run after NarrativeAgent, before persist)
- [ ] 5.6 Block narrative persistence if critical hallucinations detected

## 6. Provenance and Explainability

- [ ] 6.1 Create `provenance_records` table: id, tenant_id, case_id, claim_id, data_source, formula, agent_id, agent_version, evidence_tier, confidence_score, parent_record_id, created_at
- [ ] 6.2 Add RLS policies on provenance_records
- [ ] 6.3 Implement `ProvenanceService` with append-only writes
- [ ] 6.4 Every calculated figure in the value tree MUST have a ProvenanceRecord
- [ ] 6.5 Implement lineage chain traversal: given a claim_id, return full derivation chain
- [ ] 6.6 Add `GET /api/cases/:caseId/provenance/:claimId` endpoint
- [ ] 6.7 Wire provenance creation into FinancialModelingAgent and IntegrityAgent outputs

## 7. Source Classification Enforcement

- [ ] 7.1 Validate that every assumption has a source tag on creation (reject if missing)
- [ ] 7.2 Validate that every evidence item has: source tier, freshness date, reliability score, transparency level, validation status
- [ ] 7.3 Add Zod validation for source classification fields

## 8. Tests

- [ ] 8.1 Unit test ReadinessScorer with boundary cases (exactly 80% validation, exactly 0.8 grounding)
- [ ] 8.2 Unit test PlausibilityClassifier with p25/p50/p75/p90 boundaries
- [ ] 8.3 Unit test UnsupportedAssumptionDetector with mixed supported/unsupported assumptions
- [ ] 8.4 Unit test corroboration boost and expired evidence penalty
- [ ] 8.5 Unit test NarrativeHallucinationChecker with matching and mismatching figures
- [ ] 8.6 Unit test ProvenanceService lineage chain traversal
- [ ] 8.7 Integration test: full trust pipeline from evidence → confidence → plausibility → readiness

# Tasks

## 6. Provenance and Explainability

- [x] 6.1 Create `provenance_records` table: id, tenant_id, case_id, claim_id, data_source, formula, agent_id, agent_version, evidence_tier, confidence_score, parent_record_id, created_at
- [x] 6.2 Add RLS policies on provenance_records
- [x] 6.3 Implement `ProvenanceService` with append-only writes
- [x] 6.4 Every calculated figure in the value tree MUST have a ProvenanceRecord
- [x] 6.5 Implement lineage chain traversal: given a claim_id, return full derivation chain
- [x] 6.6 Add `GET /api/cases/:caseId/provenance/:claimId` endpoint
- [x] 6.7 Wire provenance creation into FinancialModelingAgent and IntegrityAgent outputs

## 8. Tests

- [x] 8.6 Unit test ProvenanceService lineage chain traversal

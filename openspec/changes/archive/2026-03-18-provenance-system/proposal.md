# Proposal: Provenance System

## Problem Statement

Financial figures in value cases lack clear audit trails. Users cannot:
- Trace how a figure was calculated
- Verify data sources
- Understand which agent/version produced a value
- Audit the derivation chain

## Proposed Solution

Implement a provenance tracking system:
- `provenance_records` table with full audit trail
- RLS policies for tenant isolation
- `ProvenanceService` with append-only writes
- Lineage chain traversal API
- Integration into FinancialModelingAgent and IntegrityAgent

## Success Criteria

- [ ] Provenance table created with all required fields
- [ ] RLS policies applied
- [ ] ProvenanceService implemented with append-only writes
- [ ] Every calculated figure has a ProvenanceRecord
- [ ] Lineage traversal: given claim_id, return full derivation chain
- [ ] API endpoint: GET /api/cases/:caseId/provenance/:claimId
- [ ] Wired into FinancialModelingAgent and IntegrityAgent outputs

## Scope

In Scope:
- Database schema and migration
- ProvenanceService implementation
- API endpoint
- Agent integration

Out of Scope:
- UI for visualizing provenance (future work)

## Dependencies

- Database migration system
- Agent framework

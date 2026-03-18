# Proposal: Source Classification Enforcement

## Problem Statement

Assumptions and evidence items lack consistent source metadata, making it difficult to:
- Track data provenance
- Apply appropriate confidence scoring
- Validate data freshness
- Ensure audit compliance

## Proposed Solution

Enforce source classification at creation time via Zod validation:
- Every assumption must have a source tag
- Every evidence item must have: tier, freshness date, reliability score, transparency level, validation status

## Success Criteria

- [ ] Assumptions without source tags are rejected on creation
- [ ] Evidence items missing required fields are rejected
- [ ] Zod schemas validate all source classification fields

## Scope

In Scope:
- Zod schema definitions for source classification
- Validation middleware for assumption creation
- Validation middleware for evidence creation

Out of Scope:
- UI changes for displaying source info
- Backfill of existing data

## Dependencies

None - this is a foundational enforcement layer

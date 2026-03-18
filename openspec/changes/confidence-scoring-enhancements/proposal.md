# Proposal: Confidence Scoring Enhancements

## Problem Statement

The current confidence scoring system doesn't account for:
1. Multiple corroborating sources (should increase confidence)
2. Evidence freshness (expired evidence should reduce confidence)
3. Minimum confidence thresholds for financial claims

## Proposed Solution

Enhance the ConfidenceScorer service with:
- Corroboration boost (up to +0.15 for multiple independent sources)
- Expired evidence penalty (based on tier-specific max age)
- Validation that all financial claims have confidence scores
- Flagging claims with confidence < 0.5

## Success Criteria

- [ ] Claims with 2+ independent sources get confidence boost
- [ ] Evidence older than tier max age gets freshness penalty
- [ ] All financial claims have confidence scores
- [ ] Low confidence claims (< 0.5) are flagged

## Scope

In Scope:
- ConfidenceScorer service enhancements
- Corroboration boost logic
- Expired evidence penalty calculation
- Claim validation

Out of Scope:
- Changes to source tier definitions
- UI changes (handled separately)

## Dependencies

- Source classification system (for tier max ages)
- Evidence storage system

# Proposal: Readiness Scoring

## Problem Statement

Value cases vary in quality and completeness. Users need a clear signal when a case is ready for presentation to stakeholders vs. when it needs more work.

## Proposed Solution

Implement a `ReadinessScorer` service that computes a composite score (0-1) from:
- Assumption validation rate
- Mean evidence grounding score
- Benchmark coverage percentage
- Unsupported assumption count

Score thresholds:
- ≥ 0.8: Presentation-ready
- < 0.6: Identify specific blockers

Expose via API and wire into IntegrityAgent output.

## Success Criteria

- [ ] ReadinessScorer service implemented
- [ ] Composite score computed correctly
- [ ] Score ≥ 0.8 marks case as presentation-ready
- [ ] Score < 0.6 identifies specific blockers
- [ ] API endpoint exposed: GET /api/cases/:caseId/readiness
- [ ] Readiness wired into IntegrityAgent output

## Scope

In Scope:
- ReadinessScorer service
- API endpoint
- IntegrityAgent integration
- Blocker identification logic

Out of Scope:
- UI changes (handled separately)

## Dependencies

- Unsupported assumption detection (for count)
- Confidence scoring (for grounding scores)
- Benchmark retrieval (for coverage)

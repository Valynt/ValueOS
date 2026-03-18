# Tasks

## 1. Readiness Scoring

- [x] 1.1 Implement `ReadinessScorer` service
- [x] 1.2 Compute composite score from: assumption validation rate, mean evidence grounding score, benchmark coverage percentage, unsupported assumption count
- [x] 1.3 Score >= 0.8 when validation rate >= 80% and mean grounding >= 0.8 → mark case as presentation-ready
- [x] 1.4 Score < 0.6 when validation rate < 60% or grounding < 0.4 → identify specific blockers
- [x] 1.5 Expose readiness via `GET /api/cases/:caseId/readiness`
- [x] 1.6 Wire readiness into IntegrityAgent output

## 8. Tests

- [x] 8.1 Unit test ReadinessScorer with boundary cases (exactly 80% validation, exactly 0.8 grounding)

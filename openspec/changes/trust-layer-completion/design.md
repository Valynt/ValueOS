# Design: Trust Layer Completion

## Technical Approach

Build on existing `EvidenceTiering.ts`, `ConfidenceScorer.ts`, and `AdversarialIOMiddleware.ts`. Add new services for readiness scoring and plausibility testing. Wire hallucination checks into the narrative pipeline.

## Architecture Decisions

### Decision: Readiness as composite score

Readiness score is computed from: assumption validation rate, mean evidence grounding score, benchmark coverage, and unsupported assumption count. Not a simple threshold — a weighted composite.

### Decision: Hallucination check at narrative generation boundary

The hallucination defense compares every financial figure in generated narrative text against the deterministic economic kernel output. Mismatches trigger a flag before the narrative is persisted.

### Decision: Provenance records for explainability

Every calculated figure gets a `ProvenanceRecord` linking raw data source → formula → agent → confidence. This powers the "click a number to see lineage" UX.

## File Changes

### New
- `packages/backend/src/services/trust/ReadinessScorer.ts` — Composite readiness scoring
- `packages/backend/src/services/trust/PlausibilityClassifier.ts` — Benchmark range classification
- `packages/backend/src/services/trust/UnsupportedAssumptionDetector.ts` — Flag ungrounded assumptions
- `packages/backend/src/services/trust/NarrativeHallucinationChecker.ts` — Cross-check narrative vs kernel
- `packages/backend/src/services/trust/ProvenanceService.ts` — Number lineage CRUD
- `infra/supabase/supabase/migrations/YYYYMMDD_provenance_records.sql` — Provenance table

### Modified
- `packages/backend/src/lib/agents/core/EvidenceTiering.ts` — Add expired evidence penalty
- `packages/backend/src/lib/agents/core/ConfidenceScorer.ts` — Add corroboration boost
- `packages/backend/src/lib/agent-fabric/agents/IntegrityAgent.ts` — Wire readiness scoring
- `packages/backend/src/services/middleware/AdversarialIOMiddleware.ts` — Wire into narrative pipeline

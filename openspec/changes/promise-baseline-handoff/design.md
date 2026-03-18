# Design: Promise Baseline Handoff

## Technical Approach

The `RealizationAgent` already exists for realization tracking. Extend it with a `createBaseline` capability triggered when a case transitions to FINALIZED. The baseline is a snapshot of the approved scenario with structured KPI targets and checkpoints.

## Architecture Decisions

### Decision: Baseline as immutable snapshot

Once created, a promise baseline is immutable. Amendments create a new baseline version linked to the original. This ensures the handoff package is auditable.

### Decision: Inherit scenario + assumptions, not copy

The baseline references the approved scenario and carries forward assumptions with their source tags and confidence scores intact. No data is re-entered.

### Decision: Checkpoint schedule derived from KPI timelines

Checkpoints are auto-generated from KPI target timelines (e.g., quarterly measurement points). Customer success teams can adjust checkpoint dates but not remove them.

## File Changes

### New
- `packages/backend/src/services/handoff/PromiseBaselineService.ts` — Baseline CRUD
- `packages/backend/src/services/handoff/CheckpointScheduler.ts` — Auto-generate checkpoints
- `packages/backend/src/services/handoff/HandoffNotesGenerator.ts` — CS handoff notes
- `infra/supabase/supabase/migrations/YYYYMMDD_promise_baselines.sql` — Tables

### Modified
- `packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts` — Add baseline creation
- `packages/backend/src/services/workflows/WorkflowDAGDefinitions.ts` — Add handoff step after FINALIZED

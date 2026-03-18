# Design: Executive Output Generation

## Technical Approach

Extend the existing `NarrativeAgent` and `ArtifactComposer` runtime service. Each artifact type is generated via a dedicated prompt template and validated against the economic kernel output before persistence.

## Architecture Decisions

### Decision: Template-per-artifact-type

Each output type (executive memo, CFO note, customer narrative, internal case) uses a separate Handlebars prompt template. This allows persona-specific framing without coupling artifact types.

### Decision: Hallucination check gate

Every generated artifact passes through `NarrativeHallucinationChecker` before persistence. Any financial figure must trace to the deterministic economic kernel.

### Decision: SDUI rendering for preview

Artifacts are rendered as SDUI pages for in-app preview. The same structured data can later power PDF/PPTX export.

## File Changes

### New
- `packages/backend/src/services/artifacts/ExecutiveMemoGenerator.ts`
- `packages/backend/src/services/artifacts/CFORecommendationGenerator.ts`
- `packages/backend/src/services/artifacts/CustomerNarrativeGenerator.ts`
- `packages/backend/src/services/artifacts/InternalCaseGenerator.ts`
- `packages/backend/src/services/artifacts/ArtifactEditService.ts` — Inline edit + audit
- `packages/backend/src/templates/executive-memo.hbs`
- `packages/backend/src/templates/cfo-recommendation.hbs`
- `packages/backend/src/templates/customer-narrative.hbs`
- `packages/backend/src/templates/internal-case.hbs`
- `infra/supabase/supabase/migrations/YYYYMMDD_artifacts.sql` — artifacts table

### Modified
- `packages/backend/src/lib/agent-fabric/agents/NarrativeAgent.ts` — Generate full artifact suite
- `packages/backend/src/runtime/artifact-composer/index.ts` — Orchestrate multi-artifact generation

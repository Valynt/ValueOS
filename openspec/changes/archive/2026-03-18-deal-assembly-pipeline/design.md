# Design: Deal Assembly Pipeline

## Technical Approach

The deal assembly pipeline runs as a multi-step workflow orchestrated by the existing `WorkflowDAGDefinitions` infrastructure. Each source connector produces normalized fragments that are merged into a `DealContext` entity.

## Architecture Decisions

### Decision: DealContext as first-class entity

DealContext is a new Supabase table that aggregates all deal signals. Currently, opportunity context is implicit across multiple tables. Making it explicit enables provenance tracking and agent consumption.

### Decision: Source-specific extractors

Each source type (CRM, transcript, notes, public data) gets a dedicated extractor service. Extractors are stateless and produce typed fragments. The assembly agent merges fragments with conflict resolution.

### Decision: Extend OpportunityAgent, not replace

The existing `OpportunityAgent` handles discovery. The new `DealAssemblyAgent` wraps it and adds multi-source ingestion. This preserves backward compatibility.

## Data Flow

```
CRM Connector ──────┐
Transcript Parser ───┤
Notes Extractor ─────┤──► DealAssemblyAgent ──► DealContext (Supabase)
Public Enrichment ───┤
Precedent Retrieval ─┘
```

## File Changes

### New
- `packages/backend/src/services/ingestion/CRMConnector.ts` — CRM data normalization
- `packages/backend/src/services/ingestion/TranscriptParser.ts` — Call transcript signal extraction
- `packages/backend/src/services/ingestion/NotesExtractor.ts` — Notes and document extraction
- `packages/backend/src/services/ingestion/PublicEnrichmentService.ts` — Firmographic and market data
- `packages/backend/src/services/ingestion/DealContextAssembler.ts` — Fragment merging
- `packages/backend/src/lib/agent-fabric/agents/DealAssemblyAgent.ts` — Orchestrating agent
- `packages/backend/src/lib/agent-fabric/agents/ContextExtractionAgent.ts` — Extraction agent
- `infra/supabase/supabase/migrations/YYYYMMDD_deal_context.sql` — DealContext table + RLS

### Modified
- `packages/backend/src/services/workflows/WorkflowDAGDefinitions.ts` — Add deal assembly DAG
- `packages/shared/src/domain/` — Add DealContext, Stakeholder, UseCase Zod schemas
- `packages/backend/src/types/agent.ts` — Add DealAssembly lifecycle context

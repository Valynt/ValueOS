# Design: Onboarding Research Pipeline

## Technical Approach

BullMQ worker processes research jobs asynchronously. WebCrawler fetches same-domain pages. SuggestionExtractor calls LLMGateway per entity type with Zod-validated schemas. Frontend polls job status and renders suggestion cards.

## Architecture Decisions

### Decision: Separate suggestions table, not direct writes

Suggestions are stored in `company_research_suggestions` with accept/reject status. Only accepted suggestions are written to target `company_*` tables. This gives users full control.

### Decision: Per-entity-type LLM calls

Each entity type (product, competitor, persona, claim, capability, value_pattern) uses a separate LLM call with a tailored prompt and Zod schema. Partial failures don't block other entity types.

### Decision: Polling, not WebSocket

Frontend polls job status every 2 seconds via GET. Simpler than WebSocket for this use case, and the job completes in under 60 seconds.

## Data Flow

```
Phase1 "Auto-fill" click
        │
        ▼
POST /api/onboarding/research ──► BullMQ Queue
                                       │
                                       ▼
                                 ResearchJobWorker
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
               WebCrawler      SEC EDGAR Fetch      (future sources)
                    │                  │
                    └────────┬─────────┘
                             ▼
                    SuggestionExtractor (LLM × 6 entity types)
                             │
                             ▼
                    company_research_suggestions (DB)
                             │
                             ▼
                    Phase 2–5 SuggestionCards (UI)
                             │
                    Accept / Edit / Reject
                             │
                             ▼
                    company_* target tables (on accept)
```

## File Changes

### New (Backend)
- `infra/supabase/supabase/migrations/YYYYMMDD_research_jobs.sql` — research_jobs + suggestions tables + RLS
- `packages/backend/src/services/onboarding/ResearchJobWorker.ts` — BullMQ worker
- `packages/backend/src/services/onboarding/WebCrawler.ts` — Same-domain crawler
- `packages/backend/src/services/onboarding/SuggestionExtractor.ts` — LLM extraction per entity type
- `packages/backend/src/services/onboarding/index.ts` — Barrel exports
- `packages/backend/src/api/onboarding.ts` — REST endpoints

### New (Frontend)
- `apps/ValyntApp/src/hooks/company-context/useResearchJob.ts` — React Query hooks
- `apps/ValyntApp/src/components/onboarding/SuggestionCard.tsx` — Reusable card component

### Modified
- `apps/ValyntApp/src/views/CompanyOnboarding.tsx` — Thread researchJobId
- `apps/ValyntApp/src/views/onboarding/Phase1Company.tsx` — Auto-fill button
- `apps/ValyntApp/src/views/onboarding/Phase2Competitors.tsx` — Suggestion cards
- `apps/ValyntApp/src/views/onboarding/Phase3Personas.tsx` — Suggestion cards
- `apps/ValyntApp/src/views/onboarding/Phase4Claims.tsx` — Suggestion cards + confidence-based risk defaulting
- `apps/ValyntApp/src/views/onboarding/Phase5Review.tsx` — Provenance badges
- `apps/ValyntApp/src/hooks/company-context/types.ts` — ResearchJob, ResearchSuggestion types

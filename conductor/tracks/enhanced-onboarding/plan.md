# Implementation Plan - Enhanced Onboarding

This plan outlines the steps to implement the research-assisted onboarding flow.

## Phase 1: Foundation (Database & Types)
- [ ] Create Supabase migration for `company_research_jobs` and `company_research_suggestions` tables.
- [ ] Add RLS policies and triggers for the new tables.
- [ ] Update frontend type definitions in `apps/ValyntApp/src/hooks/company-context/types.ts`.

## Phase 2: Backend - Research Pipeline
- [ ] Implement `WebCrawler` in `packages/backend/src/services/onboarding/WebCrawler.ts`.
- [ ] Implement `SuggestionExtractor` in `packages/backend/src/services/onboarding/SuggestionExtractor.ts`.
- [ ] Implement `ResearchJobWorker` in `packages/backend/src/services/onboarding/ResearchJobWorker.ts`.
- [ ] Export new services in `packages/backend/src/services/onboarding/index.ts`.

## Phase 3: Backend - API
- [ ] Implement REST endpoints in `packages/backend/src/api/onboarding.ts`.
- [ ] Integrate endpoints into the main backend application (check existing API structure).

## Phase 4: Frontend - Hooks & Components
- [ ] Create `useResearchJob` hooks in `apps/ValyntApp/src/hooks/company-context/useResearchJob.ts`.
- [ ] Create `SuggestionCard` component in `apps/ValyntApp/src/components/onboarding/SuggestionCard.tsx`.

## Phase 5: Frontend - UI Integration
- [ ] Modify `Phase1Company.tsx` to add "Auto-fill" button and progress UI.
- [ ] Modify `Phase2Competitors.tsx` to show suggestions.
- [ ] Modify `Phase3Personas.tsx` to show suggestions.
- [ ] Modify `Phase4Claims.tsx` to show suggestions.
- [ ] Modify `Phase5Review.tsx` to show provenance badges.
- [ ] Modify `CompanyOnboarding.tsx` to manage research job state.

## Phase 6: Verification
- [ ] Verify database migrations and RLS.
- [ ] Test backend worker with mock/real website.
- [ ] Test API endpoints.
- [ ] End-to-end test of the onboarding flow.

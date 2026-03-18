# Tasks

## 1. Database Migration

- [x] 1.1 Create `company_research_jobs` table: id, tenant_id, context_id (FK), input_website, input_industry, input_company_size, input_sales_motion, status (queued|running|completed|failed), progress (JSONB), started_at, completed_at, error_message, created_at, updated_at
- [x] 1.2 Create `company_research_suggestions` table: id, tenant_id, job_id (FK), context_id (FK), entity_type (product|competitor|persona|claim|capability|value_pattern), payload (JSONB), confidence_score (0–1), source_urls (JSONB), status (suggested|accepted|rejected|edited), accepted_at, created_at
- [x] 1.3 Enable RLS on both tables with `security.user_has_tenant_access(tenant_id)` policies
- [x] 1.4 Add indexes on tenant_id, context_id, job_id, entity_type, status
- [x] 1.5 Add updated_at trigger on company_research_jobs
- [x] 1.6 Write rollback SQL

## 2. Type Definitions

- [x] 2.1 Add `ResearchJob` interface to `apps/ValyntApp/src/hooks/company-context/types.ts`
- [x] 2.2 Add `SuggestionEntityType` type union
- [x] 2.3 Add `ResearchSuggestion` interface
- [x] 2.4 Add corresponding Zod schemas in backend for validation

## 3. WebCrawler

- [x] 3.1 Implement `WebCrawler` — fetch homepage + up to 10 same-domain linked pages
- [x] 3.2 Strip HTML, limit to 50k chars total
- [x] 3.3 Cap total crawl time at 30 seconds
- [x] 3.4 Do not follow external domains
- [x] 3.5 Return structured text with per-page source URLs

## 4. SuggestionExtractor

- [x] 4.1 Implement `SuggestionExtractor` — LLM extraction per entity type
- [x] 4.2 Products: name, description, product_type
- [x] 4.3 Competitors: name, relationship (inferred from "vs", "alternative to" language)
- [x] 4.4 Personas: title, persona_type, seniority, typical_kpis, pain_points
- [x] 4.5 Claims: claim_text, risk_level, category, rationale
- [x] 4.6 Capabilities: capability, operational_change, economic_lever
- [x] 4.7 Value Patterns: pattern_name, typical_kpis, typical_assumptions
- [x] 4.8 Each extraction uses separate LLM call with Zod-validated response
- [x] 4.9 Assign confidence_score (0–1) and source_urls per suggestion
- [x] 4.10 Partial failures (one entity type fails) do not block others

## 5. ResearchJobWorker

- [x] 5.1 Implement BullMQ worker that processes research jobs
- [x] 5.2 On dequeue: update status → `running`, set started_at
- [x] 5.3 Run WebCrawler → SuggestionExtractor per entity type → write suggestions to DB
- [x] 5.4 Update progress JSONB after each entity type completes
- [x] 5.5 On completion: set status → `completed`, completed_at
- [x] 5.6 On failure: set status → `failed`, error_message
- [x] 5.7 Use existing `LLMGateway.complete()` with tenantId in metadata

## 6. API Endpoints

- [x] 6.1 `POST /api/onboarding/research` — create research job (body: contextId, website, industry?, companySize?, salesMotion?)
- [x] 6.2 `GET /api/onboarding/research/:jobId` — poll job status
- [x] 6.3 `GET /api/onboarding/research/:jobId/suggestions` — list suggestions (filter: entity_type?, status?)
- [x] 6.4 `PATCH /api/onboarding/suggestions/:id` — update status (accepted|rejected|edited, optional payload)
- [x] 6.5 `POST /api/onboarding/suggestions/bulk-accept` — accept multiple (body: ids[])
- [x] 6.6 On accept: write payload to target company_* table within transaction
- [x] 6.7 Validate tenant_id from authenticated session on all endpoints

## 7. Frontend — Phase 1 Auto-fill

- [x] 7.1 Add "Auto-fill from website" button to Phase1Company when website URL is entered
- [x] 7.2 On click: create company_contexts record, POST research job, show progress indicator
- [x] 7.3 Poll GET /research/:jobId every 2 seconds until completed or failed
- [x] 7.4 Pre-populate products list from product suggestions when complete
- [x] 7.5 Manual flow unchanged when auto-fill skipped

## 8. Frontend — React Query Hooks

- [x] 8.1 Implement `useCreateResearchJob(tenantId)` — POST mutation
- [x] 8.2 Implement `useResearchJobStatus(jobId)` — polling query (2s)
- [x] 8.3 Implement `useResearchSuggestions(jobId, entityType?)` — suggestions query
- [x] 8.4 Implement `useAcceptSuggestion(tenantId)` — PATCH mutation
- [x] 8.5 Implement `useRejectSuggestion(tenantId)` — PATCH mutation
- [x] 8.6 Implement `useBulkAcceptSuggestions(tenantId)` — bulk POST mutation

## 9. Frontend — Phase 2–4 Suggestion Cards

- [x] 9.1 Create `SuggestionCard` component: entity data, confidence badge (green ≥0.7, amber ≥0.4, red <0.4), source URL count, Accept/Edit/Reject actions
- [x] 9.2 Phase2Competitors: render competitor suggestions above manual entry
- [x] 9.3 Phase3Personas: render persona suggestions above manual entry
- [x] 9.4 Phase4Claims: render claim suggestions; default risk_level to `conditional` if confidence < 0.5
- [x] 9.5 Accepted items appear in confirmed list alongside manual entries
- [x] 9.6 Manual entry fully functional alongside suggestions

## 10. Frontend — Phase 5 Provenance

- [x] 10.1 Show "AI-suggested" badge + confidence score on accepted suggestions in review
- [x] 10.2 Show source count with expandable source URLs
- [x] 10.3 Version snapshot includes: research job ID, per-item provenance, AI-suggested vs manual flag

## 11. Frontend — CompanyOnboarding Orchestration

- [x] 11.1 Add researchJobId to CompanyOnboarding component state
- [x] 11.2 Pass researchJobId to Phase 2–4 components
- [x] 11.3 If Phase 1 completes with auto-fill: set researchJobId before advancing
- [x] 11.4 If Phase 1 completes without auto-fill: researchJobId = null, phases render manual-only

## 12. Tests

- [x] 12.1 Unit test WebCrawler: same-domain constraint, 30s timeout, 50k char cap
- [x] 12.2 Unit test SuggestionExtractor: Zod validation, partial failure resilience
- [x] 12.3 Unit test ResearchJobWorker: lifecycle (queued → running → completed/failed)
- [x] 12.4 Unit test API endpoints: tenant isolation, accept/reject writes
- [x] 12.5 Unit test SuggestionCard: confidence badge rendering, action handlers
- [x] 12.6 Integration test: research job creation → crawl → extract → suggestions → accept → company_* rows
- [x] 12.7 Regression test: manual onboarding flow unchanged when auto-fill skipped
- [x] 12.8 Regression test: OnboardingGate behavior unchanged

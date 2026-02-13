# Spec: Enhanced Onboarding — Agentic Research-Assisted Onboarding

## Problem Statement

The current 5-phase `CompanyOnboarding` flow requires users to manually enumerate products, competitors, personas, and claims. This creates friction for sales-led SaaS buyers (CRO/CFO audience) who expect onboarding to feel like reviewing a briefing, not filling out forms.

The existing flow works — the schema, RLS, version snapshots, and phase architecture are sound. What's missing is a research layer that pre-populates suggestions from a company's public web presence, letting users review and accept rather than author from scratch.

## Existing Assets (What We Keep)

| Asset | Location | Status |
|---|---|---|
| CompanyOnboarding (5-phase wizard) | `apps/ValyntApp/src/views/CompanyOnboarding.tsx` | Modify |
| Phase1Company | `apps/ValyntApp/src/views/onboarding/Phase1Company.tsx` | Modify |
| Phase2Competitors | `apps/ValyntApp/src/views/onboarding/Phase2Competitors.tsx` | Modify |
| Phase3Personas | `apps/ValyntApp/src/views/onboarding/Phase3Personas.tsx` | Modify |
| Phase4Claims | `apps/ValyntApp/src/views/onboarding/Phase4Claims.tsx` | Modify |
| Phase5Review | `apps/ValyntApp/src/views/onboarding/Phase5Review.tsx` | Modify |
| Mutation hooks (useCreateCompanyContext, etc.) | `apps/ValyntApp/src/hooks/company-context/useCompanyContext.ts` | Modify |
| Type definitions | `apps/ValyntApp/src/hooks/company-context/types.ts` | Modify |
| CompanyContextProvider + OnboardingGate | `apps/ValyntApp/src/contexts/CompanyContextProvider.tsx` | Keep |
| DB schema (8 company_* tables) | `infra/supabase/supabase/migrations/_deferred/20260209100000_create_company_value_context.sql` | Keep |
| BullMQ + Redis queue infrastructure | `packages/backend/src/services/MessageQueue.ts` | Reuse pattern |
| LLMGateway | `packages/backend/src/lib/agent-fabric/LLMGateway.ts` | Reuse |
| Supabase RLS tenant isolation | All company_* tables | Keep |

## Requirements

### R1: Database — Research Job and Suggestion Tables

Add two new tables to support the research pipeline.

**File:** `infra/supabase/supabase/migrations/_deferred/20260212000000_create_research_jobs.sql` (new)

```sql
-- company_research_jobs: tracks async research runs per onboarding context
CREATE TABLE public.company_research_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    input_website TEXT NOT NULL,
    input_industry TEXT,
    input_company_size TEXT,
    input_sales_motion TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    progress JSONB DEFAULT '{}'::JSONB,  -- e.g. {"products": "done", "competitors": "running", ...}
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- company_research_suggestions: individual suggestions produced by a research job
CREATE TABLE public.company_research_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    job_id UUID NOT NULL REFERENCES public.company_research_jobs(id) ON DELETE CASCADE,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL
        CHECK (entity_type IN ('product', 'competitor', 'persona', 'claim', 'capability', 'value_pattern')),
    payload JSONB NOT NULL,           -- shape matches the target table's insert schema
    confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.5
        CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source_urls JSONB DEFAULT '[]'::JSONB,
    status TEXT NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'accepted', 'rejected', 'edited')),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Both tables get:
- RLS enabled and forced
- Tenant-scoped policies using `security.user_has_tenant_access(tenant_id)`
- Indexes on `tenant_id`, `context_id`, `job_id`, `entity_type`, `status`
- `updated_at` trigger on `company_research_jobs`

### R2: Backend — Research Job Worker

Implement a BullMQ worker that processes research jobs. When a job is dequeued, it:

1. Updates `company_research_jobs.status` → `running`, sets `started_at`
2. Crawls the target website (homepage + up to 10 linked pages on the same domain)
3. Extracts text content (strip HTML, limit to 50k chars total)
4. Calls the LLMGateway with a structured extraction prompt for each entity type:
   - **Products**: name, description, product_type
   - **Competitors**: name, relationship (inferred from "vs", "alternative to", "compared to" language)
   - **Personas**: title, persona_type, seniority, typical_kpis, pain_points
   - **Claims**: claim_text, risk_level, category, rationale
   - **Capabilities**: capability, operational_change, economic_lever (derived from product descriptions)
   - **Value Patterns**: pattern_name, typical_kpis, typical_assumptions (generated from industry + persona + capability combinations)
5. Writes each extracted item as a row in `company_research_suggestions` with `confidence_score` and `source_urls`
6. Updates `company_research_jobs.progress` after each entity type completes
7. On completion: sets `status` → `completed`, `completed_at`
8. On failure: sets `status` → `failed`, `error_message`

**Files:**
- `packages/backend/src/services/onboarding/ResearchJobWorker.ts` (new) — BullMQ worker
- `packages/backend/src/services/onboarding/WebCrawler.ts` (new) — simple same-domain crawler
- `packages/backend/src/services/onboarding/SuggestionExtractor.ts` (new) — LLM extraction per entity type
- `packages/backend/src/services/onboarding/index.ts` (new) — exports

**Constraints:**
- Crawler is limited to the input website's domain only (no external sites in v1)
- Total crawl time capped at 30 seconds
- LLM calls use the existing `LLMGateway.complete()` with `tenantId` in metadata
- Each entity type extraction is a separate LLM call with a Zod-validated response schema
- If any single entity type extraction fails, the others still proceed (partial results are valid)

### R3: Backend — Research Job API Endpoints

Expose endpoints for the frontend to create and poll research jobs.

**File:** `packages/backend/src/api/onboarding.ts` (new)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/onboarding/research` | Required | Create a research job. Body: `{ contextId, website, industry?, companySize?, salesMotion? }`. Returns the job record. |
| GET | `/api/onboarding/research/:jobId` | Required | Poll job status. Returns job record with `status`, `progress`, `error_message`. |
| GET | `/api/onboarding/research/:jobId/suggestions` | Required | List suggestions for a job. Query params: `entity_type?`, `status?`. Returns `company_research_suggestions[]`. |
| PATCH | `/api/onboarding/suggestions/:id` | Required | Update suggestion status. Body: `{ status: 'accepted' | 'rejected' | 'edited', payload?: JSONB }`. On `accepted`/`edited`, writes the payload to the corresponding `company_*` table. |
| POST | `/api/onboarding/suggestions/bulk-accept` | Required | Accept multiple suggestions at once. Body: `{ ids: string[] }`. Writes each to its target table. |

All endpoints validate `tenant_id` from the authenticated session. The PATCH endpoint on accept performs the INSERT into the target table (`company_products`, `company_competitors`, etc.) within a transaction.

### R4: Frontend — Phase 1 Enhancement (Auto-fill Trigger)

Modify `Phase1Company` to add a "Generate from website" button.

**File:** `apps/ValyntApp/src/views/onboarding/Phase1Company.tsx` (modify)

Behavior:
1. After the user enters a website URL, show a button: "Auto-fill from website"
2. On click:
   - Call `useCreateCompanyContext` to create the `company_contexts` record (status = `in_progress`)
   - Call `POST /api/onboarding/research` with the context ID and website
   - Show a progress indicator with per-entity-type status (products, competitors, personas, claims)
   - Poll `GET /api/onboarding/research/:jobId` every 2 seconds until `completed` or `failed`
3. When complete:
   - Pre-populate the products list from suggestions with `entity_type = 'product'`
   - User can edit the pre-populated products before proceeding
4. If the user skips auto-fill, the existing manual flow works unchanged

**File:** `apps/ValyntApp/src/hooks/company-context/useResearchJob.ts` (new)

New hooks:
- `useCreateResearchJob(tenantId)` — mutation that POSTs to `/api/onboarding/research`
- `useResearchJobStatus(jobId)` — polling query (2s interval) for job status
- `useResearchSuggestions(jobId, entityType?)` — query for suggestions
- `useAcceptSuggestion(tenantId)` — mutation that PATCHes a suggestion to `accepted`
- `useRejectSuggestion(tenantId)` — mutation that PATCHes a suggestion to `rejected`
- `useBulkAcceptSuggestions(tenantId)` — mutation for bulk accept

### R5: Frontend — Phase 2-4 Enhancement (Suggestion Cards)

Modify Phases 2, 3, and 4 to display research suggestions with Accept/Edit/Reject actions.

**Files:**
- `apps/ValyntApp/src/views/onboarding/Phase2Competitors.tsx` (modify)
- `apps/ValyntApp/src/views/onboarding/Phase3Personas.tsx` (modify)
- `apps/ValyntApp/src/views/onboarding/Phase4Claims.tsx` (modify)
- `apps/ValyntApp/src/components/onboarding/SuggestionCard.tsx` (new)

Each phase, when suggestions exist for its entity type:
1. Renders a "Suggested" section above the manual entry area
2. Each suggestion is a `SuggestionCard` showing:
   - The entity data (name, description, etc.)
   - Confidence score (as a colored badge: green ≥0.7, amber ≥0.4, red <0.4)
   - Source URL count (clickable to expand)
   - Three actions: **Accept** (writes to DB), **Edit** (opens inline editor, then accept), **Reject** (marks rejected)
3. Accepted suggestions appear in the "confirmed" list alongside manually entered items
4. Manual entry remains fully functional — suggestions are additive, not replacing

**Phase-specific suggestion rendering:**

| Phase | Entity Type | Card Shows |
|---|---|---|
| 2 | `competitor` | Name, website, relationship type, confidence |
| 3 | `persona` | Title, persona type, seniority, KPIs, pain points, confidence |
| 4 | `claim` | Claim text, risk level, category, evidence tier, rationale, confidence |

For Phase 4 claims: if `confidence_score < 0.5`, the suggested `risk_level` defaults to `"conditional"` regardless of what the LLM suggested.

### R6: Frontend — Phase 5 Enhancement (Provenance in Review)

Modify `Phase5Review` to show provenance metadata for accepted suggestions.

**File:** `apps/ValyntApp/src/views/onboarding/Phase5Review.tsx` (modify)

For each accepted item in the review:
- Show a small badge: "AI-suggested" with confidence score
- Show source count (e.g., "from 2 sources")
- Expandable source URLs

On confirm, the `company_context_versions` snapshot includes:
- Which items were AI-suggested vs manually entered
- The research job ID
- Confidence scores for suggested items

### R7: Frontend — CompanyOnboarding Orchestration

Modify the parent `CompanyOnboarding` component to thread research job state through phases.

**File:** `apps/ValyntApp/src/views/CompanyOnboarding.tsx` (modify)

Changes:
1. Add `researchJobId` to component state
2. Pass `researchJobId` to Phase 2-4 components so they can query suggestions
3. On Phase 1 completion with auto-fill: set `researchJobId` before advancing to Phase 2
4. On Phase 1 completion without auto-fill: `researchJobId` remains null, phases render in manual-only mode

### R8: Type Definitions

Extend the existing type definitions for research jobs and suggestions.

**File:** `apps/ValyntApp/src/hooks/company-context/types.ts` (modify)

Add:
```typescript
export interface ResearchJob {
  id: string;
  tenant_id: string;
  context_id: string;
  input_website: string;
  input_industry: string | null;
  input_company_size: string | null;
  input_sales_motion: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: Record<string, 'pending' | 'running' | 'done' | 'failed'>;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type SuggestionEntityType = 'product' | 'competitor' | 'persona' | 'claim' | 'capability' | 'value_pattern';

export interface ResearchSuggestion {
  id: string;
  tenant_id: string;
  job_id: string;
  context_id: string;
  entity_type: SuggestionEntityType;
  payload: Record<string, unknown>;
  confidence_score: number;
  source_urls: string[];
  status: 'suggested' | 'accepted' | 'rejected' | 'edited';
  accepted_at: string | null;
  created_at: string;
}
```

## Files Changed (Summary)

### Created
| File | Purpose |
|---|---|
| `infra/supabase/supabase/migrations/_deferred/20260212000000_create_research_jobs.sql` | Research job + suggestion tables with RLS |
| `packages/backend/src/services/onboarding/ResearchJobWorker.ts` | BullMQ worker for research job processing |
| `packages/backend/src/services/onboarding/WebCrawler.ts` | Same-domain web crawler (homepage + 10 pages, 30s cap) |
| `packages/backend/src/services/onboarding/SuggestionExtractor.ts` | LLM-based entity extraction with Zod validation |
| `packages/backend/src/services/onboarding/index.ts` | Barrel exports |
| `packages/backend/src/api/onboarding.ts` | REST endpoints for research jobs and suggestions |
| `apps/ValyntApp/src/hooks/company-context/useResearchJob.ts` | React Query hooks for research job lifecycle |
| `apps/ValyntApp/src/components/onboarding/SuggestionCard.tsx` | Reusable Accept/Edit/Reject suggestion card |

### Modified
| File | Change |
|---|---|
| `apps/ValyntApp/src/views/CompanyOnboarding.tsx` | Thread `researchJobId` state through phases |
| `apps/ValyntApp/src/views/onboarding/Phase1Company.tsx` | Add "Auto-fill from website" button and progress UI |
| `apps/ValyntApp/src/views/onboarding/Phase2Competitors.tsx` | Render competitor suggestions with Accept/Edit/Reject |
| `apps/ValyntApp/src/views/onboarding/Phase3Personas.tsx` | Render persona suggestions with Accept/Edit/Reject |
| `apps/ValyntApp/src/views/onboarding/Phase4Claims.tsx` | Render claim suggestions with Accept/Edit/Reject, confidence-based risk defaulting |
| `apps/ValyntApp/src/views/onboarding/Phase5Review.tsx` | Show provenance badges and source links for accepted suggestions |
| `apps/ValyntApp/src/hooks/company-context/types.ts` | Add ResearchJob, ResearchSuggestion types |
| `apps/ValyntApp/src/hooks/company-context/useCompanyContext.ts` | Add useCompleteOnboarding enhancement to include research metadata in snapshot |

## Out of Scope

- External site triangulation (G2, LinkedIn, analyst blogs) — v2
- Competitive positioning analysis — v2
- Automated value hypothesis generation from onboarding data — v2
- Pre-built ROI model templates — v2
- Industry benchmark comparisons — v2
- Changes to the OnboardingGate or CompanyContextProvider logic
- Changes to existing RLS policies on the 8 company_* tables
- Changes to the auth flow (login, signup, OAuth)
- Mobile-specific UI adaptations

## Acceptance Criteria

### AC1: Research Job Lifecycle
- `POST /api/onboarding/research` creates a job with status `queued`
- The BullMQ worker picks up the job, transitions to `running`, and updates `progress` per entity type
- On completion, status is `completed` with suggestions written to `company_research_suggestions`
- On failure, status is `failed` with `error_message` populated
- Polling via `GET /api/onboarding/research/:jobId` returns current status and progress

### AC2: Web Crawling
- Crawler fetches the homepage and up to 10 same-domain linked pages
- Total crawl time does not exceed 30 seconds
- External domains are not followed
- Extracted text is stripped of HTML and capped at 50k characters

### AC3: Suggestion Extraction
- Each entity type (product, competitor, persona, claim, capability, value_pattern) is extracted via a separate LLM call
- Responses are Zod-validated against the target table's schema
- Each suggestion has a `confidence_score` (0-1) and `source_urls`
- Partial failures (one entity type fails) do not block other entity types

### AC4: Suggestion Accept/Reject
- Accepting a suggestion writes the payload to the corresponding `company_*` table
- Rejecting a suggestion marks it `rejected` (no DB write to target table)
- Editing a suggestion allows payload modification before acceptance
- Bulk accept writes multiple suggestions in a single request

### AC5: Phase 1 Auto-fill
- "Auto-fill from website" button appears when a website URL is entered
- Progress indicator shows per-entity-type status during research
- Products are pre-populated from suggestions when research completes
- Manual flow works unchanged when auto-fill is not used

### AC6: Phase 2-4 Suggestion Cards
- Suggestions render above manual entry with confidence badges and source counts
- Accept/Edit/Reject actions work correctly
- Accepted items appear in the confirmed list
- Manual entry remains fully functional alongside suggestions
- Claims with confidence < 0.5 default to `"conditional"` risk level

### AC7: Phase 5 Provenance
- Accepted suggestions show "AI-suggested" badge with confidence score
- Source URLs are expandable
- Version snapshot includes research job ID and per-item provenance

### AC8: Tenant Isolation
- Research jobs and suggestions are scoped to `tenant_id`
- RLS policies enforce tenant isolation on both new tables
- API endpoints validate tenant access from the authenticated session

### AC9: No Regressions
- Existing manual onboarding flow works unchanged when auto-fill is not used
- Skip onboarding still works
- OnboardingGate behavior is unchanged
- Existing company_* table data is not affected

### AC10: Capabilities and Value Patterns
- `company_capabilities` rows are generated from product descriptions
- `company_value_patterns` rows are generated from industry + persona + capability combinations
- Both are written as suggestions, not directly — user must accept them

## Implementation Order

1. **R1: Database migration** — tables must exist before anything else
2. **R8: Type definitions** — types needed by both frontend and backend
3. **R2: Research job worker** — backend processing pipeline (WebCrawler → SuggestionExtractor → DB writes)
4. **R3: API endpoints** — REST layer for frontend consumption
5. **R4: Phase 1 auto-fill** — trigger point for the research flow
6. **R5: Phase 2-4 suggestion cards** — suggestion rendering and accept/reject
7. **R6: Phase 5 provenance** — review enhancements
8. **R7: CompanyOnboarding orchestration** — thread state through all phases

## Completion Criteria

The spec is fully satisfied when:
1. All files listed in "Files Changed" are created or modified as specified
2. All 10 acceptance criteria (AC1-AC10) are satisfied
3. TypeScript compilation passes for modified packages
4. The manual onboarding flow continues to work without regressions
5. A research job can be created, polled, and its suggestions accepted through the UI

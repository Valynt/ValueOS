-- Migration: Research Jobs & Suggestions
-- Supports the agentic research-assisted onboarding pipeline.
-- Research jobs track async crawl+extract runs; suggestions hold
-- individual entity extractions pending user acceptance.

-- ============================================
-- 1. company_research_jobs
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_research_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    input_website TEXT NOT NULL,
    input_industry TEXT,
    input_company_size TEXT,
    input_sales_motion TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    progress JSONB DEFAULT '{}'::JSONB,
    entity_status JSONB DEFAULT '{}'::JSONB,
    pages_crawled INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    crawl_duration_ms INTEGER DEFAULT 0,
    llm_model TEXT,
    prompt_version TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_jobs_tenant ON public.company_research_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_context ON public.company_research_jobs(context_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON public.company_research_jobs(status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_research_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_research_jobs_updated_at ON public.company_research_jobs;
CREATE TRIGGER trg_research_jobs_updated_at
    BEFORE UPDATE ON public.company_research_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_research_jobs_updated_at();

-- ============================================
-- 2. company_research_suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_research_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    job_id UUID NOT NULL REFERENCES public.company_research_jobs(id) ON DELETE CASCADE,
    context_id UUID NOT NULL REFERENCES public.company_contexts(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL
        CHECK (entity_type IN ('product', 'competitor', 'persona', 'claim', 'capability', 'value_pattern')),
    payload JSONB NOT NULL,
    confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.5
        CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source_urls JSONB DEFAULT '[]'::JSONB,
    source_page_url TEXT,
    entity_hash TEXT,
    status TEXT NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'accepted', 'rejected', 'edited')),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_suggestions_tenant ON public.company_research_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_research_suggestions_job ON public.company_research_suggestions(job_id);
CREATE INDEX IF NOT EXISTS idx_research_suggestions_context ON public.company_research_suggestions(context_id);
CREATE INDEX IF NOT EXISTS idx_research_suggestions_entity_type ON public.company_research_suggestions(entity_type);
CREATE INDEX IF NOT EXISTS idx_research_suggestions_status ON public.company_research_suggestions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_research_suggestions_entity_hash ON public.company_research_suggestions(entity_hash) WHERE entity_hash IS NOT NULL;

-- ============================================
-- 3. RLS Policies
-- ============================================
ALTER TABLE public.company_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_research_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.company_research_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_research_suggestions FORCE ROW LEVEL SECURITY;

-- Jobs: tenant-scoped access
CREATE POLICY research_jobs_tenant_select ON public.company_research_jobs
    FOR SELECT USING (
        tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
        OR tenant_id = current_setting('app.current_tenant_id', true)
    );

CREATE POLICY research_jobs_tenant_insert ON public.company_research_jobs
    FOR INSERT WITH CHECK (
        tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
        OR tenant_id = current_setting('app.current_tenant_id', true)
    );

CREATE POLICY research_jobs_tenant_update ON public.company_research_jobs
    FOR UPDATE USING (
        tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
        OR tenant_id = current_setting('app.current_tenant_id', true)
    );

-- Suggestions: tenant-scoped access
CREATE POLICY research_suggestions_tenant_select ON public.company_research_suggestions
    FOR SELECT USING (
        tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
        OR tenant_id = current_setting('app.current_tenant_id', true)
    );

CREATE POLICY research_suggestions_tenant_insert ON public.company_research_suggestions
    FOR INSERT WITH CHECK (
        tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
        OR tenant_id = current_setting('app.current_tenant_id', true)
    );

CREATE POLICY research_suggestions_tenant_update ON public.company_research_suggestions
    FOR UPDATE USING (
        tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id'
        OR tenant_id = current_setting('app.current_tenant_id', true)
    );

-- Service role bypass for backend workers
CREATE POLICY research_jobs_service_all ON public.company_research_jobs
    FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY research_suggestions_service_all ON public.company_research_suggestions
    FOR ALL USING (current_setting('role', true) = 'service_role');

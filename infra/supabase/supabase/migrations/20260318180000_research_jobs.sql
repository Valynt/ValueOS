-- Onboarding Research Pipeline: Company Research Jobs and Suggestions
-- Creates tables for async web crawling and LLM-based entity extraction

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. company_research_jobs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_research_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL,
  context_id        uuid        NOT NULL,
  input_website     text        NOT NULL,
  input_industry    text,
  input_company_size text,
  input_sales_motion text,
  status            text        NOT NULL DEFAULT 'queued' 
                    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  progress          jsonb       NOT NULL DEFAULT '{}',
  started_at        timestamptz,
  completed_at      timestamptz,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_research_jobs IS 'Async research jobs for company onboarding data extraction';

CREATE INDEX IF NOT EXISTS idx_company_research_jobs_tenant_id
  ON public.company_research_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_research_jobs_context_id
  ON public.company_research_jobs (context_id);
CREATE INDEX IF NOT EXISTS idx_company_research_jobs_status
  ON public.company_research_jobs (status);

ALTER TABLE public.company_research_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_research_jobs_tenant_select
  ON public.company_research_jobs FOR SELECT
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY company_research_jobs_tenant_insert
  ON public.company_research_jobs FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY company_research_jobs_tenant_update
  ON public.company_research_jobs FOR UPDATE
  USING  (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY company_research_jobs_tenant_delete
  ON public.company_research_jobs FOR DELETE
  USING (security.user_has_tenant_access(tenant_id::text));

-- ============================================================================
-- 2. company_research_suggestions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_research_suggestions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL,
  job_id            uuid        NOT NULL REFERENCES public.company_research_jobs(id) ON DELETE CASCADE,
  context_id        uuid        NOT NULL,
  entity_type       text        NOT NULL 
                    CHECK (entity_type IN ('product', 'competitor', 'persona', 'claim', 'capability', 'value_pattern')),
  payload           jsonb       NOT NULL,
  confidence_score  numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_urls       jsonb       NOT NULL DEFAULT '[]',
  status            text        NOT NULL DEFAULT 'suggested' 
                    CHECK (status IN ('suggested', 'accepted', 'rejected', 'edited')),
  accepted_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_research_suggestions IS 'AI-suggested entities extracted from company research';

CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_tenant_id
  ON public.company_research_suggestions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_job_id
  ON public.company_research_suggestions (job_id);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_context_id
  ON public.company_research_suggestions (context_id);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_entity_type
  ON public.company_research_suggestions (entity_type);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_status
  ON public.company_research_suggestions (status);
CREATE INDEX IF NOT EXISTS idx_company_research_suggestions_job_entity
  ON public.company_research_suggestions (job_id, entity_type, status);

ALTER TABLE public.company_research_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_research_suggestions_tenant_select
  ON public.company_research_suggestions FOR SELECT
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY company_research_suggestions_tenant_insert
  ON public.company_research_suggestions FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY company_research_suggestions_tenant_update
  ON public.company_research_suggestions FOR UPDATE
  USING  (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY company_research_suggestions_tenant_delete
  ON public.company_research_suggestions FOR DELETE
  USING (security.user_has_tenant_access(tenant_id::text));

-- ============================================================================
-- 3. Trigger for updated_at on research jobs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_research_jobs_updated_at
  BEFORE UPDATE ON public.company_research_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

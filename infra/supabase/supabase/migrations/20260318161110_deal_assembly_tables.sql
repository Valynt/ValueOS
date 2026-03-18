-- Deal Assembly Pipeline: deal_contexts, deal_context_sources, stakeholders, use_cases tables
-- Stores assembled deal context with source tracking for value case discovery

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. deal_contexts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_contexts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  opportunity_id   text        NOT NULL,
  case_id          uuid,                     -- Link to value case once created
  assembled_at     timestamptz NOT NULL DEFAULT now(),
  status           text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewing', 'approved', 'archived')),
  context_json     jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_contexts_org_id
  ON public.deal_contexts (organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_contexts_opportunity_id
  ON public.deal_contexts (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_deal_contexts_case_id
  ON public.deal_contexts (case_id);
CREATE INDEX IF NOT EXISTS idx_deal_contexts_status
  ON public.deal_contexts (status);

ALTER TABLE public.deal_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_contexts_tenant_select
  ON public.deal_contexts FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY deal_contexts_tenant_insert
  ON public.deal_contexts FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY deal_contexts_tenant_update
  ON public.deal_contexts FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY deal_contexts_tenant_delete
  ON public.deal_contexts FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 2. deal_context_sources table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_context_sources (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  deal_context_id  uuid        NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
  source_type      text        NOT NULL CHECK (source_type IN (
    'customer-confirmed', 'crm-derived', 'call-derived', 'note-derived',
    'benchmark-derived', 'externally-researched', 'inferred', 'manually-overridden'
  )),
  source_url       text,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  fragment_hash    text        NOT NULL,
  metadata_json    jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_context_sources_org_id
  ON public.deal_context_sources (organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_context_sources_deal_context_id
  ON public.deal_context_sources (deal_context_id);
CREATE INDEX IF NOT EXISTS idx_deal_context_sources_source_type
  ON public.deal_context_sources (source_type);

ALTER TABLE public.deal_context_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_context_sources_tenant_select
  ON public.deal_context_sources FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY deal_context_sources_tenant_insert
  ON public.deal_context_sources FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY deal_context_sources_tenant_update
  ON public.deal_context_sources FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY deal_context_sources_tenant_delete
  ON public.deal_context_sources FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 3. stakeholders table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stakeholders (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  deal_context_id  uuid        NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  role             text        NOT NULL CHECK (role IN (
    'economic_buyer', 'champion', 'technical_evaluator', 'end_user', 'blocker', 'influencer', 'unknown'
  )),
  priority         integer     NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  source_type      text        NOT NULL CHECK (source_type IN (
    'customer-confirmed', 'crm-derived', 'call-derived', 'note-derived', 'inferred'
  )),
  contact_info_json jsonb     DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_org_id
  ON public.stakeholders (organization_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_deal_context_id
  ON public.stakeholders (deal_context_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_role
  ON public.stakeholders (role);

ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY stakeholders_tenant_select
  ON public.stakeholders FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY stakeholders_tenant_insert
  ON public.stakeholders FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY stakeholders_tenant_update
  ON public.stakeholders FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY stakeholders_tenant_delete
  ON public.stakeholders FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 4. use_cases table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.use_cases (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  deal_context_id  uuid        NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  description      text        NOT NULL,
  pain_signals     text[]      NOT NULL DEFAULT '{}',
  expected_outcomes text[]     NOT NULL DEFAULT '{}',
  source_type      text        NOT NULL CHECK (source_type IN (
    'customer-confirmed', 'crm-derived', 'call-derived', 'note-derived', 'inferred'
  )),
  priority         integer     DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_use_cases_org_id
  ON public.use_cases (organization_id);
CREATE INDEX IF NOT EXISTS idx_use_cases_deal_context_id
  ON public.use_cases (deal_context_id);

ALTER TABLE public.use_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY use_cases_tenant_select
  ON public.use_cases FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY use_cases_tenant_insert
  ON public.use_cases FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY use_cases_tenant_update
  ON public.use_cases FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY use_cases_tenant_delete
  ON public.use_cases FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 5. Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deal_contexts_updated_at
  BEFORE UPDATE ON public.deal_contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stakeholders_updated_at
  BEFORE UPDATE ON public.stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_use_cases_updated_at
  BEFORE UPDATE ON public.use_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

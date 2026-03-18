-- ============================================================================
-- Deal Assembly Pipeline — Deal Contexts, Stakeholders, and Use Cases
--
-- Stores assembled deal context from CRM, transcripts, notes, and research.
-- Enables agent-driven value case construction with full source attribution.
--
-- Tenant isolation: every row carries tenant_id (NOT NULL).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. deal_contexts — Assembled deal context per opportunity
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_contexts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    opportunity_id      uuid NOT NULL,
    case_id             uuid REFERENCES public.value_cases(id) ON DELETE SET NULL,
    assembled_at        timestamptz NOT NULL DEFAULT now(),
    status              text NOT NULL DEFAULT 'draft',
    context_json        jsonb NOT NULL DEFAULT '{}'::jsonb,
    source_summary      text,
    completeness_score  numeric(5,4) CHECK (completeness_score >= 0 AND completeness_score <= 1),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT deal_contexts_status_check CHECK (status IN ('draft', 'reviewing', 'approved', 'archived')),
    CONSTRAINT deal_contexts_opportunity_unique UNIQUE (tenant_id, opportunity_id)
);

COMMENT ON TABLE public.deal_contexts IS 'Assembled deal context from CRM, calls, notes, and research';

CREATE INDEX IF NOT EXISTS deal_contexts_tenant_opportunity_idx ON public.deal_contexts (tenant_id, opportunity_id);
CREATE INDEX IF NOT EXISTS deal_contexts_case_id_idx ON public.deal_contexts (case_id);
CREATE INDEX IF NOT EXISTS deal_contexts_status_idx ON public.deal_contexts (status);
CREATE INDEX IF NOT EXISTS deal_contexts_assembled_at_idx ON public.deal_contexts (assembled_at DESC);

-- ============================================================================
-- 2. deal_context_sources — Tracking for each ingested data source
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deal_context_sources (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    deal_context_id     uuid NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
    source_type         text NOT NULL,
    source_url          text,
    ingested_at         timestamptz NOT NULL DEFAULT now(),
    fragment_hash       text NOT NULL,
    fragment_summary    text,
    data_json           jsonb DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT deal_context_sources_type_check CHECK (source_type IN (
        'crm-opportunity', 'crm-account', 'crm-contact', 'call-transcript',
        'seller-notes', 'public-enrichment', 'user-upload', 'benchmark-reference'
    ))
);

COMMENT ON TABLE public.deal_context_sources IS 'Tracked sources for deal context assembly';

CREATE INDEX IF NOT EXISTS deal_context_sources_context_idx ON public.deal_context_sources (deal_context_id);
CREATE INDEX IF NOT EXISTS deal_context_sources_tenant_context_idx ON public.deal_context_sources (tenant_id, deal_context_id);
CREATE INDEX IF NOT EXISTS deal_context_sources_type_idx ON public.deal_context_sources (source_type);

-- ============================================================================
-- 3. stakeholders — Deal stakeholders with priorities
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stakeholders (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    deal_context_id     uuid NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
    name                text NOT NULL,
    role                text NOT NULL,
    title               text,
    priority            smallint NOT NULL DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
    source_type         text NOT NULL,
    influence_level     text CHECK (influence_level IN ('low', 'medium', 'high', 'decision-maker')),
    pain_points_json    jsonb DEFAULT '[]'::jsonb,
    goals_json          jsonb DEFAULT '[]'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stakeholders_source_type_check CHECK (source_type IN (
        'customer-confirmed', 'CRM-derived', 'call-derived', 'note-derived', 'inferred'
    ))
);

COMMENT ON TABLE public.stakeholders IS 'Stakeholders identified during deal assembly';

CREATE INDEX IF NOT EXISTS stakeholders_context_idx ON public.stakeholders (deal_context_id);
CREATE INDEX IF NOT EXISTS stakeholders_tenant_context_idx ON public.stakeholders (tenant_id, deal_context_id);
CREATE INDEX IF NOT EXISTS stakeholders_priority_idx ON public.stakeholders (priority DESC);

-- ============================================================================
-- 4. use_cases — Identified use cases with pain signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.use_cases (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    deal_context_id     uuid NOT NULL REFERENCES public.deal_contexts(id) ON DELETE CASCADE,
    name                text NOT NULL,
    description         text NOT NULL,
    pain_signals_json   jsonb NOT NULL DEFAULT '[]'::jsonb,
    priority            smallint NOT NULL DEFAULT 50,
    expected_outcomes_json jsonb DEFAULT '[]'::jsonb,
    source_type         text NOT NULL,
    value_driver_candidate boolean DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT use_cases_source_type_check CHECK (source_type IN (
        'customer-confirmed', 'CRM-derived', 'call-derived', 'note-derived', 'inferred'
    ))
);

COMMENT ON TABLE public.use_cases IS 'Use cases and pain points extracted during deal assembly';

CREATE INDEX IF NOT EXISTS use_cases_context_idx ON public.use_cases (deal_context_id);
CREATE INDEX IF NOT EXISTS use_cases_tenant_context_idx ON public.use_cases (tenant_id, deal_context_id);
CREATE INDEX IF NOT EXISTS use_cases_driver_candidate_idx ON public.use_cases (value_driver_candidate) WHERE value_driver_candidate = true;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.deal_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_context_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.use_cases ENABLE ROW LEVEL SECURITY;

-- deal_contexts RLS
CREATE POLICY "deal_contexts_select"
  ON public.deal_contexts FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "deal_contexts_insert"
  ON public.deal_contexts FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "deal_contexts_update"
  ON public.deal_contexts FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "deal_contexts_delete"
  ON public.deal_contexts FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

-- deal_context_sources RLS
CREATE POLICY "deal_context_sources_select"
  ON public.deal_context_sources FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "deal_context_sources_insert"
  ON public.deal_context_sources FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- stakeholders RLS
CREATE POLICY "stakeholders_select"
  ON public.stakeholders FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "stakeholders_insert"
  ON public.stakeholders FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "stakeholders_update"
  ON public.stakeholders FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "stakeholders_delete"
  ON public.stakeholders FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

-- use_cases RLS
CREATE POLICY "use_cases_select"
  ON public.use_cases FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "use_cases_insert"
  ON public.use_cases FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "use_cases_update"
  ON public.use_cases FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "use_cases_delete"
  ON public.use_cases FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.deal_contexts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_contexts TO authenticated;

GRANT ALL ON public.deal_context_sources TO service_role;
GRANT SELECT, INSERT ON public.deal_context_sources TO authenticated;

GRANT ALL ON public.stakeholders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stakeholders TO authenticated;

GRANT ALL ON public.use_cases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.use_cases TO authenticated;

COMMIT;

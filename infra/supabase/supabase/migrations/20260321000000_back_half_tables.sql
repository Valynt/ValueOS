-- Sprint 11: Back-half value loop tables.
-- Adds integrity_results, narrative_drafts, and realization_reports so
-- IntegrityAgent, NarrativeAgent, and RealizationAgent can persist their
-- outputs to first-class tables instead of relying on the in-memory store.

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. integrity_results
-- Stores IntegrityAgent validation output per case run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integrity_results (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid        NOT NULL,
  value_case_id         uuid        NOT NULL,
  session_id            uuid,
  claims                jsonb       NOT NULL DEFAULT '[]',
  veto_decision         text        CHECK (veto_decision IN ('pass', 'veto', 're_refine')),
  overall_score         numeric(4,3) CHECK (overall_score >= 0 AND overall_score <= 1),
  data_quality_score    numeric(4,3) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
  logic_score           numeric(4,3) CHECK (logic_score >= 0 AND logic_score <= 1),
  evidence_score        numeric(4,3) CHECK (evidence_score >= 0 AND evidence_score <= 1),
  hallucination_check   boolean,
  source_agent          text        NOT NULL DEFAULT 'IntegrityAgent',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_results_case_org
  ON public.integrity_results (value_case_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integrity_results_org
  ON public.integrity_results (organization_id);

ALTER TABLE public.integrity_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrity_results_tenant_select
  ON public.integrity_results FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY integrity_results_tenant_insert
  ON public.integrity_results FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY integrity_results_tenant_update
  ON public.integrity_results FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY integrity_results_tenant_delete
  ON public.integrity_results FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 2. narrative_drafts
-- Stores NarrativeAgent output per case run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.narrative_drafts (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid        NOT NULL,
  value_case_id             uuid        NOT NULL,
  session_id                uuid,
  content                   text        NOT NULL DEFAULT '',
  format                    text        NOT NULL DEFAULT 'executive_summary'
                              CHECK (format IN ('executive_summary', 'technical', 'board_deck', 'customer_facing')),
  defense_readiness_score   numeric(4,3) CHECK (defense_readiness_score >= 0 AND defense_readiness_score <= 1),
  hallucination_check       boolean,
  source_agent              text        NOT NULL DEFAULT 'NarrativeAgent',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_narrative_drafts_case_org
  ON public.narrative_drafts (value_case_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_narrative_drafts_org
  ON public.narrative_drafts (organization_id);

ALTER TABLE public.narrative_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY narrative_drafts_tenant_select
  ON public.narrative_drafts FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY narrative_drafts_tenant_insert
  ON public.narrative_drafts FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY narrative_drafts_tenant_update
  ON public.narrative_drafts FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY narrative_drafts_tenant_delete
  ON public.narrative_drafts FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 3. realization_reports
-- Stores RealizationAgent output per case run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.realization_reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL,
  value_case_id     uuid        NOT NULL,
  session_id        uuid,
  kpis              jsonb       NOT NULL DEFAULT '[]',
  milestones        jsonb       NOT NULL DEFAULT '[]',
  risks             jsonb       NOT NULL DEFAULT '[]',
  variance_analysis jsonb       NOT NULL DEFAULT '{}',
  hallucination_check boolean,
  source_agent      text        NOT NULL DEFAULT 'RealizationAgent',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realization_reports_case_org
  ON public.realization_reports (value_case_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_realization_reports_org
  ON public.realization_reports (organization_id);

ALTER TABLE public.realization_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY realization_reports_tenant_select
  ON public.realization_reports FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY realization_reports_tenant_insert
  ON public.realization_reports FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY realization_reports_tenant_update
  ON public.realization_reports FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY realization_reports_tenant_delete
  ON public.realization_reports FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- Trust Layer: provenance_records table for claim lineage tracking
-- Stores audit trail of how every calculated figure was derived

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. provenance_records table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.provenance_records (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        NOT NULL,
  case_id            uuid        NOT NULL,
  claim_id           text        NOT NULL,
  data_source        text        NOT NULL,
  formula            text,
  agent_id           text        NOT NULL,
  agent_version      text        NOT NULL,
  evidence_tier      integer     NOT NULL CHECK (evidence_tier IN (1, 2, 3)),
  confidence_score   numeric     NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  parent_record_id   uuid        REFERENCES public.provenance_records(id),
  metadata_json      jsonb       NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provenance_records_org_id
  ON public.provenance_records (organization_id);
CREATE INDEX IF NOT EXISTS idx_provenance_records_case_id
  ON public.provenance_records (case_id);
CREATE INDEX IF NOT EXISTS idx_provenance_records_claim_id
  ON public.provenance_records (claim_id);
CREATE INDEX IF NOT EXISTS idx_provenance_records_parent_id
  ON public.provenance_records (parent_record_id);

-- RLS (append-only table - no UPDATE or DELETE)
ALTER TABLE public.provenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY provenance_records_tenant_select
  ON public.provenance_records FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY provenance_records_tenant_insert
  ON public.provenance_records FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

-- No UPDATE or DELETE policies - provenance is immutable

-- ============================================================================
-- 2. case_readiness_scores table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.case_readiness_scores (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              uuid        NOT NULL,
  case_id                      uuid        NOT NULL UNIQUE,
  composite_score              numeric     NOT NULL CHECK (composite_score >= 0 AND composite_score <= 1),
  is_presentation_ready        boolean     NOT NULL DEFAULT false,
  validation_rate              numeric     NOT NULL,
  mean_grounding_score         numeric     NOT NULL,
  benchmark_coverage_pct       numeric     NOT NULL,
  unsupported_assumption_count integer     NOT NULL DEFAULT 0,
  blockers_json              jsonb       NOT NULL DEFAULT '[]',
  calculated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_readiness_scores_org_id
  ON public.case_readiness_scores (organization_id);
CREATE INDEX IF NOT EXISTS idx_case_readiness_scores_case_id
  ON public.case_readiness_scores (case_id);
CREATE INDEX IF NOT EXISTS idx_case_readiness_scores_presentation_ready
  ON public.case_readiness_scores (is_presentation_ready);

ALTER TABLE public.case_readiness_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_readiness_scores_tenant_select
  ON public.case_readiness_scores FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY case_readiness_scores_tenant_insert
  ON public.case_readiness_scores FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY case_readiness_scores_tenant_update
  ON public.case_readiness_scores FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY case_readiness_scores_tenant_delete
  ON public.case_readiness_scores FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 3. plausibility_classifications table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plausibility_classifications (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL,
  case_id            uuid        NOT NULL,
  kpi_name           text        NOT NULL,
  current_value      numeric     NOT NULL,
  proposed_value     numeric     NOT NULL,
  improvement_pct    numeric     NOT NULL,
  classification     text        NOT NULL CHECK (classification IN ('plausible', 'aggressive', 'unrealistic')),
  benchmark_p25      numeric     NOT NULL,
  benchmark_p50      numeric     NOT NULL,
  benchmark_p75      numeric     NOT NULL,
  benchmark_p90      numeric     NOT NULL,
  benchmark_source   text        NOT NULL,
  benchmark_date     timestamptz NOT NULL,
  sample_size        integer     NOT NULL,
  confidence         numeric     NOT NULL,
  calculated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plausibility_classifications_org_id
  ON public.plausibility_classifications (organization_id);
CREATE INDEX IF NOT EXISTS idx_plausibility_classifications_case_id
  ON public.plausibility_classifications (case_id);

ALTER TABLE public.plausibility_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY plausibility_classifications_tenant_select
  ON public.plausibility_classifications FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY plausibility_classifications_tenant_insert
  ON public.plausibility_classifications FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY plausibility_classifications_tenant_update
  ON public.plausibility_classifications FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY plausibility_classifications_tenant_delete
  ON public.plausibility_classifications FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- Value-Modeling Engine: assumptions and scenarios tables
-- Creates tables for storing value case assumptions and financial scenarios

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. assumptions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assumptions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL,
  case_id              uuid        NOT NULL,
  name                 text        NOT NULL,
  value                numeric     NOT NULL,
  unit                 text,
  source_type          text        NOT NULL CHECK (source_type IN (
    'customer-confirmed', 'crm-derived', 'call-derived', 'note-derived',
    'benchmark-derived', 'externally-researched', 'inferred', 'manually-overridden'
  )),
  confidence_score     numeric     NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  benchmark_reference_id uuid,
  original_value       numeric,
  overridden_by_user_id uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assumptions_org_id
  ON public.assumptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_case_id
  ON public.assumptions (case_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_source_type
  ON public.assumptions (source_type);

-- RLS
ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY assumptions_tenant_select
  ON public.assumptions FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY assumptions_tenant_insert
  ON public.assumptions FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY assumptions_tenant_update
  ON public.assumptions FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY assumptions_tenant_delete
  ON public.assumptions FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 2. scenarios table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scenarios (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL,
  case_id              uuid        NOT NULL,
  scenario_type        text        NOT NULL CHECK (scenario_type IN ('conservative', 'base', 'upside')),
  assumptions_snapshot_json jsonb   NOT NULL DEFAULT '{}',
  roi                  numeric,
  npv                  numeric,
  payback_months       numeric,
  evf_decomposition_json jsonb     NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scenarios_org_id
  ON public.scenarios (organization_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_case_id
  ON public.scenarios (case_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_case_scenario_type
  ON public.scenarios (case_id, scenario_type);

-- RLS
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY scenarios_tenant_select
  ON public.scenarios FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY scenarios_tenant_insert
  ON public.scenarios FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY scenarios_tenant_update
  ON public.scenarios FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY scenarios_tenant_delete
  ON public.scenarios FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 3. Trigger for updated_at on assumptions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assumptions_updated_at
  BEFORE UPDATE ON public.assumptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

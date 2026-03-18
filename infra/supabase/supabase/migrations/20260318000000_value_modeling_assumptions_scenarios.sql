-- ============================================================================
-- Value Modeling Engine — Assumptions and Scenarios tables
--
-- Supports multi-scenario value modeling with assumption tracking,
-- sensitivity analysis, and baseline establishment.
--
-- Tenant isolation: every row carries organization_id (NOT NULL).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. assumptions — Central assumption register for value cases
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assumptions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    case_id             uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    name                text NOT NULL,
    value               numeric NOT NULL,
    unit                text NOT NULL,
    source_type         text NOT NULL,
    confidence_score    numeric(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    benchmark_reference_id uuid,
    original_value      numeric,
    overridden_by_user_id uuid REFERENCES public.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT assumptions_source_type_check CHECK (source_type IN (
        'customer-confirmed', 'CRM-derived', 'call-derived', 'note-derived',
        'benchmark-derived', 'externally-researched', 'inferred', 'manually-overridden'
    ))
);

COMMENT ON TABLE public.assumptions IS 'Central register of value case assumptions with source classification';

CREATE INDEX IF NOT EXISTS assumptions_tenant_case_idx ON public.assumptions (tenant_id, case_id);
CREATE INDEX IF NOT EXISTS assumptions_case_id_idx ON public.assumptions (case_id);
CREATE INDEX IF NOT EXISTS assumptions_source_type_idx ON public.assumptions (source_type);

-- ============================================================================
-- 2. scenarios — Multi-scenario financial modeling storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scenarios (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    case_id             uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    scenario_type       text NOT NULL,
    assumptions_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    roi                 numeric(10,4),
    npv                 numeric(15,2),
    payback_months      numeric(6,2),
    evf_decomposition_json jsonb DEFAULT '{}'::jsonb,
    sensitivity_results_json jsonb DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT scenarios_scenario_type_check CHECK (scenario_type IN ('conservative', 'base', 'upside'))
);

COMMENT ON TABLE public.scenarios IS 'Multi-scenario financial modeling results (conservative/base/upside)';

CREATE INDEX IF NOT EXISTS scenarios_tenant_case_idx ON public.scenarios (tenant_id, case_id);
CREATE INDEX IF NOT EXISTS scenarios_case_type_idx ON public.scenarios (case_id, scenario_type);

-- ============================================================================
-- 3. sensitivity_analysis — Top leverage assumptions per scenario
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sensitivity_analysis (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    scenario_id         uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
    assumption_id       uuid NOT NULL REFERENCES public.assumptions(id) ON DELETE CASCADE,
    rank                smallint NOT NULL CHECK (rank > 0 AND rank <= 10),
    impact_variance     numeric(10,4) NOT NULL,
    direction           text NOT NULL CHECK (direction IN ('positive', 'negative')),
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sensitivity_analysis IS 'Top leverage assumptions by scenario for sensitivity reporting';

CREATE INDEX IF NOT EXISTS sensitivity_analysis_scenario_idx ON public.sensitivity_analysis (scenario_id);
CREATE INDEX IF NOT EXISTS sensitivity_analysis_tenant_scenario_idx ON public.sensitivity_analysis (tenant_id, scenario_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitivity_analysis ENABLE ROW LEVEL SECURITY;

-- assumptions RLS
CREATE POLICY "assumptions_select"
  ON public.assumptions FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "assumptions_insert"
  ON public.assumptions FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "assumptions_update"
  ON public.assumptions FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "assumptions_delete"
  ON public.assumptions FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

-- scenarios RLS
CREATE POLICY "scenarios_select"
  ON public.scenarios FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "scenarios_insert"
  ON public.scenarios FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "scenarios_update"
  ON public.scenarios FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "scenarios_delete"
  ON public.scenarios FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

-- sensitivity_analysis RLS
CREATE POLICY "sensitivity_analysis_select"
  ON public.sensitivity_analysis FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "sensitivity_analysis_insert"
  ON public.sensitivity_analysis FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "sensitivity_analysis_update"
  ON public.sensitivity_analysis FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "sensitivity_analysis_delete"
  ON public.sensitivity_analysis FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.assumptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assumptions TO authenticated;

GRANT ALL ON public.scenarios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;

GRANT ALL ON public.sensitivity_analysis TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensitivity_analysis TO authenticated;

COMMIT;

-- ============================================================================
-- Promise Baseline Handoff — Baselines, KPI Targets, and Checkpoints
--
-- Stores the handoff from sales to customer success: approved baselines,
-- KPI targets, and measurement checkpoints.
--
-- Tenant isolation: every row carries tenant_id (NOT NULL).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. promise_baselines — Immutable baseline from approved scenario
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promise_baselines (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    case_id             uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    scenario_id         uuid REFERENCES public.scenarios(id),
    scenario_type       text NOT NULL,
    status              text NOT NULL DEFAULT 'active',
    created_by_user_id  uuid NOT NULL REFERENCES public.users(id),
    approved_at         timestamptz,
    handoff_notes       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    superseded_at       timestamptz,
    superseded_by_id    uuid REFERENCES public.promise_baselines(id),
    CONSTRAINT promise_baselines_scenario_type_check CHECK (scenario_type IN ('conservative', 'base', 'upside')),
    CONSTRAINT promise_baselines_status_check CHECK (status IN ('active', 'amended', 'archived'))
);

COMMENT ON TABLE public.promise_baselines IS 'Immutable baseline created from approved value case scenario';

CREATE INDEX IF NOT EXISTS promise_baselines_tenant_case_idx ON public.promise_baselines (tenant_id, case_id);
CREATE INDEX IF NOT EXISTS promise_baselines_case_id_idx ON public.promise_baselines (case_id);
CREATE INDEX IF NOT EXISTS promise_baselines_status_idx ON public.promise_baselines (status);

-- ============================================================================
-- 2. promise_kpi_targets — KPI targets for realization tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promise_kpi_targets (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    baseline_id         uuid NOT NULL REFERENCES public.promise_baselines(id) ON DELETE CASCADE,
    metric_name         text NOT NULL,
    baseline_value      numeric NOT NULL,
    target_value        numeric NOT NULL,
    unit                text NOT NULL,
    timeline_months     smallint NOT NULL,
    source_classification text NOT NULL,
    confidence_score    numeric(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    benchmark_reference_id uuid,
    value_driver_id     uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT promise_kpi_targets_source_check CHECK (source_classification IN (
        'customer-confirmed', 'CRM-derived', 'call-derived', 'note-derived',
        'benchmark-derived', 'externally-researched', 'inferred', 'manually-overridden'
    ))
);

COMMENT ON TABLE public.promise_kpi_targets IS 'KPI targets extracted from approved value case for realization tracking';

CREATE INDEX IF NOT EXISTS promise_kpi_targets_baseline_idx ON public.promise_kpi_targets (baseline_id);
CREATE INDEX IF NOT EXISTS promise_kpi_targets_tenant_baseline_idx ON public.promise_kpi_targets (tenant_id, baseline_id);
CREATE INDEX IF NOT EXISTS promise_kpi_targets_metric_idx ON public.promise_kpi_targets (metric_name);

-- ============================================================================
-- 3. promise_checkpoints — Scheduled measurement checkpoints
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promise_checkpoints (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    baseline_id         uuid NOT NULL REFERENCES public.promise_baselines(id) ON DELETE CASCADE,
    kpi_target_id       uuid NOT NULL REFERENCES public.promise_kpi_targets(id) ON DELETE CASCADE,
    measurement_date    date NOT NULL,
    expected_value_min  numeric,
    expected_value_max  numeric,
    actual_value        numeric,
    data_source_for_actuals text,
    status              text NOT NULL DEFAULT 'pending',
    measured_at         timestamptz,
    measured_by_user_id uuid REFERENCES public.users(id),
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT promise_checkpoints_status_check CHECK (status IN ('pending', 'measured', 'missed', 'exceeded'))
);

COMMENT ON TABLE public.promise_checkpoints IS 'Scheduled checkpoints for KPI realization measurement';

CREATE INDEX IF NOT EXISTS promise_checkpoints_kpi_target_idx ON public.promise_checkpoints (kpi_target_id);
CREATE INDEX IF NOT EXISTS promise_checkpoints_baseline_idx ON public.promise_checkpoints (baseline_id);
CREATE INDEX IF NOT EXISTS promise_checkpoints_tenant_baseline_idx ON public.promise_checkpoints (tenant_id, baseline_id);
CREATE INDEX IF NOT EXISTS promise_checkpoints_date_idx ON public.promise_checkpoints (measurement_date);
CREATE INDEX IF NOT EXISTS promise_checkpoints_status_idx ON public.promise_checkpoints (status);

-- ============================================================================
-- 4. promise_handoff_notes — Structured handoff notes sections
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promise_handoff_notes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    baseline_id         uuid NOT NULL REFERENCES public.promise_baselines(id) ON DELETE CASCADE,
    section             text NOT NULL,
    content_text        text NOT NULL,
    generated_by_agent  boolean DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT promise_handoff_notes_section_check CHECK (section IN (
        'deal_context', 'buyer_priorities', 'implementation_assumptions', 'key_risks'
    ))
);

COMMENT ON TABLE public.promise_handoff_notes IS 'Structured handoff notes for CS team context';

CREATE INDEX IF NOT EXISTS promise_handoff_notes_baseline_idx ON public.promise_handoff_notes (baseline_id);
CREATE INDEX IF NOT EXISTS promise_handoff_notes_tenant_baseline_idx ON public.promise_handoff_notes (tenant_id, baseline_id);
CREATE INDEX IF NOT EXISTS promise_handoff_notes_section_idx ON public.promise_handoff_notes (section);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.promise_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promise_kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promise_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promise_handoff_notes ENABLE ROW LEVEL SECURITY;

-- promise_baselines RLS
CREATE POLICY "promise_baselines_select"
  ON public.promise_baselines FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "promise_baselines_insert"
  ON public.promise_baselines FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "promise_baselines_update"
  ON public.promise_baselines FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- promise_kpi_targets RLS
CREATE POLICY "promise_kpi_targets_select"
  ON public.promise_kpi_targets FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "promise_kpi_targets_insert"
  ON public.promise_kpi_targets FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- promise_checkpoints RLS
CREATE POLICY "promise_checkpoints_select"
  ON public.promise_checkpoints FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "promise_checkpoints_insert"
  ON public.promise_checkpoints FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "promise_checkpoints_update"
  ON public.promise_checkpoints FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- promise_handoff_notes RLS
CREATE POLICY "promise_handoff_notes_select"
  ON public.promise_handoff_notes FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "promise_handoff_notes_insert"
  ON public.promise_handoff_notes FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.promise_baselines TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.promise_baselines TO authenticated;

GRANT ALL ON public.promise_kpi_targets TO service_role;
GRANT SELECT, INSERT ON public.promise_kpi_targets TO authenticated;

GRANT ALL ON public.promise_checkpoints TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.promise_checkpoints TO authenticated;

GRANT ALL ON public.promise_handoff_notes TO service_role;
GRANT SELECT, INSERT ON public.promise_handoff_notes TO authenticated;

COMMIT;

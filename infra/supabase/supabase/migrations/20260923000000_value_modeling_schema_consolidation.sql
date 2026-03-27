-- =============================================================================
-- Value Modeling Schema Consolidation
--
-- Resolves all schema/migration conflicts identified in the Manus AI review:
--   1. Creates value_hypotheses (missing from all prior migrations)
--   2. Normalizes assumptions to organization_id + strict FK + lowercase enum
--   3. Creates scenarios, sensitivity_analysis normalized to organization_id
--   4. Creates promise_baselines, promise_kpi_targets, promise_checkpoints,
--      promise_handoff_notes normalized to organization_id
--   5. Fixes source_type / source_classification CHECK constraints to lowercase
--
-- Idempotent: safe to apply against zero-state or partially-drifted envs.
-- Append-only: does not modify prior migration files.
-- =============================================================================

SET search_path = public, pg_temp;

BEGIN;

-- =============================================================================
-- PART 1: value_hypotheses
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.value_hypotheses (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid        NOT NULL,
    case_id                 uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    value_driver            text        NOT NULL CHECK (char_length(value_driver) BETWEEN 1 AND 255),
    description             text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
    estimated_impact_min    numeric     NOT NULL,
    estimated_impact_max    numeric     NOT NULL,
    impact_unit             text        NOT NULL CHECK (char_length(impact_unit) <= 50),
    evidence_tier           smallint    NOT NULL CHECK (evidence_tier BETWEEN 1 AND 3),
    confidence_score        numeric     NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    benchmark_reference_id  uuid,
    status                  text        NOT NULL DEFAULT 'pending' CHECK (status IN (
                                            'pending', 'accepted', 'rejected', 'modified'
                                        )),
    source_context_ids      uuid[]      NOT NULL DEFAULT '{}',
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_hypotheses_org_case
    ON public.value_hypotheses (organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_value_hypotheses_case_status
    ON public.value_hypotheses (case_id, status);

ALTER TABLE public.value_hypotheses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS value_hypotheses_select ON public.value_hypotheses;
CREATE POLICY value_hypotheses_select
    ON public.value_hypotheses FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS value_hypotheses_insert ON public.value_hypotheses;
CREATE POLICY value_hypotheses_insert
    ON public.value_hypotheses FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS value_hypotheses_update ON public.value_hypotheses;
CREATE POLICY value_hypotheses_update
    ON public.value_hypotheses FOR UPDATE
    USING  (security.user_has_tenant_access(organization_id))
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS value_hypotheses_delete ON public.value_hypotheses;
CREATE POLICY value_hypotheses_delete
    ON public.value_hypotheses FOR DELETE
    USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.value_hypotheses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.value_hypotheses TO authenticated;

-- =============================================================================
-- PART 2: assumptions — normalize to organization_id + strict FK + lowercase enum
--
-- The schema snapshot contains a legacy polymorphic assumptions table
-- (related_table/related_id, no source_type, no organization_id).
-- The 20260318000000 migration created a different assumptions table with
-- tenant_id and uppercase 'CRM-derived'.
-- The 20260318160647 migration created yet another version with organization_id
-- but no sensitivity_analysis table.
--
-- Strategy: drop and recreate with the canonical definition.
-- Data loss is acceptable — the legacy table schema is incompatible with the
-- application code and no valid data can exist in it.
-- =============================================================================

DROP TABLE IF EXISTS public.sensitivity_analysis CASCADE;
DROP TABLE IF EXISTS public.scenarios CASCADE;
DROP TABLE IF EXISTS public.assumptions CASCADE;

CREATE TABLE public.assumptions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid        NOT NULL,
    case_id                 uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    name                    text        NOT NULL,
    value                   numeric     NOT NULL,
    unit                    text,
    source_type             text        NOT NULL CHECK (source_type IN (
                                            'customer-confirmed',
                                            'crm-derived',
                                            'call-derived',
                                            'note-derived',
                                            'benchmark-derived',
                                            'externally-researched',
                                            'inferred',
                                            'manually-overridden'
                                        )),
    confidence_score        numeric     NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    benchmark_reference_id  uuid,
    original_value          numeric,
    overridden_by_user_id   uuid        REFERENCES public.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assumptions_org_case
    ON public.assumptions (organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_assumptions_case_id
    ON public.assumptions (case_id);

CREATE INDEX IF NOT EXISTS idx_assumptions_source_type
    ON public.assumptions (source_type);

ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assumptions_select ON public.assumptions;
CREATE POLICY assumptions_select
    ON public.assumptions FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS assumptions_insert ON public.assumptions;
CREATE POLICY assumptions_insert
    ON public.assumptions FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS assumptions_update ON public.assumptions;
CREATE POLICY assumptions_update
    ON public.assumptions FOR UPDATE
    USING  (security.user_has_tenant_access(organization_id))
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS assumptions_delete ON public.assumptions;
CREATE POLICY assumptions_delete
    ON public.assumptions FOR DELETE
    USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.assumptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assumptions TO authenticated;

-- =============================================================================
-- PART 3: scenarios — with cost/timeline provenance columns
-- =============================================================================

CREATE TABLE public.scenarios (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id             uuid        NOT NULL,
    case_id                     uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    scenario_type               text        NOT NULL CHECK (scenario_type IN ('conservative', 'base', 'upside')),
    assumptions_snapshot_json   jsonb       NOT NULL DEFAULT '{}',
    roi                         numeric,
    npv                         numeric,
    payback_months              numeric,
    evf_decomposition_json      jsonb       NOT NULL DEFAULT '{}',
    sensitivity_results_json    jsonb       NOT NULL DEFAULT '[]',
    -- Provenance: records what cost/timeline inputs were actually used
    cost_input_usd              numeric,
    timeline_years              numeric,
    investment_source           text        CHECK (investment_source IN ('explicit', 'assumptions_register', 'default')),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_org_case
    ON public.scenarios (organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_scenarios_case_type
    ON public.scenarios (case_id, scenario_type);

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scenarios_select ON public.scenarios;
CREATE POLICY scenarios_select
    ON public.scenarios FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS scenarios_insert ON public.scenarios;
CREATE POLICY scenarios_insert
    ON public.scenarios FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS scenarios_update ON public.scenarios;
CREATE POLICY scenarios_update
    ON public.scenarios FOR UPDATE
    USING  (security.user_has_tenant_access(organization_id))
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS scenarios_delete ON public.scenarios;
CREATE POLICY scenarios_delete
    ON public.scenarios FOR DELETE
    USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.scenarios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;

-- =============================================================================
-- PART 4: sensitivity_analysis
-- =============================================================================

CREATE TABLE public.sensitivity_analysis (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL,
    scenario_id     uuid        NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
    assumption_id   uuid        NOT NULL REFERENCES public.assumptions(id) ON DELETE CASCADE,
    rank            smallint    NOT NULL CHECK (rank > 0 AND rank <= 10),
    impact_variance numeric     NOT NULL,
    direction       text        NOT NULL CHECK (direction IN ('positive', 'negative')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensitivity_analysis_scenario
    ON public.sensitivity_analysis (scenario_id);

CREATE INDEX IF NOT EXISTS idx_sensitivity_analysis_org_scenario
    ON public.sensitivity_analysis (organization_id, scenario_id);

ALTER TABLE public.sensitivity_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sensitivity_analysis_select ON public.sensitivity_analysis;
CREATE POLICY sensitivity_analysis_select
    ON public.sensitivity_analysis FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS sensitivity_analysis_insert ON public.sensitivity_analysis;
CREATE POLICY sensitivity_analysis_insert
    ON public.sensitivity_analysis FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS sensitivity_analysis_update ON public.sensitivity_analysis;
CREATE POLICY sensitivity_analysis_update
    ON public.sensitivity_analysis FOR UPDATE
    USING  (security.user_has_tenant_access(organization_id))
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS sensitivity_analysis_delete ON public.sensitivity_analysis;
CREATE POLICY sensitivity_analysis_delete
    ON public.sensitivity_analysis FOR DELETE
    USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.sensitivity_analysis TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensitivity_analysis TO authenticated;

-- =============================================================================
-- PART 5: promise_baselines and related tables
--
-- Prior migration 20260318000300 used tenant_id throughout.
-- Recreate with organization_id. Drop cascade handles dependent tables.
-- =============================================================================

DROP TABLE IF EXISTS public.promise_handoff_notes CASCADE;
DROP TABLE IF EXISTS public.promise_checkpoints CASCADE;
DROP TABLE IF EXISTS public.promise_kpi_targets CASCADE;
DROP TABLE IF EXISTS public.promise_baselines CASCADE;

CREATE TABLE public.promise_baselines (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid        NOT NULL,
    case_id             uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    scenario_id         uuid        REFERENCES public.scenarios(id),
    scenario_type       text        NOT NULL CHECK (scenario_type IN ('conservative', 'base', 'upside')),
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'amended', 'archived')),
    created_by_user_id  uuid        NOT NULL REFERENCES public.users(id),
    approved_at         timestamptz,
    handoff_notes       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    superseded_at       timestamptz,
    superseded_by_id    uuid        REFERENCES public.promise_baselines(id)
);

CREATE INDEX IF NOT EXISTS idx_promise_baselines_org_case
    ON public.promise_baselines (organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_promise_baselines_status
    ON public.promise_baselines (status);

ALTER TABLE public.promise_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promise_baselines_select ON public.promise_baselines;
CREATE POLICY promise_baselines_select
    ON public.promise_baselines FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS promise_baselines_insert ON public.promise_baselines;
CREATE POLICY promise_baselines_insert
    ON public.promise_baselines FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS promise_baselines_update ON public.promise_baselines;
CREATE POLICY promise_baselines_update
    ON public.promise_baselines FOR UPDATE
    USING  (security.user_has_tenant_access(organization_id))
    WITH CHECK (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.promise_baselines TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.promise_baselines TO authenticated;

-- promise_kpi_targets — lowercase source_classification enum

CREATE TABLE public.promise_kpi_targets (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid        NOT NULL,
    baseline_id             uuid        NOT NULL REFERENCES public.promise_baselines(id) ON DELETE CASCADE,
    metric_name             text        NOT NULL,
    baseline_value          numeric     NOT NULL,
    target_value            numeric     NOT NULL,
    unit                    text        NOT NULL,
    timeline_months         smallint    NOT NULL,
    source_classification   text        NOT NULL CHECK (source_classification IN (
                                            'customer-confirmed',
                                            'crm-derived',
                                            'call-derived',
                                            'note-derived',
                                            'benchmark-derived',
                                            'externally-researched',
                                            'inferred',
                                            'manually-overridden'
                                        )),
    confidence_score        numeric     CHECK (confidence_score >= 0 AND confidence_score <= 1),
    benchmark_reference_id  uuid,
    value_driver_id         uuid,
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promise_kpi_targets_baseline
    ON public.promise_kpi_targets (baseline_id);

CREATE INDEX IF NOT EXISTS idx_promise_kpi_targets_org_baseline
    ON public.promise_kpi_targets (organization_id, baseline_id);

ALTER TABLE public.promise_kpi_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promise_kpi_targets_select ON public.promise_kpi_targets;
CREATE POLICY promise_kpi_targets_select
    ON public.promise_kpi_targets FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS promise_kpi_targets_insert ON public.promise_kpi_targets;
CREATE POLICY promise_kpi_targets_insert
    ON public.promise_kpi_targets FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.promise_kpi_targets TO service_role;
GRANT SELECT, INSERT ON public.promise_kpi_targets TO authenticated;

-- promise_checkpoints

CREATE TABLE public.promise_checkpoints (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid        NOT NULL,
    baseline_id             uuid        NOT NULL REFERENCES public.promise_baselines(id) ON DELETE CASCADE,
    kpi_target_id           uuid        NOT NULL REFERENCES public.promise_kpi_targets(id) ON DELETE CASCADE,
    measurement_date        date        NOT NULL,
    expected_value_min      numeric,
    expected_value_max      numeric,
    actual_value            numeric,
    data_source_for_actuals text,
    status                  text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'measured', 'missed', 'exceeded')),
    measured_at             timestamptz,
    measured_by_user_id     uuid        REFERENCES public.users(id),
    notes                   text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promise_checkpoints_baseline
    ON public.promise_checkpoints (baseline_id);

CREATE INDEX IF NOT EXISTS idx_promise_checkpoints_kpi_target
    ON public.promise_checkpoints (kpi_target_id);

CREATE INDEX IF NOT EXISTS idx_promise_checkpoints_date
    ON public.promise_checkpoints (measurement_date);

ALTER TABLE public.promise_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promise_checkpoints_select ON public.promise_checkpoints;
CREATE POLICY promise_checkpoints_select
    ON public.promise_checkpoints FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS promise_checkpoints_insert ON public.promise_checkpoints;
CREATE POLICY promise_checkpoints_insert
    ON public.promise_checkpoints FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS promise_checkpoints_update ON public.promise_checkpoints;
CREATE POLICY promise_checkpoints_update
    ON public.promise_checkpoints FOR UPDATE
    USING  (security.user_has_tenant_access(organization_id))
    WITH CHECK (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.promise_checkpoints TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.promise_checkpoints TO authenticated;

-- promise_handoff_notes

CREATE TABLE public.promise_handoff_notes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL,
    baseline_id     uuid        NOT NULL REFERENCES public.promise_baselines(id) ON DELETE CASCADE,
    section         text        NOT NULL CHECK (section IN (
                                    'deal_context', 'buyer_priorities',
                                    'implementation_assumptions', 'key_risks'
                                )),
    content_text        text        NOT NULL,
    generated_by_agent  boolean     DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promise_handoff_notes_baseline
    ON public.promise_handoff_notes (baseline_id);

ALTER TABLE public.promise_handoff_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promise_handoff_notes_select ON public.promise_handoff_notes;
CREATE POLICY promise_handoff_notes_select
    ON public.promise_handoff_notes FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS promise_handoff_notes_insert ON public.promise_handoff_notes;
CREATE POLICY promise_handoff_notes_insert
    ON public.promise_handoff_notes FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.promise_handoff_notes TO service_role;
GRANT SELECT, INSERT ON public.promise_handoff_notes TO authenticated;

-- =============================================================================
-- PART 6: updated_at triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'value_hypotheses', 'assumptions', 'scenarios', 'promise_checkpoints'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;
             CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;

COMMIT;

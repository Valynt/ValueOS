-- =============================================================================
-- opportunity_id FK alignment
--
-- The consolidated spec (§4) uses opportunity_id as the universal FK across
-- all core value objects. The value_modeling_schema_consolidation migration
-- (20260923) used case_id on value_hypotheses, assumptions, and scenarios.
--
-- Strategy: additive — add opportunity_id as a generated column that mirrors
-- case_id. This keeps all existing code working (case_id unchanged) while
-- new code written to the spec can use opportunity_id. A future migration
-- will drop case_id once all callers are updated.
--
-- Generated columns are used so the two columns are always in sync with zero
-- application-layer coordination required.
--
-- Spec reference: ValueOS Consolidated Spec §4 (all objects use opportunity_id)
-- =============================================================================

SET search_path = public, pg_temp;

BEGIN;

-- ── value_hypotheses ─────────────────────────────────────────────────────────

ALTER TABLE public.value_hypotheses
    ADD COLUMN IF NOT EXISTS opportunity_id uuid
        GENERATED ALWAYS AS (case_id) STORED;

CREATE INDEX IF NOT EXISTS idx_value_hypotheses_opportunity_id
    ON public.value_hypotheses (opportunity_id);

COMMENT ON COLUMN public.value_hypotheses.opportunity_id IS
    'Spec-aligned alias for case_id. Generated column — always equal to case_id. '
    'Use opportunity_id in new code; case_id will be dropped in a future migration.';

-- ── assumptions ──────────────────────────────────────────────────────────────

ALTER TABLE public.assumptions
    ADD COLUMN IF NOT EXISTS opportunity_id uuid
        GENERATED ALWAYS AS (case_id) STORED;

CREATE INDEX IF NOT EXISTS idx_assumptions_opportunity_id
    ON public.assumptions (opportunity_id);

COMMENT ON COLUMN public.assumptions.opportunity_id IS
    'Spec-aligned alias for case_id. Generated column — always equal to case_id. '
    'Use opportunity_id in new code; case_id will be dropped in a future migration.';

-- ── scenarios ────────────────────────────────────────────────────────────────

ALTER TABLE public.scenarios
    ADD COLUMN IF NOT EXISTS opportunity_id uuid
        GENERATED ALWAYS AS (case_id) STORED;

CREATE INDEX IF NOT EXISTS idx_scenarios_opportunity_id
    ON public.scenarios (opportunity_id);

COMMENT ON COLUMN public.scenarios.opportunity_id IS
    'Spec-aligned alias for case_id. Generated column — always equal to case_id. '
    'Use opportunity_id in new code; case_id will be dropped in a future migration.';

COMMIT;

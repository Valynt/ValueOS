-- =============================================================================
-- Drop FK from sensitivity_analysis.assumption_id → assumptions(id)
--
-- sensitivity_analysis rows are produced by SensitivityAnalyzer using
-- ephemeral assumption IDs that are never persisted to the assumptions table
-- (they are generated in-memory during scenario building). The FK therefore
-- always fails at insert time.
--
-- assumption_id is retained as a plain uuid column for soft-reference
-- traceability; enforcement is handled at the application layer.
-- =============================================================================

SET search_path = public, pg_temp;

BEGIN;

ALTER TABLE public.sensitivity_analysis
    DROP CONSTRAINT IF EXISTS sensitivity_analysis_assumption_id_fkey;

COMMIT;

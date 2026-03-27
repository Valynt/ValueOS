-- Rollback: restore FK from sensitivity_analysis.assumption_id → assumptions(id)
-- Only apply if the assumptions table exists and has the expected rows.

SET search_path = public, pg_temp;

BEGIN;

ALTER TABLE public.sensitivity_analysis
    ADD CONSTRAINT sensitivity_analysis_assumption_id_fkey
    FOREIGN KEY (assumption_id) REFERENCES public.assumptions(id) ON DELETE CASCADE;

COMMIT;

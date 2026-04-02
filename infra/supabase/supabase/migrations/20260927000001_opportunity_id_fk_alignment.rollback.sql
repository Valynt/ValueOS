-- Rollback: 20260927000001_opportunity_id_fk_alignment
-- Drops the opportunity_id generated columns and their indexes.

BEGIN;

DROP INDEX IF EXISTS public.idx_value_hypotheses_opportunity_id;
ALTER TABLE public.value_hypotheses DROP COLUMN IF EXISTS opportunity_id;

DROP INDEX IF EXISTS public.idx_assumptions_opportunity_id;
ALTER TABLE public.assumptions DROP COLUMN IF EXISTS opportunity_id;

DROP INDEX IF EXISTS public.idx_scenarios_opportunity_id;
ALTER TABLE public.scenarios DROP COLUMN IF EXISTS opportunity_id;

COMMIT;

-- Rollback: 20260927000000_pain_points
-- Removes the pain_points table and its trigger function.

BEGIN;

DROP TRIGGER IF EXISTS trg_pain_points_updated_at ON public.pain_points;
DROP FUNCTION IF EXISTS public.pain_points_set_updated_at();
DROP TABLE IF EXISTS public.pain_points;

COMMIT;

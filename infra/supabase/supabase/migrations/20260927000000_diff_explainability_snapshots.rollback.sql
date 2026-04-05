SET search_path = public, pg_temp;

BEGIN;

DROP TRIGGER IF EXISTS trg_diff_explainability_snapshots_updated_at ON public.diff_explainability_snapshots;
DROP FUNCTION IF EXISTS public.set_diff_explainability_snapshots_updated_at();
DROP TABLE IF EXISTS public.diff_explainability_snapshots;

COMMIT;

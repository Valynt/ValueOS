-- Rollback: value_integrity_violations
-- Reverses 20260919000000_value_integrity_violations.sql

SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_viv_updated_at ON public.value_integrity_violations;
DROP FUNCTION IF EXISTS public.set_viv_updated_at();
DROP TABLE IF EXISTS public.value_integrity_violations;

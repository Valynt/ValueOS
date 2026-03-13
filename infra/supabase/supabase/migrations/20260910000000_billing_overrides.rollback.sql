-- Rollback: 20260910000000_billing_overrides

BEGIN;

DROP TRIGGER IF EXISTS billing_overrides_updated_at ON public.billing_overrides;
DROP FUNCTION IF EXISTS public.billing_overrides_set_updated_at();
DROP TABLE IF EXISTS public.billing_overrides CASCADE;

COMMIT;

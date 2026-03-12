-- Rollback: pending_subscription_changes

DROP TRIGGER IF EXISTS psc_updated_at ON public.pending_subscription_changes;
DROP FUNCTION IF EXISTS public.set_psc_updated_at();
DROP TABLE IF EXISTS public.pending_subscription_changes;

SET search_path = public, pg_temp;

BEGIN;

DROP TABLE IF EXISTS public.pending_subscription_creations;
DROP TABLE IF EXISTS public.billing_credits_ledger;

COMMIT;

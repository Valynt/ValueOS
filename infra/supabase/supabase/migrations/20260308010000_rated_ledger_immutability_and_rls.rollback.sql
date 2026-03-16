-- Rollback: 20260308010000_rated_ledger_immutability_and_rls
-- Removes immutability triggers, guard function, and RLS policy from rated_ledger.

BEGIN;

DROP TRIGGER IF EXISTS rated_ledger_no_delete ON public.rated_ledger;
DROP TRIGGER IF EXISTS rated_ledger_no_update ON public.rated_ledger;
DROP FUNCTION IF EXISTS public.rated_ledger_prevent_mutation();
DROP POLICY IF EXISTS rated_ledger_tenant_read ON public.rated_ledger;

COMMIT;

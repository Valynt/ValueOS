-- ============================================================================
-- ROLLBACK: 20260308010000_rated_ledger_immutability_and_rls
-- Drops the immutability triggers and reverts the RLS policy on rated_ledger
-- to the original JWT-claim-only form.
-- ⚠️  Removing the immutability triggers allows mutations on rated_ledger.
--     Only apply as part of a full rollback sequence.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS rated_ledger_no_update ON public.rated_ledger;
DROP TRIGGER IF EXISTS rated_ledger_no_delete ON public.rated_ledger;
DROP FUNCTION IF EXISTS public.rated_ledger_prevent_mutation() CASCADE;

DROP POLICY IF EXISTS rated_ledger_tenant_read ON public.rated_ledger;

CREATE POLICY rated_ledger_tenant_read ON public.rated_ledger
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

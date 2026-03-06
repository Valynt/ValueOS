-- ============================================================================
-- Enforce rated_ledger immutability and fix its RLS policy
--
-- rated_ledger was declared append-only in comments but had no DB enforcement.
-- This migration adds a trigger that blocks UPDATE and DELETE, and replaces
-- the JWT-claim-only RLS policy with security.user_has_tenant_access().
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. Immutability trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rated_ledger_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION
        'rated_ledger is append-only: % on row id=% is forbidden',
        TG_OP, OLD.id
        USING ERRCODE = '55000'; -- object_not_in_prerequisite_state
    RETURN NULL;
END;
$$;

-- Prevent UPDATE
DROP TRIGGER IF EXISTS rated_ledger_no_update ON public.rated_ledger;
CREATE TRIGGER rated_ledger_no_update
    BEFORE UPDATE ON public.rated_ledger
    FOR EACH ROW EXECUTE FUNCTION public.rated_ledger_prevent_mutation();

-- Prevent DELETE
DROP TRIGGER IF EXISTS rated_ledger_no_delete ON public.rated_ledger;
CREATE TRIGGER rated_ledger_no_delete
    BEFORE DELETE ON public.rated_ledger
    FOR EACH ROW EXECUTE FUNCTION public.rated_ledger_prevent_mutation();

-- ============================================================================
-- 2. Fix JWT-claim-only RLS policy
-- ============================================================================

DROP POLICY IF EXISTS rated_ledger_tenant_read ON public.rated_ledger;

CREATE POLICY rated_ledger_tenant_read ON public.rated_ledger
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

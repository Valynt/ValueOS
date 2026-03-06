-- ============================================================================
-- ROLLBACK: 20260306000000_harden_provision_tenant_function
-- Reverts ownership and privilege changes on provision_tenant back to
-- the authenticated role being able to execute it.
-- Note: This weakens security — only apply during a full rollback sequence.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc AS p
    INNER JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'provision_tenant'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.provision_tenant(%s) FROM PUBLIC', fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.provision_tenant(%s) TO service_role', fn.args);
  END LOOP;
END $$;

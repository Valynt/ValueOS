-- ============================================================================
-- ROLLBACK: 20260304010000_provision_tenant_rpc
-- Drops the provision_tenant function.
-- Note: 20260306000000 and 20260307000000 replace this function; roll those
-- back first if they have been applied.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.provision_tenant(text, uuid) CASCADE;

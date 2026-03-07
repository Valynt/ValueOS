-- ============================================================================
-- ROLLBACK: 20260307000000_refresh_provision_tenant_rpc_contracts
-- Drops the refreshed provision_tenant function. The prior version from
-- 20260304010000 must be re-applied separately if needed.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.provision_tenant(text, uuid) CASCADE;

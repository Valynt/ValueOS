-- ============================================================================
-- ROLLBACK: 20260304000000_tenant_provisioning_workflow
-- Drops the tenant_provisioning_requests table and the
-- tenant_provisioning_workflow function.
-- ⚠️  All provisioning request records will be lost.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.tenant_provisioning_workflow(text, text, uuid, text, text, text, text) CASCADE;

DROP INDEX IF EXISTS public.idx_entitlement_snapshots_one_current_per_tenant;
DROP INDEX IF EXISTS public.idx_tenant_provisioning_requests_tenant_created;

DROP TABLE IF EXISTS public.tenant_provisioning_requests CASCADE;

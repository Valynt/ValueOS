-- ============================================================================
-- ROLLBACK: 20260304040000_tenant_execution_state
-- Drops tenant execution state and audit tables.
-- ⚠️  All execution pause/resume records will be lost.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.tenant_execution_state_audit CASCADE;
DROP TABLE IF EXISTS public.tenant_execution_state CASCADE;

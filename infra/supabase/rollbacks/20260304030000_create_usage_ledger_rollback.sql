-- ============================================================================
-- ROLLBACK: 20260304030000_create_usage_ledger
-- Drops the usage_ledger table.
-- ⚠️  All usage ledger records will be lost.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.usage_ledger CASCADE;

-- ============================================================================
-- ROLLBACK: 20260220000000_billing_v2_rated_ledger
-- Drops the rated_ledger table and its RLS policy.
-- ⚠️  All rated usage data will be lost.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.rated_ledger CASCADE;

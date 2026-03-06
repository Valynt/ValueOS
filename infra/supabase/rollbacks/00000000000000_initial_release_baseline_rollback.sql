-- ============================================================================
-- ROLLBACK: 00000000000000_initial_release_baseline
-- ⚠️  Destructive — drops all baseline billing/entitlement tables.
--     Only run to tear down a fresh environment; never run in production.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.entitlement_snapshots CASCADE;
DROP TABLE IF EXISTS public.billing_approval_requests CASCADE;
DROP TABLE IF EXISTS public.billing_approval_policies CASCADE;
DROP TABLE IF EXISTS public.usage_policies CASCADE;
DROP TABLE IF EXISTS public.billing_price_versions CASCADE;
DROP TABLE IF EXISTS public.billing_meters CASCADE;

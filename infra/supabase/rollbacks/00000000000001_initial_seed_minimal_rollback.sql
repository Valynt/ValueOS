-- ============================================================================
-- ROLLBACK: 00000000000001_initial_seed_minimal
-- Removes seed data inserted by the minimal seed migration.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- Seed migration inserts reference/lookup data only.
-- Truncate is safe here because this is reference data with no tenant rows.
-- Adjust WHERE clauses if the seed inserted specific known rows.
TRUNCATE public.billing_meters RESTART IDENTITY CASCADE;
TRUNCATE public.billing_price_versions RESTART IDENTITY CASCADE;

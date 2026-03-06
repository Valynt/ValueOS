-- ============================================================================
-- ROLLBACK: 20260227000000_domain_packs_v1
-- Drops domain pack tables, removes columns added to value_cases, and drops
-- helper functions introduced by this migration.
-- ⚠️  All domain pack data will be lost.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- Remove columns added to value_cases
ALTER TABLE public.value_cases
    DROP COLUMN IF EXISTS domain_pack_id,
    DROP COLUMN IF EXISTS domain_pack_overrides;

DROP INDEX IF EXISTS public.idx_value_cases_domain_pack;

-- Drop domain pack tables (CASCADE removes dependent policies/indexes)
DROP TABLE IF EXISTS public.domain_pack_assumptions CASCADE;
DROP TABLE IF EXISTS public.domain_pack_kpis CASCADE;
DROP TABLE IF EXISTS public.domain_packs CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.current_tenant_id() CASCADE;

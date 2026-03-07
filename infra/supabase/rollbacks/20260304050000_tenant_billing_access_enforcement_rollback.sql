-- ============================================================================
-- ROLLBACK: 20260304050000_tenant_billing_access_enforcement
-- Removes access enforcement columns from billing_customers and tenants,
-- and drops the associated indexes.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_billing_customers_tenant_access_mode;
DROP INDEX IF EXISTS public.idx_tenants_access_mode;

ALTER TABLE public.billing_customers
    DROP COLUMN IF EXISTS access_mode,
    DROP COLUMN IF EXISTS grace_period_enforcement,
    DROP COLUMN IF EXISTS grace_period_started_at,
    DROP COLUMN IF EXISTS grace_period_expires_at,
    DROP COLUMN IF EXISTS enforcement_reason,
    DROP COLUMN IF EXISTS enforcement_updated_at;

ALTER TABLE public.tenants
    DROP COLUMN IF EXISTS access_mode,
    DROP COLUMN IF EXISTS grace_period_enforcement,
    DROP COLUMN IF EXISTS grace_period_started_at,
    DROP COLUMN IF EXISTS grace_period_expires_at,
    DROP COLUMN IF EXISTS enforcement_reason,
    DROP COLUMN IF EXISTS enforcement_updated_at;

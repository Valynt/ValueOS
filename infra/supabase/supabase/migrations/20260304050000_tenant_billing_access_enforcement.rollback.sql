-- Rollback: 20260304050000_tenant_billing_access_enforcement.sql
-- Removes billing access enforcement columns from billing_customers and tenants,
-- drops the access_mode CHECK constraints, and drops the two indexes.

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_billing_customers_tenant_access_mode;
DROP INDEX IF EXISTS public.idx_tenants_access_mode;

ALTER TABLE public.billing_customers
  DROP CONSTRAINT IF EXISTS billing_customers_access_mode_check,
  DROP COLUMN IF EXISTS enforcement_updated_at,
  DROP COLUMN IF EXISTS enforcement_reason,
  DROP COLUMN IF EXISTS grace_period_expires_at,
  DROP COLUMN IF EXISTS grace_period_started_at,
  DROP COLUMN IF EXISTS grace_period_enforcement,
  DROP COLUMN IF EXISTS access_mode;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_access_mode_check,
  DROP COLUMN IF EXISTS enforcement_updated_at,
  DROP COLUMN IF EXISTS enforcement_reason,
  DROP COLUMN IF EXISTS grace_period_expires_at,
  DROP COLUMN IF EXISTS grace_period_started_at,
  DROP COLUMN IF EXISTS grace_period_enforcement,
  DROP COLUMN IF EXISTS access_mode;

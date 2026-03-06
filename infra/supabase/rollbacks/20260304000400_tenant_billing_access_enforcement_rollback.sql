-- Rollback: 20260304000400_tenant_billing_access_enforcement
-- Removes grace period enforcement columns and constraints added to billing_customers and tenants.
ALTER TABLE public.billing_customers
  DROP COLUMN IF EXISTS grace_period_enforcement,
  DROP COLUMN IF EXISTS grace_period_started_at,
  DROP COLUMN IF EXISTS grace_period_expires_at,
  DROP COLUMN IF EXISTS enforcement_reason,
  DROP COLUMN IF EXISTS enforcement_updated_at,
  DROP CONSTRAINT IF EXISTS billing_customers_grace_period_enforcement_check,
  DROP CONSTRAINT IF EXISTS billing_customers_grace_period_expires_at_check;
ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS grace_period_enforcement,
  DROP COLUMN IF EXISTS grace_period_started_at,
  DROP COLUMN IF EXISTS grace_period_expires_at,
  DROP COLUMN IF EXISTS enforcement_reason,
  DROP COLUMN IF EXISTS enforcement_updated_at,
  DROP CONSTRAINT IF EXISTS tenants_grace_period_enforcement_check,
  DROP CONSTRAINT IF EXISTS tenants_grace_period_expires_at_check;
DROP INDEX IF EXISTS public.idx_billing_customers_tenant_access_mode;
DROP INDEX IF EXISTS public.idx_tenants_access_mode;

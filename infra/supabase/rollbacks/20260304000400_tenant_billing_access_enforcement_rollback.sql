-- Rollback: 20260304000400_tenant_billing_access_enforcement
-- Removes access_mode columns and constraints added to billing_customers and tenants.
ALTER TABLE public.billing_customers
  DROP COLUMN IF EXISTS access_mode,
  DROP COLUMN IF EXISTS access_restricted_at,
  DROP COLUMN IF EXISTS access_restriction_reason;
ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS access_mode,
  DROP COLUMN IF EXISTS access_restricted_at,
  DROP COLUMN IF EXISTS access_restriction_reason;
DROP INDEX IF EXISTS public.idx_billing_customers_tenant_access_mode;
DROP INDEX IF EXISTS public.idx_tenants_access_mode;

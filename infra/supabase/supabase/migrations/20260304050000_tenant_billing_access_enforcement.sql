-- ============================================================================
-- Tenant Billing Access Enforcement State
-- Adds enforcement fields used by webhook-driven access control.
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.billing_customers
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'full_access',
  ADD COLUMN IF NOT EXISTS grace_period_enforcement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grace_period_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS enforcement_reason text,
  ADD COLUMN IF NOT EXISTS enforcement_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.billing_customers
  DROP CONSTRAINT IF EXISTS billing_customers_access_mode_check;

ALTER TABLE public.billing_customers
  ADD CONSTRAINT billing_customers_access_mode_check
  CHECK (access_mode IN ('full_access', 'grace_period', 'restricted'));

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'full_access',
  ADD COLUMN IF NOT EXISTS grace_period_enforcement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grace_period_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS enforcement_reason text,
  ADD COLUMN IF NOT EXISTS enforcement_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_access_mode_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_access_mode_check
  CHECK (access_mode IN ('full_access', 'grace_period', 'restricted'));

CREATE INDEX IF NOT EXISTS idx_billing_customers_tenant_access_mode
  ON public.billing_customers (tenant_id, access_mode);

CREATE INDEX IF NOT EXISTS idx_tenants_access_mode
  ON public.tenants (id, access_mode);

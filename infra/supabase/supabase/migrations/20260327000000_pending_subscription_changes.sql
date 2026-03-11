-- pending_subscription_changes
--
-- Intent log for subscription plan changes.
-- Written BEFORE any Stripe API call so mid-flight crashes are detectable
-- and recoverable by the reconciler in TransactionalSubscriptionService.
--
-- Status lifecycle:
--   pending → stripe_updated → completed
--   pending → failed
--   stripe_updated → needs_reconciliation → completed (via reconciler)

CREATE TABLE IF NOT EXISTS public.pending_subscription_changes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  subscription_id     uuid        NOT NULL,
  old_plan_tier       text        NOT NULL CHECK (old_plan_tier IN ('free', 'standard', 'enterprise')),
  new_plan_tier       text        NOT NULL CHECK (new_plan_tier IN ('free', 'standard', 'enterprise')),
  -- Stable idempotency key used for all Stripe calls in this change.
  -- Derived from (tenant_id, 'plan_change', change_id) so retries are safe.
  idempotency_key     text        NOT NULL UNIQUE,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN (
                                    'pending',
                                    'stripe_updated',
                                    'completed',
                                    'failed',
                                    'needs_reconciliation'
                                  )),
  stripe_updated_at   timestamptz,
  db_updated_at       timestamptz,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for the reconciler: find stale changes per tenant quickly.
CREATE INDEX IF NOT EXISTS idx_psc_tenant_status
  ON public.pending_subscription_changes (tenant_id, status)
  WHERE status IN ('pending', 'stripe_updated', 'needs_reconciliation');

-- Index for idempotency key lookups (already covered by UNIQUE, but explicit for clarity).
CREATE INDEX IF NOT EXISTS idx_psc_idempotency_key
  ON public.pending_subscription_changes (idempotency_key);

-- Auto-update updated_at on every row change.
CREATE OR REPLACE FUNCTION public.set_psc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER psc_updated_at
  BEFORE UPDATE ON public.pending_subscription_changes
  FOR EACH ROW EXECUTE FUNCTION public.set_psc_updated_at();

-- RLS: tenants can only see their own change records.
-- The reconciler runs as service_role and bypasses RLS.
ALTER TABLE public.pending_subscription_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY psc_tenant_select
  ON public.pending_subscription_changes FOR SELECT
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY psc_tenant_insert
  ON public.pending_subscription_changes FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY psc_tenant_update
  ON public.pending_subscription_changes FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

-- Service role needs explicit SELECT/INSERT/UPDATE for the reconciler.
GRANT SELECT, INSERT, UPDATE ON public.pending_subscription_changes TO service_role;

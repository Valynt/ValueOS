-- pending_subscription_creations
--
-- Intent log for subscription creation.
-- Written BEFORE any Stripe API call so mid-flight crashes are detectable
-- and recoverable by the reconciler.
--
-- Status lifecycle:
--   pending → stripe_created → completed
--   pending → failed                        (Stripe call failed; nothing to roll back)
--   stripe_created → needs_reconciliation   (DB insert failed, rollback also failed)
--   needs_reconciliation → completed        (reconciler cancelled orphaned Stripe sub)

CREATE TABLE IF NOT EXISTS public.pending_subscription_creations (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid        NOT NULL,
  plan_tier                 text        NOT NULL CHECK (plan_tier IN ('free', 'standard', 'enterprise')),
  -- Stable idempotency key forwarded to Stripe so retries never double-create.
  idempotency_key           text        NOT NULL UNIQUE,
  status                    text        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN (
                                          'pending',
                                          'stripe_created',
                                          'completed',
                                          'failed',
                                          'needs_reconciliation'
                                        )),
  -- Populated once Stripe responds successfully.
  stripe_subscription_id    text,
  stripe_created_at         timestamptz,
  -- Populated once the DB subscription row is written.
  subscription_id           uuid,
  db_created_at             timestamptz,
  error_message             text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Reconciler index: find stale creations per tenant quickly.
CREATE INDEX IF NOT EXISTS idx_psc_create_tenant_status
  ON public.pending_subscription_creations (tenant_id, status)
  WHERE status IN ('pending', 'stripe_created', 'needs_reconciliation');

-- Auto-update updated_at on every row change.
CREATE OR REPLACE FUNCTION public.set_psc_create_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER psc_create_updated_at
  BEFORE UPDATE ON public.pending_subscription_creations
  FOR EACH ROW EXECUTE FUNCTION public.set_psc_create_updated_at();

-- RLS: tenants can only see their own creation records.
-- The reconciler runs as service_role and bypasses RLS.
ALTER TABLE public.pending_subscription_creations ENABLE ROW LEVEL SECURITY;

CREATE POLICY psc_create_tenant_select
  ON public.pending_subscription_creations FOR SELECT
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY psc_create_tenant_insert
  ON public.pending_subscription_creations FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY psc_create_tenant_update
  ON public.pending_subscription_creations FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

-- Service role needs explicit SELECT/INSERT/UPDATE for the reconciler.
GRANT SELECT, INSERT, UPDATE ON public.pending_subscription_creations TO service_role;

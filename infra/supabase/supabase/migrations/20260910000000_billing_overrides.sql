-- Migration: billing_overrides
--
-- Stores per-tenant custom pricing and temporary cap increases.
-- Rows are immutable once approved (status transitions only via service layer).

BEGIN;

-- ── billing_overrides ─────────────────────────────────────────────────────
-- Custom pricing or cap overrides for a specific tenant.
-- contract_mode rows have no effective_end (NULL = indefinite).
-- temporary rows must have effective_end set.

CREATE TABLE IF NOT EXISTS public.billing_overrides (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric            text        NOT NULL,
  override_type     text        NOT NULL CHECK (override_type IN ('contract', 'temporary')),
  -- For contract overrides: custom price per unit (overrides plan rate)
  custom_price      numeric,
  -- For cap overrides: the new cap value (replaces plan quota)
  cap_value         integer,
  -- Approval metadata
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by      uuid        NOT NULL,
  approved_by       uuid,
  approved_at       timestamptz,
  justification     text,
  -- Validity window
  effective_from    timestamptz NOT NULL DEFAULT now(),
  effective_end     timestamptz,           -- NULL = indefinite (contract mode)
  -- Audit
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT billing_overrides_temporary_requires_end
    CHECK (override_type <> 'temporary' OR effective_end IS NOT NULL),
  CONSTRAINT billing_overrides_valid_metric
    CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'))
);

CREATE INDEX IF NOT EXISTS idx_billing_overrides_org_metric
  ON public.billing_overrides (organization_id, metric)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_billing_overrides_active
  ON public.billing_overrides (organization_id, effective_from, effective_end)
  WHERE status = 'approved';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.billing_overrides_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER billing_overrides_updated_at
  BEFORE UPDATE ON public.billing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.billing_overrides_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.billing_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_overrides FORCE ROW LEVEL SECURITY;

-- Tenants can read their own overrides
CREATE POLICY billing_overrides_tenant_select
  ON public.billing_overrides FOR SELECT
  USING (security.user_has_tenant_access(organization_id));

-- Only service_role can insert/update (approval flow is backend-only)
CREATE POLICY billing_overrides_service_role_write
  ON public.billing_overrides FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

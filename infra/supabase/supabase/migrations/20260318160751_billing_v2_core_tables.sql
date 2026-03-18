-- Billing v2: Core tables for metering, pricing, approvals, and entitlements
-- Creates billing_meters, billing_price_versions, usage_policies, billing_approval_policies,
-- billing_approval_requests, and entitlement_snapshots tables

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. billing_meters table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_meters (
  meter_key          text        PRIMARY KEY,
  display_name       text        NOT NULL,
  unit               text        NOT NULL,
  aggregation        text        NOT NULL CHECK (aggregation IN ('sum', 'count', 'unique_count', 'max', 'min')),
  dimensions_schema  jsonb       NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- No RLS on billing_meters — global catalog table, readable by all tenants

-- ============================================================================
-- 2. billing_price_versions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_price_versions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  version_tag      text        NOT NULL,
  plan_tier        text        NOT NULL,
  definition       jsonb       NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  activated_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_tag)
);

CREATE INDEX IF NOT EXISTS idx_billing_price_versions_org_id
  ON public.billing_price_versions (organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_price_versions_plan_tier_status
  ON public.billing_price_versions (plan_tier, status);

ALTER TABLE public.billing_price_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_price_versions_tenant_select
  ON public.billing_price_versions FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_price_versions_tenant_insert
  ON public.billing_price_versions FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_price_versions_tenant_update
  ON public.billing_price_versions FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_price_versions_tenant_delete
  ON public.billing_price_versions FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 3. usage_policies table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_policies (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL,
  meter_key            text        NOT NULL REFERENCES public.billing_meters(meter_key),
  enforcement          text        NOT NULL DEFAULT 'hard_lock' CHECK (enforcement IN ('hard_lock', 'grace_then_lock')),
  grace_percent        numeric     CHECK (grace_percent >= 0 AND grace_percent <= 100),
  lock_message_template_key text,
  effective_start      timestamptz NOT NULL DEFAULT now(),
  effective_end        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_policies_org_id
  ON public.usage_policies (organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_policies_meter_key
  ON public.usage_policies (meter_key);
CREATE INDEX IF NOT EXISTS idx_usage_policies_effective_period
  ON public.usage_policies (effective_start, effective_end);

ALTER TABLE public.usage_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_policies_tenant_select
  ON public.usage_policies FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY usage_policies_tenant_insert
  ON public.usage_policies FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY usage_policies_tenant_update
  ON public.usage_policies FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY usage_policies_tenant_delete
  ON public.usage_policies FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 4. billing_approval_policies table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_approval_policies (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL,
  action_type            text        NOT NULL CHECK (action_type IN ('plan_change', 'seat_change', 'cancellation', 'usage_override')),
  thresholds             jsonb       NOT NULL DEFAULT '{}',
  required_approver_roles jsonb      NOT NULL DEFAULT '[]',
  sla_hours              integer     NOT NULL DEFAULT 24 CHECK (sla_hours > 0),
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_approval_policies_org_id
  ON public.billing_approval_policies (organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_approval_policies_action_type
  ON public.billing_approval_policies (action_type);

ALTER TABLE public.billing_approval_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_approval_policies_tenant_select
  ON public.billing_approval_policies FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_approval_policies_tenant_insert
  ON public.billing_approval_policies FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_approval_policies_tenant_update
  ON public.billing_approval_policies FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_approval_policies_tenant_delete
  ON public.billing_approval_policies FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 5. billing_approval_requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_approval_requests (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL,
  requested_by_user_id   uuid        NOT NULL,
  action_type            text        NOT NULL,
  payload                jsonb       NOT NULL DEFAULT '{}',
  computed_delta         jsonb       NOT NULL DEFAULT '{}',
  status                 text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'canceled')),
  approved_by_user_id    uuid,
  decision_reason        text,
  effective_at           timestamptz,
  expires_at             timestamptz NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_approval_requests_org_id
  ON public.billing_approval_requests (organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_approval_requests_status
  ON public.billing_approval_requests (status);
CREATE INDEX IF NOT EXISTS idx_billing_approval_requests_expires_at
  ON public.billing_approval_requests (expires_at);

ALTER TABLE public.billing_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_approval_requests_tenant_select
  ON public.billing_approval_requests FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_approval_requests_tenant_insert
  ON public.billing_approval_requests FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_approval_requests_tenant_update
  ON public.billing_approval_requests FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY billing_approval_requests_tenant_delete
  ON public.billing_approval_requests FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 6. entitlement_snapshots table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entitlement_snapshots (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        NOT NULL,
  subscription_id      uuid        NOT NULL,
  price_version_id     uuid        NOT NULL REFERENCES public.billing_price_versions(id),
  entitlements         jsonb       NOT NULL DEFAULT '{}',
  effective_at         timestamptz NOT NULL DEFAULT now(),
  superseded_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entitlement_snapshots_org_id
  ON public.entitlement_snapshots (organization_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_snapshots_subscription_id
  ON public.entitlement_snapshots (subscription_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_snapshots_effective_superseded
  ON public.entitlement_snapshots (effective_at, superseded_at);

ALTER TABLE public.entitlement_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY entitlement_snapshots_tenant_select
  ON public.entitlement_snapshots FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY entitlement_snapshots_tenant_insert
  ON public.entitlement_snapshots FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY entitlement_snapshots_tenant_update
  ON public.entitlement_snapshots FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY entitlement_snapshots_tenant_delete
  ON public.entitlement_snapshots FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================================
-- 7. Trigger for updated_at on approval requests
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_billing_approval_requests_updated_at
  BEFORE UPDATE ON public.billing_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

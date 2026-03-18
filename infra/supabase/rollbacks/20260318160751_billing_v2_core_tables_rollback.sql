-- Rollback: Billing v2 core tables

SET search_path = public, pg_temp;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_billing_approval_requests_updated_at ON public.billing_approval_requests;

-- Drop RLS policies
DROP POLICY IF EXISTS billing_price_versions_tenant_select ON public.billing_price_versions;
DROP POLICY IF EXISTS billing_price_versions_tenant_insert ON public.billing_price_versions;
DROP POLICY IF EXISTS billing_price_versions_tenant_update ON public.billing_price_versions;
DROP POLICY IF EXISTS billing_price_versions_tenant_delete ON public.billing_price_versions;

DROP POLICY IF EXISTS usage_policies_tenant_select ON public.usage_policies;
DROP POLICY IF EXISTS usage_policies_tenant_insert ON public.usage_policies;
DROP POLICY IF EXISTS usage_policies_tenant_update ON public.usage_policies;
DROP POLICY IF EXISTS usage_policies_tenant_delete ON public.usage_policies;

DROP POLICY IF EXISTS billing_approval_policies_tenant_select ON public.billing_approval_policies;
DROP POLICY IF EXISTS billing_approval_policies_tenant_insert ON public.billing_approval_policies;
DROP POLICY IF EXISTS billing_approval_policies_tenant_update ON public.billing_approval_policies;
DROP POLICY IF EXISTS billing_approval_policies_tenant_delete ON public.billing_approval_policies;

DROP POLICY IF EXISTS billing_approval_requests_tenant_select ON public.billing_approval_requests;
DROP POLICY IF EXISTS billing_approval_requests_tenant_insert ON public.billing_approval_requests;
DROP POLICY IF EXISTS billing_approval_requests_tenant_update ON public.billing_approval_requests;
DROP POLICY IF EXISTS billing_approval_requests_tenant_delete ON public.billing_approval_requests;

DROP POLICY IF EXISTS entitlement_snapshots_tenant_select ON public.entitlement_snapshots;
DROP POLICY IF EXISTS entitlement_snapshots_tenant_insert ON public.entitlement_snapshots;
DROP POLICY IF EXISTS entitlement_snapshots_tenant_update ON public.entitlement_snapshots;
DROP POLICY IF EXISTS entitlement_snapshots_tenant_delete ON public.entitlement_snapshots;

-- Drop tables
DROP TABLE IF EXISTS public.entitlement_snapshots;
DROP TABLE IF EXISTS public.billing_approval_requests;
DROP TABLE IF EXISTS public.billing_approval_policies;
DROP TABLE IF EXISTS public.usage_policies;
DROP TABLE IF EXISTS public.billing_price_versions;
DROP TABLE IF EXISTS public.billing_meters;

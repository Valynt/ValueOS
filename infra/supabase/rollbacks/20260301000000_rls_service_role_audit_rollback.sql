-- ============================================================================
-- ROLLBACK: 20260301000000_rls_service_role_audit
-- Drops the RLS policies added to billing/metering tables.
-- Note: 20260308000000 supersedes these policies with membership-validated
-- equivalents. Roll back that migration first if it has been applied.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP POLICY IF EXISTS billing_customers_tenant_select ON public.billing_customers;
DROP POLICY IF EXISTS billing_customers_tenant_insert ON public.billing_customers;
DROP POLICY IF EXISTS billing_customers_tenant_update ON public.billing_customers;

DROP POLICY IF EXISTS subscriptions_tenant_select ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_tenant_update ON public.subscriptions;

DROP POLICY IF EXISTS invoices_tenant_select ON public.invoices;
DROP POLICY IF EXISTS invoices_tenant_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_tenant_update ON public.invoices;

DROP POLICY IF EXISTS usage_events_tenant_select ON public.usage_events;
DROP POLICY IF EXISTS usage_events_tenant_insert ON public.usage_events;

DROP POLICY IF EXISTS usage_aggregates_tenant_select ON public.usage_aggregates;

DROP POLICY IF EXISTS usage_quotas_tenant_select ON public.usage_quotas;

DROP POLICY IF EXISTS temp_cap_increase_requests_tenant_select ON public.temp_cap_increase_requests;
DROP POLICY IF EXISTS temp_cap_increase_requests_tenant_insert ON public.temp_cap_increase_requests;
DROP POLICY IF EXISTS temp_cap_increase_requests_tenant_update ON public.temp_cap_increase_requests;

DROP POLICY IF EXISTS temp_cap_increases_tenant_select ON public.temp_cap_increases;
DROP POLICY IF EXISTS temp_cap_increases_tenant_insert ON public.temp_cap_increases;
DROP POLICY IF EXISTS temp_cap_increases_tenant_update ON public.temp_cap_increases;

DROP POLICY IF EXISTS grace_periods_tenant_select ON public.grace_periods;
DROP POLICY IF EXISTS grace_periods_tenant_insert ON public.grace_periods;
DROP POLICY IF EXISTS grace_periods_tenant_update ON public.grace_periods;

DROP POLICY IF EXISTS tenant_usage_org_select ON public.tenant_usage;
DROP POLICY IF EXISTS tenant_usage_org_insert ON public.tenant_usage;
DROP POLICY IF EXISTS tenant_usage_org_update ON public.tenant_usage;

DROP POLICY IF EXISTS approval_requests_tenant_select ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_insert ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_update ON public.approval_requests;

DROP POLICY IF EXISTS rate_limit_violations_insert ON public.rate_limit_violations;
DROP POLICY IF EXISTS rate_limit_violations_service_select ON public.rate_limit_violations;

DROP POLICY IF EXISTS user_tenants_tenant_select_v2 ON public.user_tenants;
DROP POLICY IF EXISTS user_tenants_tenant_update_v2 ON public.user_tenants;

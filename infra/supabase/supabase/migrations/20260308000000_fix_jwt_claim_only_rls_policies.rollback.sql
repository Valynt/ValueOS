-- Rollback: 20260308000000_fix_jwt_claim_only_rls_policies.sql
-- Drops all 30 RLS policies created by this migration across 13 tables.
-- Tables are left intact with RLS still enabled but no policies.
-- Re-applying 20260301000000_rls_service_role_audit.sql will restore the
-- prior (JWT-claim-only) policies if needed.
--
-- NOTE: Dropping these policies leaves the affected tables with no RLS
-- policies. Ensure RLS is disabled or alternative policies are in place
-- before applying this rollback in production.

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

DROP POLICY IF EXISTS rate_limit_violations_service_select ON public.rate_limit_violations;

DROP POLICY IF EXISTS user_tenants_self_select ON public.user_tenants;
DROP POLICY IF EXISTS user_tenants_self_update ON public.user_tenants;

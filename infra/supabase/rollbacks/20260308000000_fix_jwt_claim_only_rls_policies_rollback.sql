-- ============================================================================
-- ROLLBACK: 20260308000000_fix_jwt_claim_only_rls_policies
-- Drops the membership-validated RLS policies and restores the original
-- JWT-claim-only policies from 20260301000000_rls_service_role_audit.
-- ⚠️  Restoring JWT-claim-only policies reintroduces the tenant isolation
--     vulnerability. Only apply as part of a full rollback sequence.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- billing_customers
DROP POLICY IF EXISTS billing_customers_tenant_select ON public.billing_customers;
DROP POLICY IF EXISTS billing_customers_tenant_insert ON public.billing_customers;
DROP POLICY IF EXISTS billing_customers_tenant_update ON public.billing_customers;

CREATE POLICY billing_customers_tenant_select ON public.billing_customers
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY billing_customers_tenant_insert ON public.billing_customers
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY billing_customers_tenant_update ON public.billing_customers
    FOR UPDATE TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- subscriptions
DROP POLICY IF EXISTS subscriptions_tenant_select ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_tenant_update ON public.subscriptions;

CREATE POLICY subscriptions_tenant_select ON public.subscriptions
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY subscriptions_tenant_update ON public.subscriptions
    FOR UPDATE TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- invoices
DROP POLICY IF EXISTS invoices_tenant_select ON public.invoices;
DROP POLICY IF EXISTS invoices_tenant_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_tenant_update ON public.invoices;

CREATE POLICY invoices_tenant_select ON public.invoices
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY invoices_tenant_insert ON public.invoices
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY invoices_tenant_update ON public.invoices
    FOR UPDATE TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- usage_events
DROP POLICY IF EXISTS usage_events_tenant_select ON public.usage_events;
DROP POLICY IF EXISTS usage_events_tenant_insert ON public.usage_events;

CREATE POLICY usage_events_tenant_select ON public.usage_events
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY usage_events_tenant_insert ON public.usage_events
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- usage_aggregates
DROP POLICY IF EXISTS usage_aggregates_tenant_select ON public.usage_aggregates;

CREATE POLICY usage_aggregates_tenant_select ON public.usage_aggregates
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- usage_quotas
DROP POLICY IF EXISTS usage_quotas_tenant_select ON public.usage_quotas;

CREATE POLICY usage_quotas_tenant_select ON public.usage_quotas
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- user_tenants
DROP POLICY IF EXISTS user_tenants_self_select ON public.user_tenants;
DROP POLICY IF EXISTS user_tenants_self_update ON public.user_tenants;

CREATE POLICY user_tenants_tenant_select_v2 ON public.user_tenants
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY user_tenants_tenant_update_v2 ON public.user_tenants
    FOR UPDATE TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

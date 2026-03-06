-- ============================================================================
-- Fix JWT-claim-only RLS policies
--
-- Replaces 15 policies in 20260301000000_rls_service_role_audit.sql that used
-- `auth.jwt() ->> 'tenant_id'` for tenant isolation. That pattern trusts the
-- JWT claim without verifying actual membership in user_tenants, making it
-- vulnerable to claim manipulation.
--
-- Replacement: security.user_has_tenant_access() — a SECURITY DEFINER function
-- that validates active membership in user_tenants (defined in
-- 20260205000000_canonical_tenant_authorization_rls.sql).
--
-- Tables covered: billing_customers, subscriptions, invoices, usage_events,
-- usage_aggregates, usage_quotas, temp_cap_increase_requests,
-- temp_cap_increases, grace_periods, tenant_usage, approval_requests,
-- rate_limit_violations, user_tenants
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. billing_customers
-- ============================================================================

DROP POLICY IF EXISTS billing_customers_tenant_select ON public.billing_customers;
DROP POLICY IF EXISTS billing_customers_tenant_insert ON public.billing_customers;
DROP POLICY IF EXISTS billing_customers_tenant_update ON public.billing_customers;

CREATE POLICY billing_customers_tenant_select ON public.billing_customers
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY billing_customers_tenant_insert ON public.billing_customers
    AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY billing_customers_tenant_update ON public.billing_customers
    AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- 2. subscriptions
-- ============================================================================

DROP POLICY IF EXISTS subscriptions_tenant_select ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_tenant_update ON public.subscriptions;

CREATE POLICY subscriptions_tenant_select ON public.subscriptions
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY subscriptions_tenant_update ON public.subscriptions
    AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- 3. invoices
-- ============================================================================

DROP POLICY IF EXISTS invoices_tenant_select ON public.invoices;
DROP POLICY IF EXISTS invoices_tenant_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_tenant_update ON public.invoices;

CREATE POLICY invoices_tenant_select ON public.invoices
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY invoices_tenant_insert ON public.invoices
    AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY invoices_tenant_update ON public.invoices
    AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- 4. usage_events
-- ============================================================================

DROP POLICY IF EXISTS usage_events_tenant_select ON public.usage_events;
DROP POLICY IF EXISTS usage_events_tenant_insert ON public.usage_events;

CREATE POLICY usage_events_tenant_select ON public.usage_events
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY usage_events_tenant_insert ON public.usage_events
    AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- 5. usage_aggregates
-- ============================================================================

DROP POLICY IF EXISTS usage_aggregates_tenant_select ON public.usage_aggregates;

CREATE POLICY usage_aggregates_tenant_select ON public.usage_aggregates
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- 6. usage_quotas
-- ============================================================================

DROP POLICY IF EXISTS usage_quotas_tenant_select ON public.usage_quotas;

CREATE POLICY usage_quotas_tenant_select ON public.usage_quotas
    AS RESTRICTIVE FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

-- ============================================================================
-- 7. temp_cap_increase_requests (conditional — table may not exist)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'temp_cap_increase_requests'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS temp_cap_increase_requests_tenant_select ON public.temp_cap_increase_requests';
        EXECUTE 'DROP POLICY IF EXISTS temp_cap_increase_requests_tenant_insert ON public.temp_cap_increase_requests';
        EXECUTE 'DROP POLICY IF EXISTS temp_cap_increase_requests_tenant_update ON public.temp_cap_increase_requests';

        EXECUTE 'CREATE POLICY temp_cap_increase_requests_tenant_select ON public.temp_cap_increase_requests
            AS RESTRICTIVE FOR SELECT TO authenticated
            USING (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY temp_cap_increase_requests_tenant_insert ON public.temp_cap_increase_requests
            AS RESTRICTIVE FOR INSERT TO authenticated
            WITH CHECK (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY temp_cap_increase_requests_tenant_update ON public.temp_cap_increase_requests
            AS RESTRICTIVE FOR UPDATE TO authenticated
            USING (security.user_has_tenant_access(tenant_id))
            WITH CHECK (security.user_has_tenant_access(tenant_id))';
    END IF;
END $$;

-- ============================================================================
-- 8. temp_cap_increases (conditional)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'temp_cap_increases'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS temp_cap_increases_tenant_select ON public.temp_cap_increases';
        EXECUTE 'DROP POLICY IF EXISTS temp_cap_increases_tenant_insert ON public.temp_cap_increases';
        EXECUTE 'DROP POLICY IF EXISTS temp_cap_increases_tenant_update ON public.temp_cap_increases';

        EXECUTE 'CREATE POLICY temp_cap_increases_tenant_select ON public.temp_cap_increases
            AS RESTRICTIVE FOR SELECT TO authenticated
            USING (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY temp_cap_increases_tenant_insert ON public.temp_cap_increases
            AS RESTRICTIVE FOR INSERT TO authenticated
            WITH CHECK (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY temp_cap_increases_tenant_update ON public.temp_cap_increases
            AS RESTRICTIVE FOR UPDATE TO authenticated
            USING (security.user_has_tenant_access(tenant_id))
            WITH CHECK (security.user_has_tenant_access(tenant_id))';
    END IF;
END $$;

-- ============================================================================
-- 9. grace_periods (conditional)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'grace_periods'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS grace_periods_tenant_select ON public.grace_periods';
        EXECUTE 'DROP POLICY IF EXISTS grace_periods_tenant_insert ON public.grace_periods';
        EXECUTE 'DROP POLICY IF EXISTS grace_periods_tenant_update ON public.grace_periods';

        EXECUTE 'CREATE POLICY grace_periods_tenant_select ON public.grace_periods
            AS RESTRICTIVE FOR SELECT TO authenticated
            USING (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY grace_periods_tenant_insert ON public.grace_periods
            AS RESTRICTIVE FOR INSERT TO authenticated
            WITH CHECK (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY grace_periods_tenant_update ON public.grace_periods
            AS RESTRICTIVE FOR UPDATE TO authenticated
            USING (security.user_has_tenant_access(tenant_id))
            WITH CHECK (security.user_has_tenant_access(tenant_id))';
    END IF;
END $$;

-- ============================================================================
-- 10. tenant_usage — uses organization_id column (conditional)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenant_usage'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS tenant_usage_org_select ON public.tenant_usage';
        EXECUTE 'DROP POLICY IF EXISTS tenant_usage_org_insert ON public.tenant_usage';
        EXECUTE 'DROP POLICY IF EXISTS tenant_usage_org_update ON public.tenant_usage';

        -- tenant_usage uses organization_id; cast to text for user_has_tenant_access(TEXT)
        EXECUTE 'CREATE POLICY tenant_usage_org_select ON public.tenant_usage
            AS RESTRICTIVE FOR SELECT TO authenticated
            USING (security.user_has_tenant_access(organization_id::text))';

        EXECUTE 'CREATE POLICY tenant_usage_org_insert ON public.tenant_usage
            AS RESTRICTIVE FOR INSERT TO authenticated
            WITH CHECK (security.user_has_tenant_access(organization_id::text))';

        EXECUTE 'CREATE POLICY tenant_usage_org_update ON public.tenant_usage
            AS RESTRICTIVE FOR UPDATE TO authenticated
            USING (security.user_has_tenant_access(organization_id::text))
            WITH CHECK (security.user_has_tenant_access(organization_id::text))';
    END IF;
END $$;

-- ============================================================================
-- 11. approval_requests (conditional)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'approval_requests'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS approval_requests_tenant_select ON public.approval_requests';
        EXECUTE 'DROP POLICY IF EXISTS approval_requests_tenant_insert ON public.approval_requests';
        EXECUTE 'DROP POLICY IF EXISTS approval_requests_tenant_update ON public.approval_requests';

        EXECUTE 'CREATE POLICY approval_requests_tenant_select ON public.approval_requests
            AS RESTRICTIVE FOR SELECT TO authenticated
            USING (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY approval_requests_tenant_insert ON public.approval_requests
            AS RESTRICTIVE FOR INSERT TO authenticated
            WITH CHECK (security.user_has_tenant_access(tenant_id))';

        EXECUTE 'CREATE POLICY approval_requests_tenant_update ON public.approval_requests
            AS RESTRICTIVE FOR UPDATE TO authenticated
            USING (security.user_has_tenant_access(tenant_id))
            WITH CHECK (security.user_has_tenant_access(tenant_id))';
    END IF;
END $$;

-- ============================================================================
-- 12. rate_limit_violations — tenant-scoped SELECT; INSERT remains open (conditional)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'rate_limit_violations'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS rate_limit_violations_service_select ON public.rate_limit_violations';

        EXECUTE 'CREATE POLICY rate_limit_violations_service_select ON public.rate_limit_violations
            AS RESTRICTIVE FOR SELECT TO authenticated
            USING (security.user_has_tenant_access(tenant_id))';
    END IF;
END $$;

-- ============================================================================
-- 13. user_tenants — self-scoped: users see only their own memberships (conditional)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_tenants'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS user_tenants_tenant_select_v2 ON public.user_tenants';
        EXECUTE 'DROP POLICY IF EXISTS user_tenants_tenant_update_v2 ON public.user_tenants';

        -- user_tenants is the membership table itself; use auth.uid() directly
        -- to avoid circular dependency with user_has_tenant_access.
        EXECUTE 'CREATE POLICY user_tenants_self_select ON public.user_tenants
            AS RESTRICTIVE FOR SELECT TO authenticated
            USING (user_id = (auth.uid())::text)';

        EXECUTE 'CREATE POLICY user_tenants_self_update ON public.user_tenants
            AS RESTRICTIVE FOR UPDATE TO authenticated
            USING (user_id = (auth.uid())::text)
            WITH CHECK (user_id = (auth.uid())::text)';
    END IF;
END $$;

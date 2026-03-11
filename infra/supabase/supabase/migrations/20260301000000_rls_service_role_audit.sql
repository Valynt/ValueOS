-- ============================================================================
-- RLS Policies for Service Role Audit Remediation
-- Adds tenant-scoped RLS to billing/metering tables that previously relied
-- on service_role bypass. Background workers retain service_role access.
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. billing_customers  (tenant_id is TEXT)
-- ============================================================================

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_customers_tenant_select ON public.billing_customers
    FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY billing_customers_tenant_insert ON public.billing_customers
    FOR INSERT TO authenticated
    WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY billing_customers_tenant_update ON public.billing_customers
    FOR UPDATE TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

GRANT SELECT, INSERT, UPDATE ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;

-- ============================================================================
-- 2. subscriptions  (tenant_id is TEXT)
-- ============================================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_tenant_select ON public.subscriptions
    FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY subscriptions_tenant_update ON public.subscriptions
    FOR UPDATE TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

GRANT SELECT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- ============================================================================
-- 3. invoices  (tenant_id is TEXT)
-- ============================================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_tenant_select ON public.invoices
    FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY invoices_tenant_insert ON public.invoices
    FOR INSERT TO authenticated
    WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY invoices_tenant_update ON public.invoices
    FOR UPDATE TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

-- ============================================================================
-- 4. usage_events  (tenant_id is UUID)
-- ============================================================================

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_events_tenant_select ON public.usage_events
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY usage_events_tenant_insert ON public.usage_events
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

-- ============================================================================
-- 5. usage_aggregates  (tenant_id is UUID)
-- ============================================================================

ALTER TABLE public.usage_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_aggregates_tenant_select ON public.usage_aggregates
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

GRANT SELECT ON public.usage_aggregates TO authenticated;
GRANT ALL ON public.usage_aggregates TO service_role;

-- ============================================================================
-- 6. usage_quotas  (tenant_id is UUID)
-- ============================================================================

ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_quotas_tenant_select ON public.usage_quotas
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

GRANT SELECT ON public.usage_quotas TO authenticated;
GRANT ALL ON public.usage_quotas TO service_role;

-- ============================================================================
-- 7. temp_cap_increase_requests
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'temp_cap_increase_requests') THEN
        ALTER TABLE public.temp_cap_increase_requests ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY temp_cap_increase_requests_tenant_select ON public.temp_cap_increase_requests
            FOR SELECT TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY temp_cap_increase_requests_tenant_insert ON public.temp_cap_increase_requests
            FOR INSERT TO authenticated
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY temp_cap_increase_requests_tenant_update ON public.temp_cap_increase_requests
            FOR UPDATE TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.temp_cap_increase_requests TO authenticated';
        EXECUTE 'GRANT ALL ON public.temp_cap_increase_requests TO service_role';
    END IF;
END $$;

-- ============================================================================
-- 8. temp_cap_increases
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'temp_cap_increases') THEN
        ALTER TABLE public.temp_cap_increases ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY temp_cap_increases_tenant_select ON public.temp_cap_increases
            FOR SELECT TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY temp_cap_increases_tenant_insert ON public.temp_cap_increases
            FOR INSERT TO authenticated
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY temp_cap_increases_tenant_update ON public.temp_cap_increases
            FOR UPDATE TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.temp_cap_increases TO authenticated';
        EXECUTE 'GRANT ALL ON public.temp_cap_increases TO service_role';
    END IF;
END $$;

-- ============================================================================
-- 9. grace_periods
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grace_periods') THEN
        ALTER TABLE public.grace_periods ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY grace_periods_tenant_select ON public.grace_periods
            FOR SELECT TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY grace_periods_tenant_insert ON public.grace_periods
            FOR INSERT TO authenticated
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY grace_periods_tenant_update ON public.grace_periods
            FOR UPDATE TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.grace_periods TO authenticated';
        EXECUTE 'GRANT ALL ON public.grace_periods TO service_role';
    END IF;
END $$;

-- ============================================================================
-- 10. tenant_usage
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_usage') THEN
        ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY tenant_usage_org_select ON public.tenant_usage
            FOR SELECT TO authenticated
            USING (organization_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY tenant_usage_org_insert ON public.tenant_usage
            FOR INSERT TO authenticated
            WITH CHECK (organization_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY tenant_usage_org_update ON public.tenant_usage
            FOR UPDATE TO authenticated
            USING (organization_id = (auth.jwt() ->> ''tenant_id'')::uuid)
            WITH CHECK (organization_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.tenant_usage TO authenticated';
        EXECUTE 'GRANT ALL ON public.tenant_usage TO service_role';
    END IF;
END $$;

-- ============================================================================
-- 11. approval_requests
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approval_requests') THEN
        ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY approval_requests_tenant_select ON public.approval_requests
            FOR SELECT TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY approval_requests_tenant_insert ON public.approval_requests
            FOR INSERT TO authenticated
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'CREATE POLICY approval_requests_tenant_update ON public.approval_requests
            FOR UPDATE TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)
            WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated';
        EXECUTE 'GRANT ALL ON public.approval_requests TO service_role';
    END IF;
END $$;

-- ============================================================================
-- 12. rate_limit_violations — INSERT-only for authenticated
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limit_violations') THEN
        ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

        EXECUTE 'CREATE POLICY rate_limit_violations_insert ON public.rate_limit_violations
            FOR INSERT TO authenticated
            WITH CHECK (true)';

        EXECUTE 'CREATE POLICY rate_limit_violations_service_select ON public.rate_limit_violations
            FOR SELECT TO authenticated
            USING (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)';

        EXECUTE 'GRANT INSERT, SELECT ON public.rate_limit_violations TO authenticated';
        EXECUTE 'GRANT ALL ON public.rate_limit_violations TO service_role';
    END IF;
END $$;

-- ============================================================================
-- 13. user_tenants — Membership-scoped access
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_tenants') THEN
        -- Check if policies already exist before creating
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_tenants' AND policyname = 'user_tenants_tenant_select_v2') THEN
            ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

            -- tenant_id is TEXT in user_tenants; compare directly without uuid cast
            EXECUTE 'CREATE POLICY user_tenants_tenant_select_v2 ON public.user_tenants
                FOR SELECT TO authenticated
                USING (tenant_id = (auth.jwt() ->> ''tenant_id''))';

            EXECUTE 'CREATE POLICY user_tenants_tenant_update_v2 ON public.user_tenants
                FOR UPDATE TO authenticated
                USING (tenant_id = (auth.jwt() ->> ''tenant_id''))
                WITH CHECK (tenant_id = (auth.jwt() ->> ''tenant_id''))';

            EXECUTE 'GRANT SELECT, UPDATE ON public.user_tenants TO authenticated';
            EXECUTE 'GRANT ALL ON public.user_tenants TO service_role';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 14. finance_exports — Admin only via service_role
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finance_exports') THEN
        ALTER TABLE public.finance_exports ENABLE ROW LEVEL SECURITY;

        EXECUTE 'GRANT ALL ON public.finance_exports TO service_role';
    END IF;
END $$;

-- ============================================================================
-- 15. webhook_events — Service role only (no user context for webhooks)
-- ============================================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
        ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

        EXECUTE 'GRANT ALL ON public.webhook_events TO service_role';
    END IF;
END $$;

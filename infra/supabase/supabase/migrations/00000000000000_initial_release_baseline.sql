-- ============================================================================
-- Required Extensions
-- These must be available before any table creation. On Supabase-hosted
-- instances they are pre-installed; on self-hosted Postgres they may need
-- superuser privileges.
-- ============================================================================

-- pgcrypto: gen_random_uuid() is built-in on PG13+; pgcrypto still needed for
-- crypt(), digest(), etc. Wrapped to survive Supabase supautils hook.
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
EXCEPTION WHEN others THEN RAISE NOTICE 'pgcrypto: skipped (%)' , SQLERRM; END $$;

-- pgvector for embedding columns
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
EXCEPTION WHEN others THEN RAISE NOTICE 'vector: skipped (%)' , SQLERRM; END $$;

-- ============================================================================
-- Billing V2 Foundation
-- Adds versioned pricing, meter catalog, entitlement snapshots, usage policies,
-- billing-specific approval workflows, and hardens usage evidence chain.
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- Security schema bootstrap
-- The security schema and user_has_tenant_access() are fully defined in
-- 20260213000010_canonical_identity_baseline.sql. We create a minimal stub
-- here so that RLS policies in this migration can reference the function.
-- The canonical migration will replace these stubs with the real definitions.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;
GRANT USAGE ON SCHEMA security TO authenticated;
GRANT USAGE ON SCHEMA security TO anon;

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$ SELECT false; $$;

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$ SELECT false; $$;

REVOKE ALL ON FUNCTION security.user_has_tenant_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.user_has_tenant_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(TEXT) TO anon, authenticated;

-- ============================================================================
-- 1. billing_meters — Catalog of billable meters
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_meters (
    meter_key text PRIMARY KEY,
    display_name text NOT NULL,
    unit text NOT NULL,
    aggregation text NOT NULL DEFAULT 'sum',
    dimensions_schema jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT billing_meters_aggregation_check CHECK (aggregation IN ('sum', 'max', 'last_during_period'))
);

COMMENT ON TABLE public.billing_meters IS 'Catalog of billable usage meters';

-- Seed primary meters
INSERT INTO public.billing_meters (meter_key, display_name, unit, aggregation, dimensions_schema)
VALUES
    ('ai_tokens', 'AI Tokens', 'tokens', 'sum', '{"model": "string", "tenant_region": "string"}'::jsonb),
    ('api_calls', 'API Calls', 'calls', 'sum', '{"endpoint": "string", "tenant_region": "string"}'::jsonb),
    ('llm_tokens', 'LLM Tokens', 'tokens', 'sum', '{"model": "string"}'::jsonb),
    ('agent_executions', 'Agent Executions', 'executions', 'sum', '{"agent_type": "string"}'::jsonb),
    ('storage_gb', 'Storage', 'GB', 'max', '{}'::jsonb),
    ('user_seats', 'User Seats', 'seats', 'max', '{}'::jsonb)
ON CONFLICT (meter_key) DO NOTHING;

-- ============================================================================
-- 2. billing_price_versions — Immutable versioned pricing definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_price_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    version_tag text NOT NULL,
    plan_tier text NOT NULL,
    tenant_id uuid,
    definition jsonb NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    activated_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT billing_price_versions_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT billing_price_versions_plan_tier_check CHECK (plan_tier IN ('free', 'standard', 'enterprise'))
);

COMMENT ON TABLE public.billing_price_versions IS 'Immutable versioned pricing definitions per plan tier';

CREATE INDEX IF NOT EXISTS idx_billing_price_versions_active
    ON public.billing_price_versions (plan_tier, status) WHERE status = 'active' AND tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_price_versions_tenant_tier_status
    ON public.billing_price_versions (tenant_id, plan_tier, status);

CREATE INDEX IF NOT EXISTS idx_billing_price_versions_tenant_created_at
    ON public.billing_price_versions (tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_price_versions_global_tag_tier_unique
    ON public.billing_price_versions (version_tag, plan_tier)
    WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_price_versions_tenant_tag_tier_unique
    ON public.billing_price_versions (tenant_id, version_tag, plan_tier)
    WHERE tenant_id IS NOT NULL;

-- Drop any previously added unconditional constraint — the partial unique index
-- idx_billing_price_versions_global_tag_tier_unique (WHERE tenant_id IS NULL)
-- is the correct uniqueness mechanism for global rows and allows tenant-scoped
-- rows to share the same (version_tag, plan_tier) across different tenants.
ALTER TABLE public.billing_price_versions
    DROP CONSTRAINT IF EXISTS billing_price_versions_tag_tier_unique;

-- Seed v1 global pricing rows (tenant_id IS NULL).
-- Uses INSERT ... WHERE NOT EXISTS instead of ON CONFLICT because Postgres
-- ON CONFLICT requires a constraint, but our uniqueness is enforced by a
-- partial index (WHERE tenant_id IS NULL) which cannot be used as an arbiter.
INSERT INTO public.billing_price_versions (version_tag, plan_tier, definition, status, activated_at)
SELECT * FROM (VALUES
    ('v1.0', 'free', '{
        "name": "Free",
        "price_usd": 0,
        "billing_period": "monthly",
        "meters": {
            "ai_tokens":         {"included_quantity": 10000,    "hard_cap_quantity": 10000,    "overage_rate": 0,        "enforcement": "hard_lock"},
            "api_calls":         {"included_quantity": 1000,     "hard_cap_quantity": 1000,     "overage_rate": 0,        "enforcement": "hard_lock"},
            "llm_tokens":        {"included_quantity": 10000,    "hard_cap_quantity": 10000,    "overage_rate": 0,        "enforcement": "hard_lock"},
            "agent_executions":  {"included_quantity": 100,      "hard_cap_quantity": 100,      "overage_rate": 0,        "enforcement": "hard_lock"},
            "storage_gb":        {"included_quantity": 1,        "hard_cap_quantity": 1,        "overage_rate": 0,        "enforcement": "hard_lock"},
            "user_seats":        {"included_quantity": 3,        "hard_cap_quantity": 3,        "overage_rate": 0,        "enforcement": "hard_lock"}
        },
        "features": ["Up to 3 users", "10K AI tokens/month", "1K API calls/month", "Email support"]
    }'::jsonb, 'active'::text, now()),

    ('v1.0', 'standard', '{
        "name": "Standard",
        "price_usd": 99,
        "billing_period": "monthly",
        "meters": {
            "ai_tokens":         {"included_quantity": 1000000,  "hard_cap_quantity": null,      "overage_rate": 0.00001,  "enforcement": "bill_overage"},
            "api_calls":         {"included_quantity": 100000,   "hard_cap_quantity": null,      "overage_rate": 0.001,    "enforcement": "bill_overage"},
            "llm_tokens":        {"included_quantity": 1000000,  "hard_cap_quantity": null,      "overage_rate": 0.00001,  "enforcement": "bill_overage"},
            "agent_executions":  {"included_quantity": 5000,     "hard_cap_quantity": null,      "overage_rate": 0.1,      "enforcement": "bill_overage"},
            "storage_gb":        {"included_quantity": 100,      "hard_cap_quantity": null,      "overage_rate": 0.5,      "enforcement": "bill_overage"},
            "user_seats":        {"included_quantity": 25,       "hard_cap_quantity": null,      "overage_rate": 5.0,      "enforcement": "bill_overage"}
        },
        "features": ["Up to 25 users", "1M AI tokens/month + overage", "100K API calls/month + overage", "Priority support", "SSO"]
    }'::jsonb, 'active'::text, now()),

    ('v1.0', 'enterprise', '{
        "name": "Enterprise",
        "price_usd": 499,
        "billing_period": "monthly",
        "meters": {
            "ai_tokens":         {"included_quantity": 10000000, "hard_cap_quantity": null,      "overage_rate": 0.000005, "enforcement": "bill_overage"},
            "api_calls":         {"included_quantity": 1000000,  "hard_cap_quantity": null,      "overage_rate": 0.0005,   "enforcement": "bill_overage"},
            "llm_tokens":        {"included_quantity": 10000000, "hard_cap_quantity": null,      "overage_rate": 0.000005, "enforcement": "bill_overage"},
            "agent_executions":  {"included_quantity": 50000,    "hard_cap_quantity": null,      "overage_rate": 0.05,     "enforcement": "bill_overage"},
            "storage_gb":        {"included_quantity": 1000,     "hard_cap_quantity": null,      "overage_rate": 0.25,     "enforcement": "bill_overage"},
            "user_seats":        {"included_quantity": -1,       "hard_cap_quantity": null,      "overage_rate": 0,        "enforcement": "bill_overage"}
        },
        "features": ["Unlimited users", "10M AI tokens/month + discounted overage", "1M API calls/month + discounted overage", "24/7 support", "SSO & SCIM", "Custom SLA"]
    }'::jsonb, 'active'::text, now())
) AS v(version_tag, plan_tier, definition, status, activated_at)
WHERE NOT EXISTS (
    SELECT 1 FROM public.billing_price_versions bpv
    WHERE bpv.version_tag = v.version_tag
      AND bpv.plan_tier   = v.plan_tier
      AND bpv.tenant_id IS NULL
);

-- ============================================================================
-- 3. usage_policies — Per-tenant enforcement overrides
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    meter_key text NOT NULL REFERENCES public.billing_meters(meter_key),
    enforcement text NOT NULL DEFAULT 'hard_lock',
    grace_percent numeric(5,4),
    lock_message_template_key text,
    effective_start timestamptz NOT NULL DEFAULT now(),
    effective_end timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT usage_policies_enforcement_check CHECK (enforcement IN ('hard_lock', 'grace_then_lock'))
);

COMMENT ON TABLE public.usage_policies IS 'Per-tenant enforcement policy overrides per meter';

CREATE INDEX IF NOT EXISTS idx_usage_policies_tenant_meter
    ON public.usage_policies (tenant_id, meter_key, effective_start);

-- ============================================================================
-- 4. billing_approval_policies — Per-tenant approval thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_approval_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    action_type text NOT NULL,
    thresholds jsonb DEFAULT '{}'::jsonb,
    required_approver_roles jsonb DEFAULT '[]'::jsonb,
    sla_hours integer,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT billing_approval_policies_action_type_check CHECK (
        action_type IN ('plan_change', 'seat_change', 'enable_overage', 'increase_cap', 'billing_cycle_change', 'cancel')
    ),
    CONSTRAINT billing_approval_policies_tenant_action_unique UNIQUE (tenant_id, action_type)
);

COMMENT ON TABLE public.billing_approval_policies IS 'Per-tenant approval thresholds for billing actions';

-- ============================================================================
-- 5. billing_approval_requests — Billing-specific approval requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_approval_requests (
    approval_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    requested_by_user_id uuid NOT NULL,
    action_type text NOT NULL,
    payload jsonb NOT NULL,
    computed_delta jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    approved_by_user_id uuid,
    decision_reason text,
    effective_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT billing_approval_requests_status_check CHECK (
        status IN ('pending', 'approved', 'rejected', 'expired', 'canceled')
    ),
    CONSTRAINT billing_approval_requests_action_type_check CHECK (
        action_type IN ('plan_change', 'seat_change', 'enable_overage', 'increase_cap', 'billing_cycle_change', 'cancel')
    )
);

COMMENT ON TABLE public.billing_approval_requests IS 'Billing-specific approval requests with computed deltas';

CREATE INDEX IF NOT EXISTS idx_billing_approval_requests_tenant_status
    ON public.billing_approval_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_billing_approval_requests_expires
    ON public.billing_approval_requests (expires_at) WHERE status = 'pending';

-- ============================================================================
-- 6. entitlement_snapshots — Point-in-time entitlement records
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.entitlement_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    price_version_id uuid NOT NULL REFERENCES public.billing_price_versions(id),
    entitlements jsonb NOT NULL,
    effective_at timestamptz NOT NULL,
    superseded_at timestamptz,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.entitlement_snapshots IS 'Point-in-time record of tenant entitlements tied to a price version';

-- Fast lookup for current entitlements
CREATE INDEX IF NOT EXISTS idx_entitlement_snapshots_current
    ON public.entitlement_snapshots (tenant_id) WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entitlement_snapshots_tenant_effective
    ON public.entitlement_snapshots (tenant_id, effective_at DESC);

-- ============================================================================
-- 7. ALTER existing tables — Harden usage evidence + pin price versions
-- These tables are created in 20260213000010_canonical_identity_baseline.sql
-- which runs after this file. All alterations are guarded by table-existence
-- checks so this migration is safe to apply in any order.
-- ============================================================================

DO $$
BEGIN
    -- 7a. usage_events: add idempotency key + optional HMAC signature
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_events') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'idempotency_key') THEN
            ALTER TABLE public.usage_events ADD COLUMN idempotency_key text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'signature') THEN
            ALTER TABLE public.usage_events ADD COLUMN signature text;
        END IF;
        -- Update metric CHECK constraint to include ai_tokens
        ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS usage_events_metric_check;
        ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_metric_check
            CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));
    END IF;

    -- 7b. usage_aggregates: add evidence chain columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_aggregates') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'period_id') THEN
            ALTER TABLE public.usage_aggregates ADD COLUMN period_id uuid;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_event_count') THEN
            ALTER TABLE public.usage_aggregates ADD COLUMN source_event_count integer;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_hash') THEN
            ALTER TABLE public.usage_aggregates ADD COLUMN source_hash text;
        END IF;
        ALTER TABLE public.usage_aggregates DROP CONSTRAINT IF EXISTS usage_aggregates_metric_check;
        ALTER TABLE public.usage_aggregates ADD CONSTRAINT usage_aggregates_metric_check
            CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));
    END IF;

    -- 7c. subscriptions: pin to price version
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'price_version_id') THEN
            ALTER TABLE public.subscriptions ADD COLUMN price_version_id uuid REFERENCES public.billing_price_versions(id);
        END IF;
    END IF;

    -- 7d. invoices: reference price version
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'price_version_id') THEN
            ALTER TABLE public.invoices ADD COLUMN price_version_id uuid REFERENCES public.billing_price_versions(id);
        END IF;
    END IF;

    -- 7e. usage_alerts metric check
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_alerts') THEN
        ALTER TABLE public.usage_alerts DROP CONSTRAINT IF EXISTS usage_alerts_metric_check;
        ALTER TABLE public.usage_alerts ADD CONSTRAINT usage_alerts_metric_check
            CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));
    END IF;

    -- 7f. usage_quotas metric check
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_quotas') THEN
        ALTER TABLE public.usage_quotas DROP CONSTRAINT IF EXISTS usage_quotas_metric_check;
        ALTER TABLE public.usage_quotas ADD CONSTRAINT usage_quotas_metric_check
            CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));
    END IF;

    -- 7g. subscription_items metric check
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_items') THEN
        ALTER TABLE public.subscription_items DROP CONSTRAINT IF EXISTS subscription_items_metric_check;
        ALTER TABLE public.subscription_items ADD CONSTRAINT subscription_items_metric_check
            CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));
    END IF;
END $$;

-- Index for usage_events idempotency — only created if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_usage_events_idempotency') THEN
            CREATE UNIQUE INDEX idx_usage_events_idempotency
                ON public.usage_events (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 8. RLS policies for new tables
-- ============================================================================

ALTER TABLE public.billing_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_snapshots ENABLE ROW LEVEL SECURITY;

-- billing_meters is intentionally global catalog metadata (no tenant data).
-- Exception is explicit: meter definitions are product-wide constants and do
-- not encode usage, entitlement, or customer-specific state.
-- Risk acceptance: authenticated read-only access is allowed; anon access is
-- denied in production posture.
CREATE POLICY billing_meters_select ON public.billing_meters
    FOR SELECT TO authenticated USING (true);

-- billing_price_versions: global rows (tenant_id IS NULL) are readable by all
-- authenticated users; tenant-scoped rows require active membership.
CREATE POLICY billing_price_versions_select ON public.billing_price_versions
    FOR SELECT TO authenticated
    USING (
        tenant_id IS NULL
        OR security.user_has_tenant_access(tenant_id)
    );

-- usage_policies: tenant-scoped
CREATE POLICY usage_policies_tenant ON public.usage_policies
    FOR ALL TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

-- billing_approval_policies: tenant-scoped
CREATE POLICY billing_approval_policies_tenant ON public.billing_approval_policies
    FOR ALL TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

-- billing_approval_requests: tenant-scoped
CREATE POLICY billing_approval_requests_tenant ON public.billing_approval_requests
    FOR ALL TO authenticated
    USING (security.user_has_tenant_access(tenant_id))
    WITH CHECK (security.user_has_tenant_access(tenant_id));

-- entitlement_snapshots: tenant-scoped read
CREATE POLICY entitlement_snapshots_tenant ON public.entitlement_snapshots
    FOR SELECT TO authenticated
    USING (security.user_has_tenant_access(tenant_id));

-- service_role gets full access to all new tables
GRANT ALL ON public.billing_meters TO service_role;
GRANT ALL ON public.billing_price_versions TO service_role;
GRANT ALL ON public.usage_policies TO service_role;
GRANT ALL ON public.billing_approval_policies TO service_role;
GRANT ALL ON public.billing_approval_requests TO service_role;
GRANT ALL ON public.entitlement_snapshots TO service_role;

-- authenticated gets scoped access required by application paths
GRANT SELECT ON public.billing_meters TO authenticated;
GRANT SELECT ON public.billing_price_versions TO authenticated;
GRANT SELECT ON public.usage_policies TO authenticated;
GRANT SELECT ON public.billing_approval_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_approval_requests TO authenticated;
GRANT SELECT ON public.entitlement_snapshots TO authenticated;

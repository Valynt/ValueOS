-- ============================================================================
-- Required Extensions
-- These must be available before any table creation. On Supabase-hosted
-- instances they are pre-installed; on self-hosted Postgres they may need
-- superuser privileges.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ============================================================================
-- Billing V2 Foundation
-- Adds versioned pricing, meter catalog, entitlement snapshots, usage policies,
-- billing-specific approval workflows, and hardens usage evidence chain.
-- ============================================================================

SET search_path = public, pg_temp;

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
    definition jsonb NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    activated_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT billing_price_versions_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT billing_price_versions_plan_tier_check CHECK (plan_tier IN ('free', 'standard', 'enterprise')),
    CONSTRAINT billing_price_versions_tag_tier_unique UNIQUE (version_tag, plan_tier)
);

COMMENT ON TABLE public.billing_price_versions IS 'Immutable versioned pricing definitions per plan tier';

CREATE INDEX IF NOT EXISTS idx_billing_price_versions_active
    ON public.billing_price_versions (plan_tier, status) WHERE status = 'active';

-- Seed v1 pricing from current PLANS config
INSERT INTO public.billing_price_versions (version_tag, plan_tier, definition, status, activated_at)
VALUES
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
    }'::jsonb, 'active', now()),

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
    }'::jsonb, 'active', now()),

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
    }'::jsonb, 'active', now())
ON CONFLICT (version_tag, plan_tier) DO NOTHING;

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
-- ============================================================================

-- 7a. usage_events: add idempotency key + optional HMAC signature
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.usage_events ADD COLUMN idempotency_key text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'signature'
    ) THEN
        ALTER TABLE public.usage_events ADD COLUMN signature text;
    END IF;
END $$;

-- Unique constraint on (tenant_id, idempotency_key) for dedup — only where key is non-null
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_idempotency
    ON public.usage_events (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 7b. usage_aggregates: add evidence chain columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'period_id'
    ) THEN
        ALTER TABLE public.usage_aggregates ADD COLUMN period_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_event_count'
    ) THEN
        ALTER TABLE public.usage_aggregates ADD COLUMN source_event_count integer;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_hash'
    ) THEN
        ALTER TABLE public.usage_aggregates ADD COLUMN source_hash text;
    END IF;
END $$;

-- 7c. subscriptions: pin to price version
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'price_version_id'
    ) THEN
        ALTER TABLE public.subscriptions ADD COLUMN price_version_id uuid REFERENCES public.billing_price_versions(id);
    END IF;
END $$;

-- 7d. invoices: reference price version
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'price_version_id'
    ) THEN
        ALTER TABLE public.invoices ADD COLUMN price_version_id uuid REFERENCES public.billing_price_versions(id);
    END IF;
END $$;

-- 7e. Update metric CHECK constraints to include new meter keys
-- usage_events: add ai_tokens to allowed metrics
ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS usage_events_metric_check;
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_metric_check
    CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));

ALTER TABLE public.usage_aggregates DROP CONSTRAINT IF EXISTS usage_aggregates_metric_check;
ALTER TABLE public.usage_aggregates ADD CONSTRAINT usage_aggregates_metric_check
    CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));

ALTER TABLE public.usage_alerts DROP CONSTRAINT IF EXISTS usage_alerts_metric_check;
ALTER TABLE public.usage_alerts ADD CONSTRAINT usage_alerts_metric_check
    CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));

ALTER TABLE public.usage_quotas DROP CONSTRAINT IF EXISTS usage_quotas_metric_check;
ALTER TABLE public.usage_quotas ADD CONSTRAINT usage_quotas_metric_check
    CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));

ALTER TABLE public.subscription_items DROP CONSTRAINT IF EXISTS subscription_items_metric_check;
ALTER TABLE public.subscription_items ADD CONSTRAINT subscription_items_metric_check
    CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats', 'ai_tokens'));

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

-- billing_price_versions: tenant-scoped read access via tenant-linked
-- subscriptions, enforced from JWT tenant_id context.
CREATE POLICY billing_price_versions_select ON public.billing_price_versions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.subscriptions s
            WHERE s.price_version_id = billing_price_versions.id
              AND s.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        )
    );

-- usage_policies: tenant-scoped
CREATE POLICY usage_policies_tenant ON public.usage_policies
    FOR ALL TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- billing_approval_policies: tenant-scoped
CREATE POLICY billing_approval_policies_tenant ON public.billing_approval_policies
    FOR ALL TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- billing_approval_requests: tenant-scoped
CREATE POLICY billing_approval_requests_tenant ON public.billing_approval_requests
    FOR ALL TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- entitlement_snapshots: tenant-scoped read
CREATE POLICY entitlement_snapshots_tenant ON public.entitlement_snapshots
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

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

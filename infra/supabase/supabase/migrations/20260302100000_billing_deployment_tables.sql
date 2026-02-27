-- ============================================================================
-- Billing Deployment Tables
-- Adds approval_requests, usage tracking indexes, and feature_flags tables
-- needed by the billing deployment cronjobs and feature flag system.
--
-- Rollback: infra/supabase/supabase/rollbacks/20260302100000_billing_deployment_tables_rollback.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. approval_requests — Tracks billing-related approval workflows
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approval_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    request_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    requested_by uuid NOT NULL,
    approved_by uuid,
    resolution_note text,
    payload jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.approval_requests IS 'Billing approval workflows (plan changes, overage approvals, etc.)';

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status
    ON public.approval_requests (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status_created
    ON public.approval_requests (status, created_at)
    WHERE status = 'pending';

-- RLS
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_requests_tenant_isolation ON public.approval_requests
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY approval_requests_service_role ON public.approval_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 2. approval_attachments — Optional attachments for approval requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approval_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    uploaded_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_attachments_via_request ON public.approval_attachments
    USING (
        approval_request_id IN (
            SELECT id FROM public.approval_requests
            WHERE organization_id = (current_setting('app.current_organization_id', true))::uuid
        )
    );

CREATE POLICY approval_attachments_service_role ON public.approval_attachments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 3. feature_flags — Dynamic feature flags stored in DB
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    enabled boolean NOT NULL DEFAULT false,
    "rolloutPercentage" integer NOT NULL DEFAULT 0
        CHECK ("rolloutPercentage" >= 0 AND "rolloutPercentage" <= 100),
    targeting jsonb NOT NULL DEFAULT '{}',
    variants jsonb,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_flags IS 'Dynamic feature flags for gradual rollout and A/B testing';

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags (key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags (enabled) WHERE enabled = true;

-- feature_flags are global (not tenant-scoped), readable by authenticated users
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_flags_read ON public.feature_flags
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY feature_flags_service_role ON public.feature_flags
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 4. feature_flag_evaluations — Tracks flag evaluation for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key text NOT NULL,
    user_id text NOT NULL,
    enabled boolean NOT NULL,
    variant text,
    evaluated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_flag_evaluations IS 'Audit trail for feature flag evaluations';

CREATE INDEX IF NOT EXISTS idx_ff_evaluations_flag_key
    ON public.feature_flag_evaluations (flag_key, evaluated_at);

-- Partition-friendly index for cleanup
CREATE INDEX IF NOT EXISTS idx_ff_evaluations_evaluated_at
    ON public.feature_flag_evaluations (evaluated_at);

ALTER TABLE public.feature_flag_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ff_evaluations_service_role ON public.feature_flag_evaluations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 5. Add 'aggregated' column to usage_records if it doesn't exist
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'usage_records'
          AND column_name = 'aggregated'
    ) THEN
        ALTER TABLE public.usage_records ADD COLUMN aggregated boolean NOT NULL DEFAULT false;
        CREATE INDEX idx_usage_records_unaggregated
            ON public.usage_records (created_at)
            WHERE aggregated = false;
    END IF;
END $$;

-- ============================================================================
-- 6. Seed billing feature flags for gradual rollout
-- ============================================================================

INSERT INTO public.feature_flags (key, name, description, enabled, "rolloutPercentage", targeting, metadata)
VALUES
    ('billing.usage_metering', 'Usage Metering', 'Enable usage-based metering and Stripe submission', false, 0, '{}',
     '{"owner": "billing-team", "tags": ["billing", "metering"], "createdAt": "2026-03-02T00:00:00Z", "updatedAt": "2026-03-02T00:00:00Z"}'),
    ('billing.overage_charging', 'Overage Charging', 'Enable automatic overage billing beyond plan quotas', false, 0, '{}',
     '{"owner": "billing-team", "tags": ["billing", "overage"], "createdAt": "2026-03-02T00:00:00Z", "updatedAt": "2026-03-02T00:00:00Z"}'),
    ('billing.approval_workflows', 'Approval Workflows', 'Enable approval workflows for plan changes and overages', false, 0, '{}',
     '{"owner": "billing-team", "tags": ["billing", "approvals"], "createdAt": "2026-03-02T00:00:00Z", "updatedAt": "2026-03-02T00:00:00Z"}'),
    ('billing.invoice_generation', 'Invoice Generation', 'Enable automated invoice generation from rated ledger', false, 0, '{}',
     '{"owner": "billing-team", "tags": ["billing", "invoicing"], "createdAt": "2026-03-02T00:00:00Z", "updatedAt": "2026-03-02T00:00:00Z"}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Tenant Execution Pause State for Billing Spend Guardrails
-- ============================================================================

SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.tenant_execution_state (
    organization_id uuid PRIMARY KEY,
    is_paused boolean NOT NULL DEFAULT false,
    reason text,
    paused_at timestamptz,
    paused_by text,
    actor_type text NOT NULL DEFAULT 'system'
        CHECK (actor_type IN ('system', 'admin')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_execution_state IS 'Tenant-scoped execution gate used to pause/resume orchestration based on billing controls';

CREATE INDEX IF NOT EXISTS idx_tenant_execution_state_paused
    ON public.tenant_execution_state (organization_id, is_paused)
    WHERE is_paused = true;

ALTER TABLE public.tenant_execution_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_execution_state_tenant_isolation ON public.tenant_execution_state
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY tenant_execution_state_service_role ON public.tenant_execution_state
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tenant_execution_state_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('paused', 'resumed')),
    actor_id text NOT NULL,
    actor_type text NOT NULL CHECK (actor_type IN ('system', 'admin')),
    reason text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_execution_state_audit IS 'Immutable audit trail for tenant execution pause/resume transitions';

CREATE INDEX IF NOT EXISTS idx_tenant_execution_state_audit_org_created
    ON public.tenant_execution_state_audit (organization_id, created_at DESC);

ALTER TABLE public.tenant_execution_state_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_execution_state_audit_tenant_isolation ON public.tenant_execution_state_audit
    USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);

CREATE POLICY tenant_execution_state_audit_service_role ON public.tenant_execution_state_audit
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

SET search_path = public, pg_temp;

BEGIN;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.tenant_mcp_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'internal')),
  auth_type text NOT NULL CHECK (auth_type IN ('oauth', 'api_key', 'service_account')),
  connection_state text NOT NULL DEFAULT 'pending_validation' CHECK (
    connection_state IN ('connected', 'degraded', 'failed', 'disabled', 'disconnected', 'pending_validation')
  ),
  reason_code text CHECK (
    reason_code IN (
      'auth_invalid',
      'auth_expired',
      'network_unreachable',
      'scope_missing',
      'provider_rate_limited',
      'provider_unavailable',
      'sync_failed',
      'validation_failed',
      'disabled_by_admin',
      'manual_disconnect',
      'unknown_error'
    )
  ),
  reason_message text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  queued_validation_job_id text,
  queued_sync_job_id text,
  validated_at timestamptz,
  health_checked_at timestamptz,
  disabled_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_mcp_integrations_tenant_provider
  ON public.tenant_mcp_integrations (tenant_id, provider);

ALTER TABLE public.tenant_mcp_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_mcp_integrations_select ON public.tenant_mcp_integrations;
DROP POLICY IF EXISTS tenant_mcp_integrations_insert ON public.tenant_mcp_integrations;
DROP POLICY IF EXISTS tenant_mcp_integrations_update ON public.tenant_mcp_integrations;
DROP POLICY IF EXISTS tenant_mcp_integrations_delete ON public.tenant_mcp_integrations;

CREATE POLICY tenant_mcp_integrations_select
  ON public.tenant_mcp_integrations FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integrations_insert
  ON public.tenant_mcp_integrations FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integrations_update
  ON public.tenant_mcp_integrations FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integrations_delete
  ON public.tenant_mcp_integrations FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

GRANT ALL ON public.tenant_mcp_integrations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_mcp_integrations TO authenticated;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.tenant_mcp_integration_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.tenant_mcp_integrations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'internal')),
  action text NOT NULL,
  actor_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_mcp_audit_tenant_created_at
  ON public.tenant_mcp_integration_audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_mcp_audit_integration
  ON public.tenant_mcp_integration_audit_events (tenant_id, integration_id, created_at DESC);

ALTER TABLE public.tenant_mcp_integration_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_mcp_integration_audit_events_select ON public.tenant_mcp_integration_audit_events;
DROP POLICY IF EXISTS tenant_mcp_integration_audit_events_insert ON public.tenant_mcp_integration_audit_events;
DROP POLICY IF EXISTS tenant_mcp_integration_audit_events_update ON public.tenant_mcp_integration_audit_events;
DROP POLICY IF EXISTS tenant_mcp_integration_audit_events_delete ON public.tenant_mcp_integration_audit_events;

CREATE POLICY tenant_mcp_integration_audit_events_select
  ON public.tenant_mcp_integration_audit_events FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integration_audit_events_insert
  ON public.tenant_mcp_integration_audit_events FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integration_audit_events_update
  ON public.tenant_mcp_integration_audit_events FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integration_audit_events_delete
  ON public.tenant_mcp_integration_audit_events FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

GRANT ALL ON public.tenant_mcp_integration_audit_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_mcp_integration_audit_events TO authenticated;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.tenant_mcp_integration_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integration_id uuid NOT NULL REFERENCES public.tenant_mcp_integrations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'internal')),
  reason_code text NOT NULL CHECK (
    reason_code IN (
      'auth_invalid',
      'auth_expired',
      'network_unreachable',
      'scope_missing',
      'provider_rate_limited',
      'provider_unavailable',
      'sync_failed',
      'validation_failed',
      'disabled_by_admin',
      'manual_disconnect',
      'unknown_error'
    )
  ),
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_mcp_failures_tenant_created_at
  ON public.tenant_mcp_integration_failures (tenant_id, created_at DESC);

ALTER TABLE public.tenant_mcp_integration_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_mcp_integration_failures_select ON public.tenant_mcp_integration_failures;
DROP POLICY IF EXISTS tenant_mcp_integration_failures_insert ON public.tenant_mcp_integration_failures;
DROP POLICY IF EXISTS tenant_mcp_integration_failures_update ON public.tenant_mcp_integration_failures;
DROP POLICY IF EXISTS tenant_mcp_integration_failures_delete ON public.tenant_mcp_integration_failures;

CREATE POLICY tenant_mcp_integration_failures_select
  ON public.tenant_mcp_integration_failures FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integration_failures_insert
  ON public.tenant_mcp_integration_failures FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integration_failures_update
  ON public.tenant_mcp_integration_failures FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_mcp_integration_failures_delete
  ON public.tenant_mcp_integration_failures FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

GRANT ALL ON public.tenant_mcp_integration_failures TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_mcp_integration_failures TO authenticated;

COMMIT;

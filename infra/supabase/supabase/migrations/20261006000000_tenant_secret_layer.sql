-- Tenant-Safe Secret Layer
-- Implements secure, multi-tenant secret management layer

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. tenant_secrets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_secrets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,                          -- tenant isolation — required
  integration      text        NOT NULL,
  secret_name      text        NOT NULL,
  encrypted_value  text        NOT NULL,
  key_version      integer     NOT NULL DEFAULT 1,
  environment      text        NOT NULL DEFAULT 'production',
  allowed_agents   text[]      NOT NULL DEFAULT '{}',
  allowed_tools    text[]      NOT NULL DEFAULT '{}',
  allowed_purposes text[]      NOT NULL DEFAULT '{}',
  rotation_metadata jsonb      NOT NULL DEFAULT '{}'::jsonb,
  created_by       text        NOT NULL,
  updated_by       text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, integration, secret_name, environment)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_secrets_org_id
  ON public.tenant_secrets (organization_id);
CREATE INDEX IF NOT EXISTS idx_tenant_secrets_lookup
  ON public.tenant_secrets (organization_id, integration, environment);

-- RLS
ALTER TABLE public.tenant_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_secrets_tenant_select
  ON public.tenant_secrets FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY tenant_secrets_tenant_insert
  ON public.tenant_secrets FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY tenant_secrets_tenant_update
  ON public.tenant_secrets FOR UPDATE
  USING  (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY tenant_secrets_tenant_delete
  ON public.tenant_secrets FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

GRANT ALL ON public.tenant_secrets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_secrets TO authenticated;

-- ============================================================================
-- 2. secret_access_audits
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.secret_access_audits (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,                          -- tenant isolation — required
  agent_id         text        NOT NULL,
  workflow_id      text,
  run_id           text,
  capability       text        NOT NULL,
  purpose          text        NOT NULL,
  tool_name        text        NOT NULL,
  decision         text        NOT NULL CHECK (decision IN ('allow', 'deny')),
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_secret_access_audits_org_id
  ON public.secret_access_audits (organization_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_audits_lookup
  ON public.secret_access_audits (organization_id, agent_id, created_at);

-- RLS
ALTER TABLE public.secret_access_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY secret_access_audits_tenant_select
  ON public.secret_access_audits FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY secret_access_audits_tenant_insert
  ON public.secret_access_audits FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

-- Audits are immutable, no update or delete policies

GRANT ALL ON public.secret_access_audits TO service_role;
GRANT SELECT, INSERT ON public.secret_access_audits TO authenticated;

COMMIT;

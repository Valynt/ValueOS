-- P1 gap tables: sessions, messages, agent_audit_logs.
--
-- These tables are referenced by production code (dataSubjectRequests.ts,
-- AgentAuditLogger.ts) but had no active migration. GDPR Art. 17 erasure
-- silently skipped sessions and messages; agent audit writes failed at runtime.
--
-- Relationship to existing tables:
--   sessions      → lightweight user session store (distinct from agent_sessions)
--   messages      → conversation messages per case/workflow
--   agent_audit_logs → AgentAuditLogger.ts persistence target

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. sessions
-- User session store. Referenced by dataSubjectRequests.ts GDPR erasure path.
-- Distinct from agent_sessions (agent execution context) and active_sessions
-- (presence/realtime). This table tracks authenticated user sessions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id       uuid        NOT NULL,
  session_token   text        NOT NULL UNIQUE,
  ip_address      text,
  user_agent      text,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_tenant
  ON public.sessions (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_sessions_tenant_created
  ON public.sessions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON public.sessions (expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_tenant_select ON public.sessions
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY sessions_tenant_insert ON public.sessions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY sessions_tenant_update ON public.sessions
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY sessions_tenant_delete ON public.sessions
  FOR DELETE USING (security.user_has_tenant_access(tenant_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;

-- ============================================================================
-- 2. messages
-- Conversation messages per case or workflow.
-- Referenced by dataSubjectRequests.ts GDPR erasure (PII_TABLES list).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  tenant_id       uuid        NOT NULL,
  case_id         uuid,
  workflow_id     uuid,
  content         text        NOT NULL,
  role            text        NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_role_check CHECK (
    role = ANY (ARRAY['user', 'assistant', 'system'])
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_user_tenant
  ON public.messages (user_id, tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_case_id
  ON public.messages (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_created
  ON public.messages (tenant_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_tenant_select ON public.messages
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY messages_tenant_insert ON public.messages
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY messages_tenant_update ON public.messages
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY messages_tenant_delete ON public.messages
  FOR DELETE USING (security.user_has_tenant_access(tenant_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- ============================================================================
-- 3. agent_audit_logs
-- Persistence target for AgentAuditLogger.ts. Stores per-agent invocation
-- records with encrypted sensitive fields, confidence scores, and token usage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_audit_logs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL,
  user_id             uuid,
  session_id          text,
  agent_name          text        NOT NULL,
  input_query         text        NOT NULL,
  response_data       jsonb,
  response_metadata   jsonb,
  context             jsonb,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  success             boolean     NOT NULL DEFAULT true,
  error_message       text,
  timestamp           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_org_created
  ON public.agent_audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_agent_org
  ON public.agent_audit_logs (agent_name, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_session
  ON public.agent_audit_logs (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user
  ON public.agent_audit_logs (user_id, created_at DESC);

ALTER TABLE public.agent_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_audit_logs_tenant_select ON public.agent_audit_logs
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

-- Writes are service_role only (AgentAuditLogger uses service_role client).
CREATE POLICY agent_audit_logs_service_role ON public.agent_audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.agent_audit_logs TO authenticated;
GRANT ALL    ON public.agent_audit_logs TO service_role;

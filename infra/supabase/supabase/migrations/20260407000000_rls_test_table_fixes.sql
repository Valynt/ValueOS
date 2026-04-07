-- Migration: Create missing tables for RLS test compliance
-- Created: 2026-04-07
-- Purpose: Add agent_sessions and dead_letter_events tables with proper RLS

SET search_path = public, security, pg_temp;

BEGIN;

-- ============================================================================
-- 1. Create agent_sessions table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    session_token text NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    agent_id text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    metadata jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (using organization_id for UUID type)
DROP POLICY IF EXISTS agent_sessions_tenant_isolation ON public.agent_sessions;
CREATE POLICY agent_sessions_tenant_isolation ON public.agent_sessions
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = (auth.uid())::text LIMIT 1))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = (auth.uid())::text LIMIT 1));

-- Service role bypass
DROP POLICY IF EXISTS agent_sessions_service_role ON public.agent_sessions;
CREATE POLICY agent_sessions_service_role ON public.agent_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lock down
REVOKE ALL ON public.agent_sessions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_sessions TO service_role;
GRANT SELECT ON public.agent_sessions TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_id ON public.agent_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_organization_id ON public.agent_sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON public.agent_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON public.agent_sessions (agent_id);

-- ============================================================================
-- 2. Create dead_letter_events table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dead_letter_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}',
    error_message text,
    retry_count integer NOT NULL DEFAULT 0,
    max_retries integer NOT NULL DEFAULT 3,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    error_details jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.dead_letter_events ENABLE ROW LEVEL SECURITY;

-- Service role only (authenticated users should not access DLQ)
DROP POLICY IF EXISTS dead_letter_events_service_role ON public.dead_letter_events;
CREATE POLICY dead_letter_events_service_role ON public.dead_letter_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Block authenticated entirely
DROP POLICY IF EXISTS dead_letter_events_no_authenticated ON public.dead_letter_events;
CREATE POLICY dead_letter_events_no_authenticated ON public.dead_letter_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Lock down
REVOKE ALL ON public.dead_letter_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.dead_letter_events TO service_role;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dead_letter_events_tenant_id ON public.dead_letter_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dead_letter_events_event_type ON public.dead_letter_events (event_type);
CREATE INDEX IF NOT EXISTS idx_dead_letter_events_created_at ON public.dead_letter_events (created_at);

-- ============================================================================
-- 3. Fix audit_logs - ensure proper RLS policies exist
-- ============================================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing to recreate with correct logic
DROP POLICY IF EXISTS audit_logs_tenant_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_update ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_delete ON public.audit_logs;

-- Allow tenant members to read their own audit logs
CREATE POLICY audit_logs_tenant_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::text OR organization_id IN (SELECT organization_id FROM public.user_tenants WHERE user_id = (auth.uid())::text));

-- Service role full access
DROP POLICY IF EXISTS audit_logs_service_role ON public.audit_logs;
CREATE POLICY audit_logs_service_role ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoke and grant
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- ============================================================================
-- 4. Fix webhook_events - ensure proper RLS (service role only)
-- ============================================================================

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Ensure service role policy exists
DROP POLICY IF EXISTS webhook_events_service_role ON public.webhook_events;
CREATE POLICY webhook_events_service_role ON public.webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Block authenticated access
DROP POLICY IF EXISTS webhook_events_no_authenticated ON public.webhook_events;
CREATE POLICY webhook_events_no_authenticated ON public.webhook_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Lock down
REVOKE ALL ON public.webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.webhook_events TO service_role;

-- ============================================================================
-- 5. Fix semantic_memory - ensure proper tenant isolation
-- ============================================================================

ALTER TABLE public.semantic_memory ENABLE ROW LEVEL SECURITY;

-- Ensure tenant policies exist (idempotent)
DROP POLICY IF EXISTS semantic_memory_tenant_select ON public.semantic_memory;
DROP POLICY IF EXISTS semantic_memory_tenant_insert ON public.semantic_memory;
DROP POLICY IF EXISTS semantic_memory_tenant_update ON public.semantic_memory;
DROP POLICY IF EXISTS semantic_memory_tenant_delete ON public.semantic_memory;

CREATE POLICY semantic_memory_tenant_select ON public.semantic_memory
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_tenants WHERE user_id = (auth.uid())::text));

CREATE POLICY semantic_memory_tenant_insert ON public.semantic_memory
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_tenants WHERE user_id = (auth.uid())::text));

CREATE POLICY semantic_memory_tenant_update ON public.semantic_memory
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_tenants WHERE user_id = (auth.uid())::text));

CREATE POLICY semantic_memory_tenant_delete ON public.semantic_memory
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_tenants WHERE user_id = (auth.uid())::text));

-- Service role bypass
DROP POLICY IF EXISTS semantic_memory_service_role ON public.semantic_memory;
CREATE POLICY semantic_memory_service_role ON public.semantic_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lock down
REVOKE ALL ON public.semantic_memory FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semantic_memory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semantic_memory TO authenticated;

COMMIT;

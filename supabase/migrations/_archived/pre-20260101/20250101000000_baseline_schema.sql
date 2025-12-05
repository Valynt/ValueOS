-- ============================================================================
-- ValueCanvas Baseline Schema
-- Created: January 1, 2025
-- Consolidated from 52 previous migrations into single clean baseline
--
-- This is the ONLY migration file for a fresh deployment.
-- All security, performance, and feature requirements are included here.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Core User & Organization Management
-- ============================================================================

-- Extended user profiles (links to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  job_title TEXT,
  user_preferences JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Organizations (multi-tenancy)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  organization_settings JSONB DEFAULT '{}'::JSONB,
  billing_info JSONB DEFAULT '{}'::JSONB,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Teams within organizations
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  team_settings JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(organization_id, slug)
);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT UNIQUE NOT NULL,
  permissions JSONB DEFAULT '[]'::JSONB,
  is_custom_role BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Organization membership
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, organization_id)
);

-- Team membership
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, team_id)
);

-- ============================================================================
-- SECTION 2: Core Application Tables (Cases, Workflows, Messages)
-- ============================================================================

-- Cases/Tickets
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Workflows
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'failed')),
  workflow_type TEXT DEFAULT 'standard',
  config JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Messages/Conversations
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- SECTION 3: Agent Fabric (Agents, Sessions, Memory)
-- ============================================================================

-- Agent definitions
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  model TEXT DEFAULT 'gpt-4',
  temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER DEFAULT 4096,
  config JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Agent sessions
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  workflow_state JSONB DEFAULT '{}'::JSONB,
  context JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Episodic memory (agent event stream)
CREATE TABLE IF NOT EXISTS public.episodic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  sequence_number BIGSERIAL,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Agent memory (vector embeddings for semantic search)
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('semantic', 'episodic', 'procedural', 'working')),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  metadata JSONB DEFAULT '{}'::JSONB,
  importance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 4: LLM Monitoring & Cost Tracking
-- ============================================================================

-- LLM usage tracking
CREATE TABLE IF NOT EXISTS public.llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  provider TEXT DEFAULT 'openai',
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost DECIMAL(10,6),
  latency_ms INTEGER,
  request_metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Agent predictions (for quality tracking)
CREATE TABLE IF NOT EXISTS public.agent_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  prediction_type TEXT NOT NULL,
  prediction_data JSONB NOT NULL,
  confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  actual_outcome JSONB,
  feedback_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  evaluated_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 5: Feature Flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- SECTION 6: Security & Audit
-- ============================================================================

-- Audit logs (IMMUTABLE - see triggers below)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Security audit log (for security events)
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Agent audit log
CREATE TABLE IF NOT EXISTS public.agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  action_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- SECTION 7: Helper Functions
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Prevent audit log modifications (immutability)
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- SECTION 8: Triggers
-- ============================================================================

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_cases_updated_at ON public.cases;
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_agents_updated_at ON public.agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_agent_sessions_updated_at ON public.agent_sessions;
CREATE TRIGGER update_agent_sessions_updated_at
  BEFORE UPDATE ON public.agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Audit immutability triggers
DROP TRIGGER IF EXISTS tr_protect_audit_logs ON public.audit_logs;
CREATE TRIGGER tr_protect_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

DROP TRIGGER IF EXISTS tr_protect_security_audit ON public.security_audit_log;
CREATE TRIGGER tr_protect_security_audit
  BEFORE UPDATE OR DELETE ON public.security_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

DROP TRIGGER IF EXISTS tr_protect_agent_audit ON public.agent_audit_log;
CREATE TRIGGER tr_protect_agent_audit
  BEFORE UPDATE OR DELETE ON public.agent_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

-- ============================================================================
-- SECTION 9: Performance Indexes
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_tier ON public.organizations(subscription_tier);

-- Organization members
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_org_status ON public.organization_members(user_id, organization_id, status) WHERE status = 'active';

-- Cases
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_organization_id ON public.cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);

-- Workflows
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_organization_id ON public.workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_case_id ON public.workflows(case_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_case_id ON public.messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_workflow_id ON public.messages(workflow_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- Agent sessions
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON public.agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON public.agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at ON public.agent_sessions(updated_at DESC);

-- Episodic memory
CREATE INDEX IF NOT EXISTS idx_episodic_memory_session_id ON public.episodic_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_timestamp ON public.episodic_memory(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_event_type ON public.episodic_memory(event_type);

-- Agent memory (vector search)
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON public.agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_session_id ON public.agent_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_user_id ON public.agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding ON public.agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- LLM usage
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON public.llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_organization_id ON public.llm_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_session_id ON public.llm_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON public.llm_usage(created_at DESC);

-- Agent predictions
CREATE INDEX IF NOT EXISTS idx_agent_predictions_session_id ON public.agent_predictions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_agent_id ON public.agent_predictions(agent_id);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- SECTION 10: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Users: Can view and update own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Organizations: Members can view their organizations
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Cases: Users own their cases
CREATE POLICY "Users own their cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Workflows: Users own their workflows
CREATE POLICY "Users own their workflows"
  ON public.workflows FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages: Users own their messages
CREATE POLICY "Users own their messages"
  ON public.messages FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Agent sessions: Users own their sessions
CREATE POLICY "Users own their agent sessions"
  ON public.agent_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Episodic memory: Access via session ownership
CREATE POLICY "Users access episodic memory via sessions"
  ON public.episodic_memory FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.agent_sessions WHERE user_id = auth.uid()
    )
  );

-- Agent predictions: Access via session ownership
CREATE POLICY "Users view own predictions"
  ON public.agent_predictions FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.agent_sessions WHERE user_id = auth.uid()
    )
  );

-- LLM usage: Users view own usage
CREATE POLICY "Users view own llm usage"
  ON public.llm_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Audit logs: Users view own audit logs
CREATE POLICY "Users view own audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Feature flags: Everyone can read, only service_role can write
CREATE POLICY "Anyone can view feature flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- Service role bypass for all tables
CREATE POLICY "Service role full access to users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to organizations" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to teams" ON public.teams FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to organization_members" ON public.organization_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to team_members" ON public.team_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to cases" ON public.cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to workflows" ON public.workflows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to messages" ON public.messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to agents" ON public.agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to agent_sessions" ON public.agent_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to episodic_memory" ON public.episodic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to agent_memory" ON public.agent_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to llm_usage" ON public.llm_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to agent_predictions" ON public.agent_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to audit_logs" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to security_audit_log" ON public.security_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to agent_audit_log" ON public.agent_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to feature_flags" ON public.feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- SECTION 11: Enable pgvector Extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- SECTION 12: Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.users IS 'Extended user profiles linked to auth.users';
COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations';
COMMENT ON TABLE public.teams IS 'Teams within organizations';
COMMENT ON TABLE public.cases IS 'Core cases/tickets managed by users';
COMMENT ON TABLE public.workflows IS 'Workflow instances associated with cases';
COMMENT ON TABLE public.messages IS 'Messages/conversations within cases and workflows';
COMMENT ON TABLE public.agents IS 'AI agent definitions';
COMMENT ON TABLE public.agent_sessions IS 'Active agent sessions with workflow state';
COMMENT ON TABLE public.episodic_memory IS 'Immutable event stream for agent sessions';
COMMENT ON TABLE public.agent_memory IS 'Vector-based semantic memory for agents';
COMMENT ON TABLE public.llm_usage IS 'LLM API usage tracking for cost monitoring';
COMMENT ON TABLE public.agent_predictions IS 'Agent prediction quality tracking';
COMMENT ON TABLE public.feature_flags IS 'Application feature flags';
COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for all actions';
COMMENT ON TABLE public.security_audit_log IS 'Immutable security event log';
COMMENT ON TABLE public.agent_audit_log IS 'Immutable agent action audit log';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  rls_enabled_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT count(*) INTO table_count FROM pg_tables WHERE schemaname = 'public';
  SELECT count(*) INTO rls_enabled_count FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
  SELECT count(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
  SELECT count(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ValueCanvas Baseline Schema Created Successfully';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables created:        %', table_count;
  RAISE NOTICE 'RLS enabled on:        %', rls_enabled_count;
  RAISE NOTICE 'Indexes created:       %', index_count;
  RAISE NOTICE 'RLS policies created:  %', policy_count;
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Key Features:';
  RAISE NOTICE '  ✓ Multi-tenancy (organizations, teams)';
  RAISE NOTICE '  ✓ Agent Fabric with episodic memory';
  RAISE NOTICE '  ✓ LLM usage & cost tracking';
  RAISE NOTICE '  ✓ Vector search (pgvector)';
  RAISE NOTICE '  ✓ Immutable audit logs';
  RAISE NOTICE '  ✓ Row Level Security on all tables';
  RAISE NOTICE '  ✓ Performance indexes';
  RAISE NOTICE '';
END $$;

COMMIT;

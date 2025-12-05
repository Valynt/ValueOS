-- ============================================================================
-- ValueCanvas Baseline Schema (Multi-tenant, Agent Fabric, Value Fabric)
-- Created: 2026-01-01
-- This migration is intended as a FRESH BASELINE for greenfield deployments.
-- It consolidates core identity/tenancy, application, agent fabric, 
-- value fabric, observability, and RLS into a single file.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 0: Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- SECTION 1: Core Identity & Tenancy
-- ============================================================================

-- Extended user profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  job_title TEXT,
  user_preferences JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT true NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','enterprise')),
  organization_settings JSONB DEFAULT '{}'::JSONB,
  billing_info JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT true NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles (optionally org-scoped)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]'::JSONB,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_custom_role BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roles_name_org_unique UNIQUE (role_name, organization_id)
);

-- Organization membership
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, organization_id)
);

-- Teams within organizations
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  team_settings JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (organization_id, slug)
);

-- Team membership
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, team_id)
);

-- ============================================================================
-- SECTION 2: Helper Functions (RLS helpers, timestamps, audit immutability)
-- ============================================================================

-- Update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if current user is active member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is admin/owner in organization (via roles table)
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.roles r ON r.id = om.role_id
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND r.role_name IN ('owner','admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent modifications to immutable audit tables
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- SECTION 3: Application Layer (Cases, Workflows, Messages)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed','archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','failed')),
  workflow_type TEXT NOT NULL DEFAULT 'standard',
  config JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 4: Agent Fabric (Agents, Sessions, Memory, LLM usage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  model TEXT DEFAULT 'gpt-4',
  temperature NUMERIC(3,2) DEFAULT 0.70 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER DEFAULT 4096,
  config JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','failed')),
  workflow_state JSONB DEFAULT '{}'::JSONB,
  context JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.episodic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  sequence_number BIGSERIAL,
  metadata JSONB DEFAULT '{}'::JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('semantic','episodic','procedural','working')),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::JSONB,
  importance_score NUMERIC(3,2) DEFAULT 0.50 CHECK (importance_score >= 0 AND importance_score <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost NUMERIC(10,6),
  latency_ms INTEGER,
  request_metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  prediction_type TEXT NOT NULL,
  prediction_data JSONB NOT NULL,
  confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  actual_outcome JSONB,
  feedback_score NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 5: Value Fabric (Business Objectives, Value Trees, ROI, Realization)
-- Multi-tenant adaptation of blueprint/value_fabric/postgres_schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority SMALLINT CHECK (priority >= 1 AND priority <= 5),
  owner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[]
);

CREATE TABLE IF NOT EXISTS public.use_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.use_case_capabilities (
  use_case_id UUID NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  PRIMARY KEY (use_case_id, capability_id)
);

CREATE TABLE IF NOT EXISTS public.kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  measurement TEXT CHECK (measurement IN ('percentage','currency','time','count')),
  target_direction TEXT CHECK (target_direction IN ('increase','decrease'))
);

CREATE TABLE IF NOT EXISTS public.use_case_kpis (
  use_case_id UUID NOT NULL REFERENCES public.use_cases(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  PRIMARY KEY (use_case_id, kpi_id)
);

CREATE TABLE IF NOT EXISTS public.financial_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('revenue','cost','risk')),
  currency CHAR(3),
  unit TEXT
);

CREATE TABLE IF NOT EXISTS public.kpi_financial_metrics (
  kpi_id UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  financial_metric_id UUID NOT NULL REFERENCES public.financial_metrics(id) ON DELETE CASCADE,
  PRIMARY KEY (kpi_id, financial_metric_id)
);

CREATE TABLE IF NOT EXISTS public.value_trees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  use_case_id UUID REFERENCES public.use_cases(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  version INT DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.value_tree_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value_tree_id UUID NOT NULL REFERENCES public.value_trees(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT CHECK (type IN ('capability','outcome','kpi','financialMetric')),
  reference_id UUID,
  properties JSONB DEFAULT '{}'::JSONB,
  position_x REAL,
  position_y REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (value_tree_id, node_id)
);

CREATE TABLE IF NOT EXISTS public.value_tree_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value_tree_id UUID NOT NULL REFERENCES public.value_trees(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.value_tree_nodes(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.value_tree_nodes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roi_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value_tree_id UUID REFERENCES public.value_trees(id) ON DELETE CASCADE,
  assumptions TEXT[],
  financial_model_id UUID,
  confidence_level TEXT,
  version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roi_model_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  roi_model_id UUID NOT NULL REFERENCES public.roi_models(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  formula TEXT,
  description TEXT,
  calculation_order INT,
  result_type TEXT,
  unit TEXT,
  input_variables JSONB,
  source_references JSONB,
  reasoning_trace TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE,
  industry TEXT,
  region TEXT,
  value DOUBLE PRECISION,
  unit TEXT
);

CREATE TABLE IF NOT EXISTS public.value_commits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value_tree_id UUID REFERENCES public.value_trees(id) ON DELETE CASCADE,
  value_case_id UUID,
  committed_by UUID,
  committed_by_name TEXT,
  status TEXT,
  date_committed TIMESTAMPTZ,
  target_date TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kpi_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value_commit_id UUID REFERENCES public.value_commits(id) ON DELETE CASCADE,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE,
  kpi_hypothesis_id UUID,
  kpi_name TEXT,
  target_value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  deadline TIMESTAMPTZ,
  confidence_level TEXT
);

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS public.realization_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value_commit_id UUID REFERENCES public.value_commits(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.realization_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  realization_report_id UUID REFERENCES public.realization_reports(id) ON DELETE CASCADE,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE,
  actual_value DOUBLE PRECISION NOT NULL,
  target_value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  variance DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS public.expansion_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value_tree_id UUID REFERENCES public.value_trees(id) ON DELETE CASCADE,
  executive_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expansion_improvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expansion_model_id UUID REFERENCES public.expansion_models(id) ON DELETE CASCADE,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE,
  incremental_value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  confidence DOUBLE PRECISION CHECK (confidence >= 0 AND confidence <= 1)
);

-- ============================================================================
-- SECTION 6: Governance, Feature Flags, Audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.agent_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  action_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 7: Triggers (updated_at, immutable audits)
-- ============================================================================

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_update_users ON public.users;
CREATE TRIGGER trg_update_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_update_organizations ON public.organizations;
CREATE TRIGGER trg_update_organizations
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_update_teams ON public.teams;
CREATE TRIGGER trg_update_teams
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_update_business_objectives ON public.business_objectives;
CREATE TRIGGER trg_update_business_objectives
  BEFORE UPDATE ON public.business_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_update_value_trees ON public.value_trees;
CREATE TRIGGER trg_update_value_trees
  BEFORE UPDATE ON public.value_trees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- audit immutability triggers
DROP TRIGGER IF EXISTS tr_protect_audit_logs ON public.audit_logs;
CREATE TRIGGER tr_protect_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

DROP TRIGGER IF EXISTS tr_protect_security_audit ON public.security_audit_log;
CREATE TRIGGER tr_protect_security_audit
  BEFORE UPDATE OR DELETE ON public.security_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

DROP TRIGGER IF EXISTS tr_protect_agent_audit ON public.agent_audit_log;
CREATE TRIGGER tr_protect_agent_audit
  BEFORE UPDATE OR DELETE ON public.agent_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- ============================================================================
-- SECTION 8: Indexes
-- ============================================================================

-- Identity & tenancy
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- Application
CREATE INDEX IF NOT EXISTS idx_cases_org ON public.cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_user ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org ON public.workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_user ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON public.messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);

-- Agent fabric
CREATE INDEX IF NOT EXISTS idx_agents_org ON public.agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org ON public.agent_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_session ON public.episodic_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_org ON public.episodic_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_org ON public.agent_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON public.agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON public.agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding ON public.agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_llm_usage_org ON public.llm_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_org ON public.agent_predictions(organization_id);

-- Value Fabric
CREATE INDEX IF NOT EXISTS idx_business_objectives_org ON public.business_objectives(organization_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_org ON public.capabilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_use_cases_org ON public.use_cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpis_org ON public.kpis(organization_id);
CREATE INDEX IF NOT EXISTS idx_value_trees_org ON public.value_trees(organization_id);
CREATE INDEX IF NOT EXISTS idx_roi_models_org ON public.roi_models(organization_id);
CREATE INDEX IF NOT EXISTS idx_value_commits_org ON public.value_commits(organization_id);
CREATE INDEX IF NOT EXISTS idx_realization_reports_org ON public.realization_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_expansion_models_org ON public.expansion_models(organization_id);

-- Audit
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- SECTION 9: Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all multi-tenant tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.business_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.use_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.use_case_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.use_case_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_financial_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_tree_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roi_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roi_model_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realization_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realization_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view/update their own profile
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Organizations: members can view their orgs
CREATE POLICY orgs_select_memberships ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

-- Organization members: users see their memberships
CREATE POLICY org_members_select_own ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Generic tenant isolation policy pattern for org-scoped tables
-- (example applied to cases; similar semantics for others)
CREATE POLICY cases_tenant_isolation ON public.cases
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY workflows_tenant_isolation ON public.workflows
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY messages_tenant_isolation ON public.messages
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY agents_tenant_isolation ON public.agents
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY agent_sessions_tenant_isolation ON public.agent_sessions
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY episodic_memory_tenant_isolation ON public.episodic_memory
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY agent_memory_tenant_isolation ON public.agent_memory
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY llm_usage_tenant_isolation ON public.llm_usage
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY agent_predictions_tenant_isolation ON public.agent_predictions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- Value Fabric tables: tenant isolation via organization_id
CREATE POLICY valuefabric_tenant_isolation ON public.business_objectives
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY valuefabric_capabilities_tenant ON public.capabilities
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY valuefabric_use_cases_tenant ON public.use_cases
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY valuefabric_kpis_tenant ON public.kpis
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- For brevity, remaining Value Fabric tables rely on organization_id + service_role bypass
CREATE POLICY valuefabric_value_trees_tenant ON public.value_trees
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY valuefabric_value_commits_tenant ON public.value_commits
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Feature flags: any authenticated user can read; management via service_role/admin
CREATE POLICY feature_flags_select_all ON public.feature_flags
  FOR SELECT TO authenticated
  USING (true);

-- Audit logs: users can read their own, writes via service_role/backend only
CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role bypass for backend services (full access)
CREATE POLICY service_role_users ON public.users
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_orgs ON public.organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_cases ON public.cases
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_workflows ON public.workflows
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_messages ON public.messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_agents ON public.agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_agent_sessions ON public.agent_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_agent_memory ON public.agent_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_valuefabric ON public.business_objectives
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_audit_logs ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- SECTION 10: Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE public.users IS 'Extended user profiles linked to auth.users';
COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations (tenants)';
COMMENT ON TABLE public.organization_members IS 'Membership of users in organizations (tenant-level)';
COMMENT ON TABLE public.cases IS 'Core cases/tickets per tenant and user';
COMMENT ON TABLE public.workflows IS 'Workflow instances associated with cases';
COMMENT ON TABLE public.messages IS 'Messages within cases and workflows';
COMMENT ON TABLE public.agents IS 'AI agent definitions (Agent Fabric)';
COMMENT ON TABLE public.agent_sessions IS 'Agent sessions with workflow state';
COMMENT ON TABLE public.episodic_memory IS 'Episodic event stream for agent sessions';
COMMENT ON TABLE public.agent_memory IS 'Vector-based semantic/procedural/working memory for agents';
COMMENT ON TABLE public.llm_usage IS 'LLM usage and cost tracking per tenant';
COMMENT ON TABLE public.agent_predictions IS 'Agent prediction quality tracking';
COMMENT ON TABLE public.business_objectives IS 'High-level business objectives in Value Fabric';
COMMENT ON TABLE public.value_trees IS 'Value trees linking capabilities, outcomes, KPIs, and financial metrics';
COMMENT ON TABLE public.value_commits IS 'Value commitments (targets) for value trees';
COMMENT ON TABLE public.kpi_targets IS 'Target KPIs committed as part of a value commit';
COMMENT ON TABLE public.realization_reports IS 'Realization reports summarizing outcomes vs targets';
COMMENT ON TABLE public.realization_results IS 'Per-KPI realization metrics for reports';
COMMENT ON TABLE public.expansion_models IS 'Expansion models for additional value realization';
COMMENT ON TABLE public.feature_flags IS 'Feature flags with optional per-tenant config';
COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for actions';
COMMENT ON TABLE public.security_audit_log IS 'Security-focused audit events';
COMMENT ON TABLE public.agent_audit_log IS 'Agent actions and orchestration events';

COMMIT;

-- Migration: Initial Schema
-- Run with: supabase db push (or your migration tool)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search
CREATE EXTENSION IF NOT EXISTS "vector"; -- For pgvector

-- ============================================
-- Tenancy & Core Tables
-- ============================================

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    tier VARCHAR(50) NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
    features JSONB DEFAULT '{}'::JSONB, -- Feature flags per tier
    limits JSONB DEFAULT '{
        "max_users": 5,
        "max_agents": 3,
        "api_calls_per_month": 10000
    }'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB, -- Custom metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete for GDPR
);

-- Users (scoped to organization)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(organization_id, email)
);

-- Defensive: ensure organization_id exists & FK on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'users' AND constraint_name = 'users_org_fk'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- API Keys (for service-to-service auth)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    scopes TEXT[] DEFAULT '{}'::TEXT[], -- ['read:models', 'write:agents', etc.]
    rate_limit INT DEFAULT 1000, -- Requests per minute
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Defensive: ensure organization_id exists & FK on api_keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'api_keys' AND constraint_name = 'api_keys_org_fk'
  ) THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Audit Log (multi-tenant aware)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'export', etc.
    resource_type VARCHAR(100) NOT NULL, -- 'model', 'agent', 'user', etc.
    resource_id UUID,
    changes JSONB, -- { before: {}, after: {} }
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Defensive: ensure organization_id exists & FK on audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'audit_logs' AND constraint_name = 'audit_logs_org_fk'
  ) THEN
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Cases (Agent interaction sessions)
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tags TEXT[], -- Array of tags for categorization
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Defensive: ensure organization_id exists & FK on cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'cases' AND constraint_name = 'cases_org_fk'
  ) THEN
    ALTER TABLE cases ADD CONSTRAINT cases_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Workflows (Agent orchestration DAGs)
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL, -- DAG definition with stages and transitions
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, name, version)
);

-- Defensive: ensure organization_id exists & FK on workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'workflows' AND constraint_name = 'workflows_org_fk'
  ) THEN
    ALTER TABLE workflows ADD CONSTRAINT workflows_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Workflow States (Execution state persistence)
CREATE TABLE IF NOT EXISTS workflow_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    current_stage VARCHAR(255) NOT NULL,
    state_data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,

    UNIQUE(workflow_id, case_id)
);

-- Defensive: ensure organization_id exists & FK on workflow_states
ALTER TABLE workflow_states ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'workflow_states' AND constraint_name = 'workflow_states_org_fk'
  ) THEN
    ALTER TABLE workflow_states ADD CONSTRAINT workflow_states_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Shared Artifacts (Cross-agent data sharing)
CREATE TABLE IF NOT EXISTS shared_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    artifact_type VARCHAR(100) NOT NULL, -- 'document', 'analysis', 'model_output', etc.
    name VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Defensive: ensure organization_id exists & FK on shared_artifacts
ALTER TABLE shared_artifacts ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'shared_artifacts' AND constraint_name = 'shared_artifacts_org_fk'
  ) THEN
    ALTER TABLE shared_artifacts ADD CONSTRAINT shared_artifacts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- ============================================
-- Agent Fabric & Orchestration Tables
-- ============================================

-- Agents (LangGraph/LangChain orchestrated)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    agent_type VARCHAR(50) NOT NULL, -- 'research', 'analysis', 'modeling', 'narrative', etc.
    config JSONB NOT NULL DEFAULT '{}', -- Agent-specific config (model, tools, memory)
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, name)
);

-- Defensive: ensure organization_id exists & FK on agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'agents' AND constraint_name = 'agents_org_fk'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Agent Runs (execution history)
CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input JSONB NOT NULL,
    output JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'cancelled')),
    error_message TEXT,
    duration_ms INT,
    tokens_used JSONB DEFAULT '{"input": 0, "output": 0}'::JSONB,
    cost NUMERIC(10, 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Defensive: ensure organization_id exists & FK on agent_runs
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'agent_runs' AND constraint_name = 'agent_runs_org_fk'
  ) THEN
    ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Agent Memory (semantic storage for RAG)
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- pgvector for semantic search
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Defensive: ensure organization_id exists & FK on agent_memory
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'agent_memory' AND constraint_name = 'agent_memory_org_fk'
  ) THEN
    ALTER TABLE agent_memory ADD CONSTRAINT agent_memory_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- ============================================
-- Business Logic Tables (Value Modeling)
-- ============================================

-- Value Models
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    model_data JSONB NOT NULL DEFAULT '{}', -- KPIs, assumptions, scenarios
    version INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(organization_id, name)
);

-- Defensive: ensure organization_id exists & FK on models
ALTER TABLE models ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'models' AND constraint_name = 'models_org_fk'
  ) THEN
    ALTER TABLE models ADD CONSTRAINT models_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- KPI Definitions
CREATE TABLE IF NOT EXISTS kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'revenue', 'cost', 'risk'
    formula TEXT,
    baseline NUMERIC(15, 2),
    target NUMERIC(15, 2),
    unit VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, model_id, name)
);

-- ============================================
-- Ensure tenant column and foreign keys exist (defensive idempotent checks)
-- ============================================

DO $$
DECLARE
    t text;
    fk_exists boolean;
    tables text[] := ARRAY['users','models','agents','agent_runs','agent_memory','api_keys','kpis','cases','workflows','workflow_states','shared_artifacts','audit_logs'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid', t);
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.table_name = t AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'organization_id')
        INTO fk_exists;
        IF NOT fk_exists THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE', t, t);
        END IF;
    END LOOP;
END;
$$;

-- Defensive: ensure organization_id exists & FK on kpis
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS organization_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'kpis' AND constraint_name = 'kpis_org_fk'
  ) THEN
    ALTER TABLE kpis ADD CONSTRAINT kpis_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- ============================================
-- Row-Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_artifacts ENABLE ROW LEVEL SECURITY;


-- Helper function to get current org_id from JWT (SQL form for stability)
CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'org_id'), '')::uuid
$$;

-- Helper function to get current user_id from JWT (SQL form for stability)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
$$;

-- Restrict function execution to authenticated users
REVOKE ALL ON FUNCTION public.get_current_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;

-- Organizations: read-only for members
CREATE POLICY org_select ON organizations
  FOR SELECT TO authenticated
  USING (id = (SELECT public.get_current_org_id()));

-- Users: allow read and update within same org
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY users_update ON users
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- Agents: allow read and write within org
CREATE POLICY agents_select ON agents
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY agents_write ON agents
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY agents_update ON agents
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- Models: allow read and write within org
CREATE POLICY models_select ON models
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY models_insert ON models
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY models_update ON models
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- Agent runs: allow read and write within org
CREATE POLICY runs_select ON agent_runs
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY runs_insert ON agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- Audit logs: read-only by default
CREATE POLICY audit_select ON audit_logs
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

-- Agent memory: allow read and write within org
CREATE POLICY memory_select ON agent_memory
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY memory_write ON agent_memory
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- KPIs: allow read and write within org
CREATE POLICY kpis_select ON kpis
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY kpis_write ON kpis
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- API keys: tightly restrict to org
CREATE POLICY api_keys_select ON api_keys
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

-- Cases: allow read and write within org
CREATE POLICY cases_select ON cases
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY cases_insert ON cases
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY cases_update ON cases
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- Workflows: allow read and write within org
CREATE POLICY workflows_select ON workflows
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY workflows_insert ON workflows
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY workflows_update ON workflows
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- Workflow States: allow read and write within org
CREATE POLICY workflow_states_select ON workflow_states
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY workflow_states_insert ON workflow_states
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY workflow_states_update ON workflow_states
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

-- Shared Artifacts: allow read and write within org
CREATE POLICY shared_artifacts_select ON shared_artifacts
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY shared_artifacts_insert ON shared_artifacts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));

CREATE POLICY shared_artifacts_update ON shared_artifacts
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT public.get_current_org_id()))
  WITH CHECK (organization_id = (SELECT public.get_current_org_id()));


-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX idx_users_org_email ON users(organization_id, email);
CREATE INDEX idx_agents_org_active ON agents(organization_id, is_active);
CREATE INDEX idx_agent_runs_status_time ON agent_runs(organization_id, status, created_at DESC);
CREATE INDEX idx_models_org_created ON models(organization_id, created_at DESC);

-- Moved from inline definitions:
CREATE INDEX idx_audit_org_time ON audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs (organization_id, resource_type, resource_id);

CREATE INDEX idx_agent_org_type ON agents (organization_id, agent_type);

CREATE INDEX idx_run_org_agent ON agent_runs (organization_id, agent_id, created_at DESC);
CREATE INDEX idx_run_user ON agent_runs (organization_id, user_id, created_at DESC);

CREATE INDEX idx_memory_org_agent ON agent_memory (organization_id, agent_id);
CREATE INDEX idx_memory_embedding ON agent_memory USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

CREATE INDEX idx_model_org_status ON models (organization_id, status, created_at DESC);

CREATE INDEX idx_kpi_model ON kpis (organization_id, model_id, category);

CREATE INDEX idx_cases_org_status ON cases (organization_id, status, created_at DESC);
CREATE INDEX idx_cases_user ON cases (organization_id, user_id, created_at DESC);

CREATE INDEX idx_workflows_org_active ON workflows (organization_id, is_active, created_at DESC);
CREATE INDEX idx_workflows_name_version ON workflows (organization_id, name, version);

CREATE INDEX idx_workflow_states_org_status ON workflow_states (organization_id, status, started_at DESC);
CREATE INDEX idx_workflow_states_workflow ON workflow_states (organization_id, workflow_id);
CREATE INDEX idx_workflow_states_case ON workflow_states (organization_id, case_id);

CREATE INDEX idx_shared_artifacts_org_type ON shared_artifacts (organization_id, artifact_type, created_at DESC);
CREATE INDEX idx_shared_artifacts_case ON shared_artifacts (organization_id, case_id);
CREATE INDEX idx_shared_artifacts_creator ON shared_artifacts (organization_id, created_by, created_at DESC);

-- Additional indexes for RLS performance
CREATE INDEX idx_orgs_id ON organizations(id);
CREATE INDEX idx_audit_org ON audit_logs(organization_id);

-- ============================================
-- Triggers for Audit & Maintenance
-- ============================================

-- Email validation and normalization
ALTER TABLE users
  ADD CONSTRAINT email_lowercase CHECK (email = lower(email)),
  ADD CONSTRAINT users_valid_email CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_agents_timestamp BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_models_timestamp BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Additional update_timestamp triggers only if updated_at column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cases' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cases_timestamp') THEN
    CREATE TRIGGER update_cases_timestamp BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflows' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflows_timestamp') THEN
    CREATE TRIGGER update_workflows_timestamp BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workflow_states' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflow_states_timestamp') THEN
    CREATE TRIGGER update_workflow_states_timestamp BEFORE UPDATE ON workflow_states FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shared_artifacts' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shared_artifacts_timestamp') THEN
    CREATE TRIGGER update_shared_artifacts_timestamp BEFORE UPDATE ON shared_artifacts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_runs' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_runs_timestamp') THEN
    CREATE TRIGGER update_agent_runs_timestamp BEFORE UPDATE ON agent_runs FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_memory' AND column_name = 'updated_at') AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_memory_timestamp') THEN
    CREATE TRIGGER update_agent_memory_timestamp BEFORE UPDATE ON agent_memory FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
END;
$$;

-- Audit trigger (logs all changes) - SECURITY DEFINER for RLS bypass
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    org_id UUID;
    user_id UUID;
    has_org BOOLEAN;
BEGIN
    -- Detect whether the table has organization_id column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = TG_TABLE_SCHEMA
          AND table_name = TG_TABLE_NAME
          AND column_name = 'organization_id') INTO has_org;

    IF has_org THEN
        IF TG_OP = 'DELETE' THEN
            org_id := OLD.organization_id;
        ELSE
            org_id := NEW.organization_id;
        END IF;
    ELSE
        org_id := (SELECT public.get_current_org_id());
    END IF;

    user_id := (SELECT public.get_current_user_id());

    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
        VALUES (org_id, user_id, 'delete', TG_TABLE_NAME, OLD.id, jsonb_build_object('before', row_to_json(OLD)));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
        VALUES (org_id, user_id, 'update', TG_TABLE_NAME, NEW.id, jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)));
    ELSE
        INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
        VALUES (org_id, user_id, 'create', TG_TABLE_NAME, NEW.id, jsonb_build_object('after', row_to_json(NEW)));
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Lock down execute permissions on audit trigger
REVOKE ALL ON FUNCTION audit_trigger() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_users') THEN
    CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_agents') THEN
    CREATE TRIGGER audit_agents AFTER INSERT OR UPDATE OR DELETE ON agents FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'models') AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_models') THEN
    CREATE TRIGGER audit_models AFTER INSERT OR UPDATE OR DELETE ON models FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cases') AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_cases') THEN
    CREATE TRIGGER audit_cases AFTER INSERT OR UPDATE OR DELETE ON cases FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflows') AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_workflows') THEN
    CREATE TRIGGER audit_workflows AFTER INSERT OR UPDATE OR DELETE ON workflows FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_states') AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_workflow_states') THEN
    CREATE TRIGGER audit_workflow_states AFTER INSERT OR UPDATE OR DELETE ON workflow_states FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_artifacts') AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'audit_shared_artifacts') THEN
    CREATE TRIGGER audit_shared_artifacts AFTER INSERT OR UPDATE OR DELETE ON shared_artifacts FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END;
$$;

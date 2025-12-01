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
CREATE TABLE organizations (
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
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete for GDPR
    
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9_-]+$')
);

-- Users (scoped to organization)
CREATE TABLE users (
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
    
    UNIQUE(organization_id, email),
    CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- API Keys (for service-to-service auth)
CREATE TABLE api_keys (
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

-- Audit Log (multi-tenant aware)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'export', etc.
    resource_type VARCHAR(100) NOT NULL, -- 'model', 'agent', 'user', etc.
    resource_id UUID,
    changes JSONB, -- { before: {}, after: {} }
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_audit_org_time (organization_id, created_at DESC),
    INDEX idx_audit_resource (organization_id, resource_type, resource_id)
);

-- ============================================
-- Agent Fabric & Orchestration Tables
-- ============================================

-- Agents (LangGraph/LangChain orchestrated)
CREATE TABLE agents (
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
    
    UNIQUE(organization_id, name),
    INDEX idx_agent_org_type (organization_id, agent_type)
);

-- Agent Runs (execution history)
CREATE TABLE agent_runs (
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
    completed_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_run_org_agent (organization_id, agent_id, created_at DESC),
    INDEX idx_run_user (organization_id, user_id, created_at DESC)
);

-- Agent Memory (semantic storage for RAG)
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- pgvector for semantic search
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_memory_org_agent (organization_id, agent_id),
    INDEX idx_memory_embedding ON agent_memory USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)
);

-- ============================================
-- Business Logic Tables (Value Modeling)
-- ============================================

-- Value Models
CREATE TABLE models (
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
    
    UNIQUE(organization_id, name),
    INDEX idx_model_org_status (organization_id, status, created_at DESC)
);

-- KPI Definitions
CREATE TABLE kpis (
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
    
    UNIQUE(organization_id, model_id, name),
    INDEX idx_kpi_model (organization_id, model_id, category)
);

-- =c==========================================
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


-- Helper function to get current org_id from JWT
CREATE OR REPLACE FUNCTION auth.get_current_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::UUID;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RLS Policies (Complete CRUD Protection)
-- ============================================

-- ORGANIZATIONS Table (Read-only)
CREATE POLICY org_select ON organizations
  FOR SELECT
  USING (id = auth.get_current_org_id());

-- USERS Table
CREATE POLICY users_select ON users
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY users_insert ON users
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY users_update ON users
  FOR UPDATE
  USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY users_delete ON users
  FOR DELETE
  USING (organization_id = auth.get_current_org_id());

-- AGENTS Table
CREATE POLICY agents_select ON agents
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY agents_insert ON agents
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY agents_update ON agents
  FOR UPDATE
  USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY agents_delete ON agents
  FOR DELETE
  USING (organization_id = auth.get_current_org_id());

-- MODELS Table
CREATE POLICY models_select ON models
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY models_insert ON models
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY models_update ON models
  FOR UPDATE
  USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY models_delete ON models
  FOR DELETE
  USING (organization_id = auth.get_current_org_id());

-- AGENT_RUNS Table
CREATE POLICY agent_runs_select ON agent_runs
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY agent_runs_insert ON agent_runs
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY agent_runs_update ON agent_runs
  FOR UPDATE
  USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY agent_runs_delete ON agent_runs
  FOR DELETE
  USING (organization_id = auth.get_current_org_id());

-- AUDIT_LOGS Table (Append-only for immutability)
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());
-- No UPDATE/DELETE for audit logs - they are append-only

-- AGENT_MEMORY Table
CREATE POLICY agent_memory_select ON agent_memory
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY agent_memory_insert ON agent_memory
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY agent_memory_update ON agent_memory
  FOR UPDATE
  USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY agent_memory_delete ON agent_memory
  FOR DELETE
  USING (organization_id = auth.get_current_org_id());

-- KPIS Table
CREATE POLICY kpis_select ON kpis
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY kpis_insert ON kpis
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY kpis_update ON kpis
  FOR UPDATE
  USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY kpis_delete ON kpis
  FOR DELETE
  USING (organization_id = auth.get_current_org_id());

-- API_KEYS Table
CREATE POLICY api_keys_select ON api_keys
  FOR SELECT
  USING (organization_id = auth.get_current_org_id());

CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY api_keys_update ON api_keys
  FOR UPDATE
  USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());

CREATE POLICY api_keys_delete ON api_keys
  FOR DELETE
  USING (organization_id = auth.get_current_org_id());


-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX idx_users_org_email ON users(organization_id, email);
CREATE INDEX idx_agents_org_active ON agents(organization_id, is_active);
CREATE INDEX idx_agent_runs_status_time ON agent_runs(organization_id, status, created_at DESC);
CREATE INDEX idx_models_org_created ON models(organization_id, created_at DESC);

-- ============================================
-- Triggers for Audit & Maintenance
-- ============================================

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

-- Helper function to get current user_id from JWT
CREATE OR REPLACE FUNCTION auth.get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::UUID;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;


-- Audit trigger (logs all changes)
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    user_id UUID;
BEGIN
    -- Extract organization_id and user_id from context
    org_id := auth.get_current_org_id();
    user_id := auth.get_current_user_id();

    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
        VALUES (OLD.organization_id, user_id, 'delete', TG_TABLE_NAME, OLD.id, 
                jsonb_build_object('before', row_to_json(OLD)));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
        VALUES (NEW.organization_id, user_id, 'update', TG_TABLE_NAME, NEW.id,
                jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW)));
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, changes)
        VALUES (NEW.organization_id, user_id, 'create', TG_TABLE_NAME, NEW.id,
                jsonb_build_object('after', row_to_json(NEW)));
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_agents AFTER INSERT OR UPDATE OR DELETE ON agents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_models AFTER INSERT OR UPDATE OR DELETE ON models
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

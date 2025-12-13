-- ============================================================================
-- Test Database Schema
-- ============================================================================
-- Minimal schema for running tests without full Supabase setup
-- This creates only the tables needed for tests to run
-- ============================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Core Tables for Tests
-- ============================================================================

-- Organizations/Tenants
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Tenant Mapping
CREATE TABLE IF NOT EXISTS user_tenants (
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Agent Sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Predictions
CREATE TABLE IF NOT EXISTS agent_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  session_id UUID,
  agent_id TEXT NOT NULL,
  prediction_data JSONB DEFAULT '{}'::jsonb,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canvas Data
CREATE TABLE IF NOT EXISTS canvas_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  canvas_id TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Value Trees
CREATE TABLE IF NOT EXISTS value_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tree_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Audit Log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID,
  tenant_id UUID,
  details JSONB,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health Check Table
CREATE TABLE IF NOT EXISTS health_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'healthy',
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a test health check record
INSERT INTO health_check (status) VALUES ('healthy') ON CONFLICT DO NOTHING;

-- ============================================================================
-- Enable RLS on All Tables
-- ============================================================================

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Basic RLS Policies for Tests
-- ============================================================================

-- Agent Sessions Policies
CREATE POLICY "test_tenant_isolation_select" ON agent_sessions
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'organization_id')::UUID
    OR auth.role() = 'service_role'
  );

CREATE POLICY "test_tenant_isolation_insert" ON agent_sessions
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'organization_id')::UUID
    OR auth.role() = 'service_role'
  );

-- Agent Predictions Policies
CREATE POLICY "test_tenant_isolation_select" ON agent_predictions
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'organization_id')::UUID
    OR auth.role() = 'service_role'
  );

CREATE POLICY "test_tenant_isolation_insert" ON agent_predictions
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'organization_id')::UUID
    OR auth.role() = 'service_role'
  );

-- Workflow Executions Policies
CREATE POLICY "test_tenant_isolation_select" ON workflow_executions
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'organization_id')::UUID
    OR auth.role() = 'service_role'
  );

-- Canvas Data Policies
CREATE POLICY "test_tenant_isolation_select" ON canvas_data
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'organization_id')::UUID
    OR auth.role() = 'service_role'
  );

-- Value Trees Policies
CREATE POLICY "test_tenant_isolation_select" ON value_trees
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'organization_id')::UUID
    OR auth.role() = 'service_role'
  );

-- Security Audit Log - Admin only
CREATE POLICY "admin_only_select" ON security_audit_log
  FOR SELECT
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Test Data
-- ============================================================================

-- Insert test organizations
INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001'::UUID, 'Test Org 1'),
  ('00000000-0000-0000-0000-000000000002'::UUID, 'Test Org 2')
ON CONFLICT (id) DO NOTHING;

-- Insert test user-tenant mappings
INSERT INTO user_tenants (user_id, tenant_id) VALUES
  ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID),
  ('00000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000002'::UUID)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- ============================================================================
-- Verification Function
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_test_schema()
RETURNS TABLE (
  table_name TEXT,
  exists BOOLEAN,
  rls_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::TEXT,
    true,
    t.rowsecurity
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'agent_sessions',
      'agent_predictions',
      'workflow_executions',
      'canvas_data',
      'value_trees',
      'security_audit_log'
    );
END;
$$ LANGUAGE plpgsql;

-- Run verification
SELECT * FROM verify_test_schema();

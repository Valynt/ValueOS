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
  user_id UUID NOT NULL,
  session_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Predictions
CREATE TABLE IF NOT EXISTS agent_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  input_data JSONB NOT NULL,
  prediction JSONB NOT NULL,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  hallucination_detected BOOLEAN DEFAULT FALSE,
  hallucination_reasons TEXT[],
  assumptions JSONB DEFAULT '[]'::jsonb,
  data_gaps JSONB DEFAULT '[]'::jsonb,
  evidence JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT,
  actual_outcome JSONB,
  actual_recorded_at TIMESTAMPTZ,
  variance_percentage DECIMAL(5,2),
  variance_absolute DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  workflow_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canvas Data
CREATE TABLE IF NOT EXISTS canvas_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  canvas_id TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Value Trees
CREATE TABLE IF NOT EXISTS value_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  tree_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Audit Log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID,
  organization_id UUID,
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
  table_exists BOOLEAN,
  rls_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    TRUE,
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

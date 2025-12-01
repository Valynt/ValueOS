-- Migration: Fix RLS Policies - Add INSERT/UPDATE/DELETE Protection
-- Priority: CRITICAL - Security Gap
-- Issue: Current policies only have USING (SELECT), missing WITH CHECK for writes

-- ============================================
-- DROP Incomplete Policies
-- ============================================

DROP POLICY IF EXISTS org_isolation_users ON users;
DROP POLICY IF EXISTS org_isolation_agents ON agents;
DROP POLICY IF EXISTS org_isolation_models ON models;
DROP POLICY IF EXISTS org_isolation_agent_runs ON agent_runs;
DROP POLICY IF EXISTS org_isolation_audit_logs ON audit_logs;
DROP POLICY IF EXISTS org_isolation_agent_memory ON agent_memory;
DROP POLICY IF EXISTS org_isolation_kpis ON kpis;
DROP POLICY IF EXISTS org_isolation_api_keys ON api_keys;

-- ============================================
-- CREATE Complete CRUD Policies
-- ============================================

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

-- AUDIT_LOGS Table (INSERT-only for immutability)
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
-- Verification Query
-- ============================================

-- Run this to verify all tables have complete policies:
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;

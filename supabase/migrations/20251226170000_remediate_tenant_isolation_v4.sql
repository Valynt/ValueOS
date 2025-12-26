-- ============================================================================
-- REMEDIATION: Fix Tenant Isolation for Calibration Tables
-- ============================================================================
-- Date: 2025-12-26
-- Priority: CRITICAL (Identified in Task 1.4 Audit)
-- ============================================================================

-- 1. ADD: tenant_id to agent_calibration_models
ALTER TABLE agent_calibration_models ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE agent_calibration_models SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL; -- Defaulting for existing data safety
ALTER TABLE agent_calibration_models ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_calibration_models_tenant ON agent_calibration_models(tenant_id);

-- 2. ADD: tenant_id to agent_calibration_history
ALTER TABLE agent_calibration_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE agent_calibration_history SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE agent_calibration_history ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_calibration_history_tenant ON agent_calibration_history(tenant_id);

-- 3. ADD: tenant_id to agent_retraining_queue
ALTER TABLE agent_retraining_queue ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE agent_retraining_queue SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;
ALTER TABLE agent_retraining_queue ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_retraining_queue_tenant ON agent_retraining_queue(tenant_id);

-- 4. ENABLE RLS
ALTER TABLE agent_calibration_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_calibration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_retraining_queue ENABLE ROW LEVEL SECURITY;

-- 5. APPLY Tenant Isolation Policies
DROP POLICY IF EXISTS "tenant_isolation_select" ON agent_calibration_models;
CREATE POLICY "tenant_isolation_select" ON agent_calibration_models
  FOR SELECT USING (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_isolation_select" ON agent_calibration_history;
CREATE POLICY "tenant_isolation_select" ON agent_calibration_history
  FOR SELECT USING (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_isolation_select" ON agent_retraining_queue;
CREATE POLICY "tenant_isolation_select" ON agent_retraining_queue
  FOR SELECT USING (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

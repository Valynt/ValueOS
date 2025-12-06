-- Migration: Add billing_audit_log table
-- Tracks all billing-related actions for compliance and debugging

CREATE TABLE IF NOT EXISTS billing_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'webhook')),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_org_time ON billing_audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_action ON billing_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_resource ON billing_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_actor ON billing_audit_log (actor_id);

-- Row-Level Security
ALTER TABLE billing_audit_log ENABLE ROW LEVEL SECURITY;

-- Read-only access for organization members
CREATE POLICY billing_audit_log_select ON billing_audit_log
  FOR SELECT USING (organization_id = auth.get_current_org_id());

-- Only system can insert (via service role)
CREATE POLICY billing_audit_log_insert ON billing_audit_log
  FOR INSERT WITH CHECK (true);

-- No updates or deletes (immutable audit log)
CREATE POLICY billing_audit_log_no_update ON billing_audit_log
  FOR UPDATE USING (false);

CREATE POLICY billing_audit_log_no_delete ON billing_audit_log
  FOR DELETE USING (false);

-- Function to log billing actions
CREATE OR REPLACE FUNCTION log_billing_action(
  p_organization_id UUID,
  p_action TEXT,
  p_actor_type TEXT,
  p_actor_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_before_state JSONB DEFAULT NULL,
  p_after_state JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO billing_audit_log (
    organization_id,
    action,
    actor_type,
    actor_id,
    resource_type,
    resource_id,
    before_state,
    after_state,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_organization_id,
    p_action,
    p_actor_type,
    p_actor_id,
    p_resource_type,
    p_resource_id,
    p_before_state,
    p_after_state,
    p_metadata,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

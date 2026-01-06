-- Tenant Isolation Enhancements
-- Purpose: Ensure strict tenant isolation via RLS
-- Compliance: SOC2 CC6.1, ISO 27001 A.9.4.1

-- Add tenant_id to cases table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='cases' AND column_name='tenant_id') THEN
    ALTER TABLE cases ADD COLUMN tenant_id UUID REFERENCES tenants(id);
    
    -- Backfill tenant_id from user_tenants
    UPDATE cases SET tenant_id = (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = cases.user_id
      LIMIT 1
    ) WHERE tenant_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_tenant_id ON cases(tenant_id);

-- Add tenant_id to messages table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='messages' AND column_name='tenant_id') THEN
    ALTER TABLE messages ADD COLUMN tenant_id UUID REFERENCES tenants(id);
    
    -- Backfill tenant_id from user_tenants
    UPDATE messages SET tenant_id = (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = messages.user_id
      LIMIT 1
    ) WHERE tenant_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);

-- Enable RLS on cases table
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's cases
DROP POLICY IF EXISTS tenant_isolation_cases ON cases;
CREATE POLICY tenant_isolation_cases ON cases
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all cases
DROP POLICY IF EXISTS service_role_cases ON cases;
CREATE POLICY service_role_cases ON cases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's messages
DROP POLICY IF EXISTS tenant_isolation_messages ON messages;
CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all messages
DROP POLICY IF EXISTS service_role_messages ON messages;
CREATE POLICY service_role_messages ON messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS on agent_sessions table
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's agent sessions
DROP POLICY IF EXISTS tenant_isolation_agent_sessions ON agent_sessions;
CREATE POLICY tenant_isolation_agent_sessions ON agent_sessions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all agent sessions
DROP POLICY IF EXISTS service_role_agent_sessions ON agent_sessions;
CREATE POLICY service_role_agent_sessions ON agent_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS on agent_predictions table
ALTER TABLE agent_predictions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's agent predictions
DROP POLICY IF EXISTS tenant_isolation_agent_predictions ON agent_predictions;
CREATE POLICY tenant_isolation_agent_predictions ON agent_predictions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_tenants.user_id = auth.uid()
      AND user_tenants.status = 'active'
    )
  );

-- Policy: Service role can access all agent predictions
DROP POLICY IF EXISTS service_role_agent_predictions ON agent_predictions;
CREATE POLICY service_role_agent_predictions ON agent_predictions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to validate tenant membership
CREATE OR REPLACE FUNCTION validate_tenant_membership(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_tenant_membership IS 'Validates if a user is an active member of a tenant';

-- Function to get user's tenant IDs
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT tenant_id FROM user_tenants
    WHERE user_id = p_user_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenant_ids IS 'Returns array of tenant IDs for a user';

-- Function to prevent tenant_id modification
CREATE OR REPLACE FUNCTION prevent_tenant_id_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id != OLD.tenant_id THEN
    RAISE EXCEPTION 'Cannot modify tenant_id. Original: %, New: %', OLD.tenant_id, NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply tenant_id immutability to cases
DROP TRIGGER IF EXISTS prevent_cases_tenant_modification ON cases;
CREATE TRIGGER prevent_cases_tenant_modification
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tenant_id_modification();

-- Apply tenant_id immutability to messages
DROP TRIGGER IF EXISTS prevent_messages_tenant_modification ON messages;
CREATE TRIGGER prevent_messages_tenant_modification
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tenant_id_modification();

-- Apply tenant_id immutability to agent_sessions
DROP TRIGGER IF EXISTS prevent_agent_sessions_tenant_modification ON agent_sessions;
CREATE TRIGGER prevent_agent_sessions_tenant_modification
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tenant_id_modification();

-- Apply tenant_id immutability to agent_predictions
DROP TRIGGER IF EXISTS prevent_agent_predictions_tenant_modification ON agent_predictions;
CREATE TRIGGER prevent_agent_predictions_tenant_modification
  BEFORE UPDATE ON agent_predictions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tenant_id_modification();

-- View to audit tenant isolation compliance
CREATE OR REPLACE VIEW tenant_isolation_audit AS
SELECT
  'cases' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) as missing_tenant_id,
  COUNT(DISTINCT tenant_id) as unique_tenants
FROM cases
UNION ALL
SELECT
  'messages' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) as missing_tenant_id,
  COUNT(DISTINCT tenant_id) as unique_tenants
FROM messages
UNION ALL
SELECT
  'agent_sessions' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) as missing_tenant_id,
  COUNT(DISTINCT tenant_id) as unique_tenants
FROM agent_sessions
UNION ALL
SELECT
  'agent_predictions' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) as missing_tenant_id,
  COUNT(DISTINCT tenant_id) as unique_tenants
FROM agent_predictions;

COMMENT ON VIEW tenant_isolation_audit IS 'Audits tenant isolation compliance across tables';

-- Function to log cross-tenant access attempts
CREATE OR REPLACE FUNCTION log_cross_tenant_access_attempt(
  p_user_id UUID,
  p_attempted_tenant_id UUID,
  p_actual_tenant_id UUID,
  p_action TEXT,
  p_resource TEXT
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO security_audit_events (
    user_id,
    tenant_id,
    action,
    resource,
    required_permissions,
    user_permissions,
    metadata
  ) VALUES (
    p_user_id::TEXT,
    p_actual_tenant_id,
    'ACCESS_DENIED',
    p_resource,
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    jsonb_build_object(
      'violation_type', 'cross_tenant_access',
      'attempted_tenant_id', p_attempted_tenant_id,
      'actual_tenant_id', p_actual_tenant_id,
      'action', p_action
    )
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_cross_tenant_access_attempt IS 'Logs cross-tenant access attempts for security monitoring';

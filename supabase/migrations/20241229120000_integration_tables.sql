-- Integration Connections and Sync History Tables
-- Supports all enterprise adapters (Salesforce, HubSpot, ServiceNow, Slack, SharePoint/Box)

-- Rate limit buckets for token bucket algorithm
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  tokens NUMERIC NOT NULL DEFAULT 0,
  last_refill TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_last_refill ON rate_limit_buckets(last_refill);

-- Integration connections
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Adapter details
  adapter_type VARCHAR(50) NOT NULL CHECK (adapter_type IN (
    'salesforce', 'hubspot', 'servicenow', 'slack', 'sharepoint', 'box'
  )),
  display_name VARCHAR(255) NOT NULL,
  
  -- Auth credentials (encrypted via Supabase Vault in production)
  credentials JSONB NOT NULL,
  
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Sync state
  last_sync_time TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'active' CHECK (sync_status IN (
    'active', 'paused', 'error', 'disabled'
  )),
  sync_error TEXT,
  
  -- Metrics
  total_syncs INT DEFAULT 0,
  successful_syncs INT DEFAULT 0,
  failed_syncs INT DEFAULT 0,
  last_health_check TIMESTAMPTZ,
  health_status JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(organization_id, adapter_type, display_name)
);

-- Indexes for integration_connections
CREATE INDEX IF NOT EXISTS idx_integration_org ON integration_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_type ON integration_connections(adapter_type);
CREATE INDEX IF NOT EXISTS idx_integration_status ON integration_connections(sync_status);
CREATE INDEX IF NOT EXISTS idx_integration_last_sync ON integration_connections(last_sync_time DESC);

-- Sync history for audit trail
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  
  -- Sync details
  sync_direction VARCHAR(20) NOT NULL CHECK (sync_direction IN (
    'pull', 'push', 'bidirectional'
  )),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- Metrics
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  conflicts_detected INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'running', 'completed', 'partial', 'failed'
  )),
  error_message TEXT,
  
  -- Detailed metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sync_history
CREATE INDEX IF NOT EXISTS idx_sync_connection ON sync_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_time ON sync_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_history(status);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_updated_at();

-- RLS Policies for integration_connections
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

-- Users can view connections in their organization
DROP POLICY IF EXISTS integration_connections_select ON integration_connections;
CREATE POLICY integration_connections_select ON integration_connections
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Only admins can insert connections
DROP POLICY IF EXISTS integration_connections_insert ON integration_connections;
CREATE POLICY integration_connections_insert ON integration_connections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = integration_connections.organization_id
        AND role IN ('admin', 'owner')
    )
  );

-- Only admins can update connections
DROP POLICY IF EXISTS integration_connections_update ON integration_connections;
CREATE POLICY integration_connections_update ON integration_connections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = integration_connections.organization_id
        AND role IN ('admin', 'owner')
    )
  );

-- Only admins can delete connections
DROP POLICY IF EXISTS integration_connections_delete ON integration_connections;
CREATE POLICY integration_connections_delete ON integration_connections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = integration_connections.organization_id
        AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for sync_history
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Users can view sync history for connections in their organization
DROP POLICY IF EXISTS sync_history_select ON sync_history;
CREATE POLICY sync_history_select ON sync_history
  FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM integration_connections
      WHERE organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid()
      )
    )
  );

-- System can insert sync history (no user-facing inserts)
DROP POLICY IF EXISTS sync_history_insert ON sync_history;
CREATE POLICY sync_history_insert ON sync_history
  FOR INSERT
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE integration_connections IS 'Stores configuration for enterprise integration adapters';
COMMENT ON TABLE sync_history IS 'Audit trail of all sync operations across integrations';
COMMENT ON TABLE rate_limit_buckets IS 'Token bucket state for API rate limiting';

COMMENT ON COLUMN integration_connections.credentials IS 'Encrypted OAuth tokens and API keys (use Supabase Vault for encryption)';
COMMENT ON COLUMN integration_connections.config IS 'Adapter-specific configuration including sync schedule and conflict resolution';
COMMENT ON COLUMN integration_connections.field_mappings IS 'Custom field mappings between ValueOS and external system';

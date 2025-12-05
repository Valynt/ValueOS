-- SEC-003: Secret Audit Logs Table
-- Created: 2024-11-29
-- Sprint 1: Critical Security Fixes

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create secret audit logs table
CREATE TABLE IF NOT EXISTS secret_audit_logs (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id VARCHAR(255) NOT NULL,
  
  -- User who performed the action
  user_id VARCHAR(255),
  
  -- Secret information (masked)
  secret_key VARCHAR(255) NOT NULL,
  secret_path TEXT,
  
  -- Action details
  action VARCHAR(50) NOT NULL CHECK (action IN ('READ', 'WRITE', 'DELETE', 'ROTATE')),
  result VARCHAR(50) NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE')),
  
  -- Error details (if failed)
  error_message TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_tenant_id ON secret_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_user_id ON secret_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_timestamp ON secret_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_action ON secret_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_result ON secret_audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_tenant_timestamp ON secret_audit_logs(tenant_id, timestamp DESC);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_secret_audit_logs_tenant_action_timestamp 
  ON secret_audit_logs(tenant_id, action, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE secret_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view audit logs for their own tenant
CREATE POLICY secret_audit_logs_tenant_isolation ON secret_audit_logs
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy: System role can view all audit logs (for admin/compliance)
CREATE POLICY secret_audit_logs_system_access ON secret_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    current_setting('app.current_user_role', true) = 'system'
    OR current_setting('app.current_user_role', true) = 'admin'
  );

-- Policy: Only system can insert audit logs (prevent tampering)
CREATE POLICY secret_audit_logs_system_insert ON secret_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'system'
  );

-- Policy: Audit logs are immutable (no updates or deletes except by system)
CREATE POLICY secret_audit_logs_no_update ON secret_audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY secret_audit_logs_system_delete ON secret_audit_logs
  FOR DELETE
  TO authenticated
  USING (
    current_setting('app.current_user_role', true) = 'system'
    AND timestamp < NOW() - INTERVAL '90 days'  -- Only allow deletion of old logs
  );

-- Create function to automatically delete old audit logs (90 day retention)
CREATE OR REPLACE FUNCTION delete_old_secret_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM secret_audit_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Deleted old secret audit logs';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job to run cleanup daily (requires pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('delete-old-secret-audit-logs', '0 2 * * *', 'SELECT delete_old_secret_audit_logs()');

-- Add comments for documentation
COMMENT ON TABLE secret_audit_logs IS 'Audit trail for all secret access operations. Immutable and tenant-isolated for compliance (SOC 2, GDPR).';
COMMENT ON COLUMN secret_audit_logs.tenant_id IS 'Tenant identifier for multi-tenant isolation';
COMMENT ON COLUMN secret_audit_logs.user_id IS 'User who performed the action (may be null for system operations)';
COMMENT ON COLUMN secret_audit_logs.secret_key IS 'Masked secret key identifier';
COMMENT ON COLUMN secret_audit_logs.action IS 'Type of operation: READ, WRITE, DELETE, or ROTATE';
COMMENT ON COLUMN secret_audit_logs.result IS 'Operation outcome: SUCCESS or FAILURE';
COMMENT ON COLUMN secret_audit_logs.metadata IS 'Additional context (latency, source, etc.)';
COMMENT ON COLUMN secret_audit_logs.timestamp IS 'When the operation occurred';

-- Grant appropriate permissions
GRANT SELECT ON secret_audit_logs TO authenticated;
GRANT INSERT ON secret_audit_logs TO authenticated;

-- Create view for common audit queries
CREATE OR REPLACE VIEW secret_audit_summary AS
SELECT 
  tenant_id,
  action,
  result,
  COUNT(*) as count,
  DATE_TRUNC('day', timestamp) as day
FROM secret_audit_logs
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, action, result, DATE_TRUNC('day', timestamp)
ORDER BY day DESC, tenant_id, action;

COMMENT ON VIEW secret_audit_summary IS 'Daily summary of secret access operations by tenant and action type';

-- Create view for security monitoring
CREATE OR REPLACE VIEW secret_audit_failures AS
SELECT 
  tenant_id,
  user_id,
  secret_key,
  action,
  error_message,
  timestamp
FROM secret_audit_logs
WHERE result = 'FAILURE'
AND timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

COMMENT ON VIEW secret_audit_failures IS 'Recent failed secret access attempts for security monitoring';

-- Sample query examples
COMMENT ON TABLE secret_audit_logs IS $comment$
Audit trail for all secret access operations.

Example queries:

-- Get audit logs for a specific tenant
SELECT * FROM secret_audit_logs 
WHERE tenant_id = 'tenant-123' 
ORDER BY timestamp DESC 
LIMIT 100;

-- Count operations by type for last 24 hours
SELECT action, result, COUNT(*) 
FROM secret_audit_logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY action, result;

-- Find suspicious activity (multiple failures)
SELECT tenant_id, user_id, COUNT(*) as failure_count
FROM secret_audit_logs
WHERE result = 'FAILURE'
AND timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY tenant_id, user_id
HAVING COUNT(*) >= 5;
$comment$;

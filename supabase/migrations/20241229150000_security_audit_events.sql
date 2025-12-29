/**
 * Database Migration: Security Audit Events Table
 * For SOC 2 compliance (CC6.8 - Audit Logging)
 */

-- Create security_audit_events table
CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ACCESS_DENIED', 'ACCESS_GRANTED')),
  resource TEXT NOT NULL,
  required_permissions TEXT[] NOT NULL DEFAULT '{}',
  user_permissions TEXT[] NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indices for query performance
CREATE INDEX idx_security_audit_timestamp ON security_audit_events(timestamp DESC);
CREATE INDEX idx_security_audit_user_id ON security_audit_events(user_id);
CREATE INDEX idx_security_audit_action ON security_audit_events(action);
CREATE INDEX idx_security_audit_resource ON security_audit_events(resource);

-- Enable Row Level Security (RLS)
ALTER TABLE security_audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can read audit logs
CREATE POLICY "Admins can view all audit events"
  ON security_audit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'roles' ? 'ADMIN'
    )
  );

-- RLS Policy: System can insert audit events (service role)
CREATE POLICY "Service role can insert audit events"
  ON security_audit_events
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Add comment for documentation
COMMENT ON TABLE security_audit_events IS 'SOC 2 Compliance: Immutable audit trail of security events (CC6.8)';

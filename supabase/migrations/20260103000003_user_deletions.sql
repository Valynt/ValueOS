-- User Deletions Audit Table
-- Purpose: Track deletion requests for audit and compliance
-- Compliance: GDPR Article 17, SOC2 CC6.7
-- Retention: 7 years

CREATE TABLE IF NOT EXISTS user_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN (
    'user_request',
    'admin_action',
    'gdpr_compliance',
    'account_closure',
    'inactivity'
  )),
  reason TEXT,
  data_exported BOOLEAN DEFAULT FALSE,
  export_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_deletions_user_id ON user_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deletions_user_email ON user_deletions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_deletions_tenant_id ON user_deletions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_deletions_requested_at ON user_deletions(requested_at);
CREATE INDEX IF NOT EXISTS idx_user_deletions_completed_at ON user_deletions(completed_at);
CREATE INDEX IF NOT EXISTS idx_user_deletions_deletion_type ON user_deletions(deletion_type);

COMMENT ON TABLE user_deletions IS 'Audit trail of user deletion requests (retained for 7 years)';
COMMENT ON COLUMN user_deletions.deletion_type IS 'Type of deletion: user_request, admin_action, gdpr_compliance, account_closure, inactivity';
COMMENT ON COLUMN user_deletions.data_exported IS 'Whether user data was exported before deletion';

-- Enable RLS
ALTER TABLE user_deletions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view deletion records
CREATE POLICY user_deletions_admin_read ON user_deletions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Service role can insert deletion records
CREATE POLICY user_deletions_service_insert ON user_deletions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can access all deletion records
CREATE POLICY user_deletions_service_role ON user_deletions
  FOR ALL
  TO service_role
  USING (true);

-- Trigger to log user deletion
CREATE OR REPLACE FUNCTION log_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_deletions (
    user_id,
    user_email,
    deletion_type,
    completed_at
  ) VALUES (
    OLD.id,
    OLD.email,
    'admin_action',
    NOW()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_user_deletion_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION log_user_deletion();

-- Retention policy enforcement (prevent deletion before 7 years)
CREATE OR REPLACE FUNCTION enforce_user_deletion_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete user deletion records before retention period expires (7 years)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_user_deletion_retention
  BEFORE DELETE ON user_deletions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_user_deletion_retention();

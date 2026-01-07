-- Legal Holds Table
-- Purpose: Prevent data deletion during litigation or regulatory investigations
-- Compliance: GDPR Article 17(3), SOC2 CC6.7

CREATE TABLE IF NOT EXISTS legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  reason TEXT NOT NULL,
  case_number TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'lifted')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_user_id ON legal_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_tenant_id ON legal_holds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_legal_holds_status ON legal_holds(status);
CREATE INDEX IF NOT EXISTS idx_legal_holds_created_at ON legal_holds(created_at);

COMMENT ON TABLE legal_holds IS 'Tracks legal holds to prevent data deletion during litigation';
COMMENT ON COLUMN legal_holds.reason IS 'Reason for legal hold (e.g., "Litigation", "Regulatory Investigation")';
COMMENT ON COLUMN legal_holds.case_number IS 'Optional case or matter number for reference';

-- Trigger to prevent user deletion when legal hold is active
CREATE OR REPLACE FUNCTION prevent_deletion_with_legal_hold()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM legal_holds
    WHERE user_id = OLD.id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot delete user: active legal hold exists (user_id: %)', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_legal_hold_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_deletion_with_legal_hold();

-- Enable RLS
ALTER TABLE legal_holds ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view legal holds
CREATE POLICY legal_holds_admin_read ON legal_holds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Only admins can create legal holds
CREATE POLICY legal_holds_admin_insert ON legal_holds
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Only admins can update legal holds (to lift them)
CREATE POLICY legal_holds_admin_update ON legal_holds
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Service role can access all legal holds
CREATE POLICY legal_holds_service_role ON legal_holds
  FOR ALL
  TO service_role
  USING (true);

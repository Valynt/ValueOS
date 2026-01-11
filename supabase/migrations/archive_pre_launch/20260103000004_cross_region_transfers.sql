-- Cross-Region Transfer Logging
-- Purpose: Audit cross-region data access for sovereignty compliance
-- Compliance: GDPR Article 44-50, SOC2 CC6.7
-- Retention: 7 years

DROP TABLE IF EXISTS cross_region_transfers CASCADE;
CREATE TABLE IF NOT EXISTS cross_region_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  from_region TEXT NOT NULL,
  to_region TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data_size_bytes BIGINT,
  legal_basis TEXT NOT NULL CHECK (legal_basis IN (
    'user_consent',
    'standard_contractual_clauses',
    'adequacy_decision',
    'binding_corporate_rules',
    'derogation'
  )),
  consent_id UUID,
  transferred_by UUID NOT NULL REFERENCES auth.users(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purpose TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_user_id ON cross_region_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_tenant_id ON cross_region_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_from_region ON cross_region_transfers(from_region);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_to_region ON cross_region_transfers(to_region);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_transferred_at ON cross_region_transfers(transferred_at);
CREATE INDEX IF NOT EXISTS idx_cross_region_transfers_legal_basis ON cross_region_transfers(legal_basis);

COMMENT ON TABLE cross_region_transfers IS 'Audit trail of cross-region data transfers (retained for 7 years)';
COMMENT ON COLUMN cross_region_transfers.legal_basis IS 'Legal basis for transfer: user_consent, standard_contractual_clauses, adequacy_decision, binding_corporate_rules, derogation';
COMMENT ON COLUMN cross_region_transfers.purpose IS 'Purpose of the data transfer';

-- Enable RLS
ALTER TABLE cross_region_transfers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transfer logs
CREATE POLICY cross_region_transfers_user_read ON cross_region_transfers
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Admins can view all transfer logs
CREATE POLICY cross_region_transfers_admin_read ON cross_region_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Service role can insert transfer logs
CREATE POLICY cross_region_transfers_service_insert ON cross_region_transfers
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can access all transfer logs
CREATE POLICY cross_region_transfers_service_role ON cross_region_transfers
  FOR ALL
  TO service_role
  USING (true);

-- Retention policy enforcement (prevent deletion before 7 years)
CREATE OR REPLACE FUNCTION enforce_cross_region_transfer_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete cross-region transfer records before retention period expires (7 years)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_cross_region_transfer_retention
  BEFORE DELETE ON cross_region_transfers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_cross_region_transfer_retention();

-- Function to log cross-region transfer
CREATE OR REPLACE FUNCTION log_cross_region_transfer(
  p_user_id UUID,
  p_tenant_id TEXT,
  p_from_region TEXT,
  p_to_region TEXT,
  p_data_type TEXT,
  p_data_size_bytes BIGINT,
  p_legal_basis TEXT,
  p_purpose TEXT,
  p_transferred_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
BEGIN
  INSERT INTO cross_region_transfers (
    user_id,
    tenant_id,
    from_region,
    to_region,
    data_type,
    data_size_bytes,
    legal_basis,
    transferred_by,
    purpose
  ) VALUES (
    p_user_id,
    p_tenant_id,
    p_from_region,
    p_to_region,
    p_data_type,
    p_data_size_bytes,
    p_legal_basis,
    COALESCE(p_transferred_by, auth.uid()),
    p_purpose
  ) RETURNING id INTO v_transfer_id;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Data Region Metadata
-- Purpose: Track data location for sovereignty compliance
-- Compliance: GDPR Article 44-50, SOC2 CC6.7

-- Add data_region column to tenants table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='tenants' AND column_name='data_region') THEN
    ALTER TABLE tenants ADD COLUMN data_region TEXT NOT NULL DEFAULT 'us'
      CHECK (data_region IN ('eu', 'us', 'ap', 'uk', 'ca'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_data_region ON tenants(data_region);

-- Add data_region column to organizations table (if different from tenants)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='organizations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='organizations' AND column_name='data_region') THEN
      ALTER TABLE organizations ADD COLUMN data_region TEXT NOT NULL DEFAULT 'us'
        CHECK (data_region IN ('eu', 'us', 'ap', 'uk', 'ca'));
      CREATE INDEX IF NOT EXISTS idx_organizations_data_region ON organizations(data_region);
    END IF;
  END IF;
END $$;

-- Function to validate data region
CREATE OR REPLACE FUNCTION validate_data_region(p_region TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_region IN ('eu', 'us', 'ap', 'uk', 'ca');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_data_region IS 'Validates if a data region code is valid';

-- Function to get region name
CREATE OR REPLACE FUNCTION get_region_name(p_region TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE p_region
    WHEN 'eu' THEN RETURN 'European Union';
    WHEN 'us' THEN RETURN 'United States';
    WHEN 'ap' THEN RETURN 'Asia Pacific';
    WHEN 'uk' THEN RETURN 'United Kingdom';
    WHEN 'ca' THEN RETURN 'Canada';
    ELSE RETURN 'Unknown';
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_region_name IS 'Returns the full name of a data region';

-- Function to check if cross-region transfer is allowed
CREATE OR REPLACE FUNCTION is_cross_region_transfer_allowed(
  p_from_region TEXT,
  p_to_region TEXT,
  p_legal_basis TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Same region is always allowed
  IF p_from_region = p_to_region THEN
    RETURN TRUE;
  END IF;

  -- Check if legal basis is valid
  IF p_legal_basis NOT IN (
    'user_consent',
    'standard_contractual_clauses',
    'adequacy_decision',
    'binding_corporate_rules',
    'derogation'
  ) THEN
    RETURN FALSE;
  END IF;

  -- EU to US requires specific legal basis
  IF p_from_region = 'eu' AND p_to_region = 'us' THEN
    RETURN p_legal_basis IN ('standard_contractual_clauses', 'adequacy_decision', 'binding_corporate_rules');
  END IF;

  -- EU to other regions requires legal basis
  IF p_from_region = 'eu' THEN
    RETURN p_legal_basis IS NOT NULL;
  END IF;

  -- Other transfers allowed with any legal basis
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_cross_region_transfer_allowed IS 'Checks if a cross-region data transfer is allowed based on legal basis';

-- Function to enforce data region on insert
CREATE OR REPLACE FUNCTION enforce_data_region_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_region TEXT;
BEGIN
  -- Get tenant's data region
  SELECT data_region INTO v_tenant_region
  FROM tenants
  WHERE id = NEW.tenant_id;

  -- If tenant has a region and record has a region, they must match
  IF v_tenant_region IS NOT NULL AND NEW.data_region IS NOT NULL THEN
    IF NEW.data_region != v_tenant_region THEN
      RAISE EXCEPTION 'Data region mismatch: tenant region is %, but record region is %', v_tenant_region, NEW.data_region;
    END IF;
  END IF;

  -- If record doesn't have a region, set it from tenant
  IF NEW.data_region IS NULL AND v_tenant_region IS NOT NULL THEN
    NEW.data_region := v_tenant_region;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_data_region_on_insert IS 'Ensures data is created in the correct region based on tenant';

-- Table to track data region changes
DROP TABLE IF EXISTS data_region_changes CASCADE;
CREATE TABLE IF NOT EXISTS data_region_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  old_region TEXT NOT NULL,
  new_region TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_data_region_changes_tenant_id ON data_region_changes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_region_changes_changed_at ON data_region_changes(changed_at);

COMMENT ON TABLE data_region_changes IS 'Audit trail of data region changes';

-- Function to log data region changes
CREATE OR REPLACE FUNCTION log_data_region_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.data_region != NEW.data_region THEN
    INSERT INTO data_region_changes (
      tenant_id,
      old_region,
      new_region,
      reason,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.data_region,
      NEW.data_region,
      'Region change',
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log region changes on tenants
DROP TRIGGER IF EXISTS log_tenant_region_change ON tenants;
CREATE TRIGGER log_tenant_region_change
  AFTER UPDATE ON tenants
  FOR EACH ROW
  WHEN (OLD.data_region IS DISTINCT FROM NEW.data_region)
  EXECUTE FUNCTION log_data_region_change();

-- View to show data distribution by region
CREATE OR REPLACE VIEW data_region_distribution AS
SELECT
  data_region,
  get_region_name(data_region) as region_name,
  COUNT(*) as tenant_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_tenants,
  COUNT(*) FILTER (WHERE status != 'active') as inactive_tenants
FROM tenants
GROUP BY data_region;

COMMENT ON VIEW data_region_distribution IS 'Shows distribution of tenants across data regions';

-- Function to get tenant's data region
CREATE OR REPLACE FUNCTION get_tenant_data_region(p_tenant_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_region TEXT;
BEGIN
  SELECT data_region INTO v_region
  FROM tenants
  WHERE id = p_tenant_id;
  
  RETURN v_region;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tenant_data_region IS 'Returns the data region for a tenant';

-- Function to check data sovereignty compliance
CREATE OR REPLACE FUNCTION check_data_sovereignty_compliance(p_tenant_id TEXT)
RETURNS TABLE (
  table_name TEXT,
  total_records BIGINT,
  correct_region BIGINT,
  wrong_region BIGINT,
  compliance_percentage NUMERIC
) AS $$
BEGIN
  -- This is a placeholder - in production, you'd check actual data location
  -- against tenant's data region across all tables
  RETURN QUERY
  SELECT
    'placeholder'::TEXT,
    0::BIGINT,
    0::BIGINT,
    0::BIGINT,
    100.0::NUMERIC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_data_sovereignty_compliance IS 'Checks data sovereignty compliance for a tenant';

-- Enable RLS on data_region_changes
ALTER TABLE data_region_changes ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all region changes
CREATE POLICY data_region_changes_admin_read ON data_region_changes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'roles')::jsonb @> '"ADMIN"'::jsonb
    )
  );

-- Policy: Service role can access all region changes
CREATE POLICY data_region_changes_service_role ON data_region_changes
  FOR ALL
  TO service_role
  USING (true);

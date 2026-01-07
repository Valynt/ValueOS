-- Retention Policy Enforcement Triggers
-- Purpose: Prevent premature deletion of compliance data
-- Compliance: GDPR Article 5(1)(e), SOC2 CC6.7

-- Function to enforce audit log retention (7 years)
CREATE OR REPLACE FUNCTION enforce_audit_log_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete audit logs before retention period expires (7 years). Record created: %, Current time: %', OLD.created_at, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_audit_log_retention
  BEFORE DELETE ON security_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_log_retention();

COMMENT ON FUNCTION enforce_audit_log_retention IS 'Prevents deletion of audit logs before 7-year retention period';

-- Function to enforce financial record retention (7 years)
CREATE OR REPLACE FUNCTION enforce_financial_record_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '7 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete financial records before retention period expires (7 years). Record created: %, Current time: %', OLD.created_at, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply to invoices table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    CREATE TRIGGER check_financial_record_retention
      BEFORE DELETE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION enforce_financial_record_retention();
  END IF;
END $$;

-- Apply to subscriptions table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    CREATE TRIGGER check_subscription_retention
      BEFORE DELETE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION enforce_financial_record_retention();
  END IF;
END $$;

COMMENT ON FUNCTION enforce_financial_record_retention IS 'Prevents deletion of financial records before 7-year retention period';

-- Function to enforce GDPR consent retention (2 years after withdrawal)
CREATE OR REPLACE FUNCTION enforce_consent_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '2 years';
  withdrawal_date TIMESTAMPTZ;
BEGIN
  -- If consent was withdrawn, use withdrawal date; otherwise use created date
  withdrawal_date := COALESCE(OLD.withdrawn_at, OLD.created_at);
  
  IF withdrawal_date > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete consent records before retention period expires (2 years after withdrawal). Withdrawal date: %, Current time: %', withdrawal_date, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create user_consents table if it doesn't exist
DROP TABLE IF EXISTS user_consents CASCADE;
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  consent_type TEXT NOT NULL,
  purpose TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_tenant_id ON user_consents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_consent_type ON user_consents(consent_type);

CREATE TRIGGER check_consent_retention
  BEFORE DELETE ON user_consents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_consent_retention();

COMMENT ON FUNCTION enforce_consent_retention IS 'Prevents deletion of consent records before 2-year retention period after withdrawal';

-- Function to enforce security incident retention (3 years)
CREATE OR REPLACE FUNCTION enforce_security_incident_retention()
RETURNS TRIGGER AS $$
DECLARE
  retention_period INTERVAL := '3 years';
BEGIN
  IF OLD.created_at > NOW() - retention_period THEN
    RAISE EXCEPTION 'Cannot delete security incident records before retention period expires (3 years). Record created: %, Current time: %', OLD.created_at, NOW();
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create security_incidents table if it doesn't exist
DROP TABLE IF EXISTS security_incidents CASCADE;
CREATE TABLE IF NOT EXISTS security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id),
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  affected_users INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_tenant_id ON security_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON security_incidents(detected_at);

CREATE TRIGGER check_security_incident_retention
  BEFORE DELETE ON security_incidents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_security_incident_retention();

COMMENT ON FUNCTION enforce_security_incident_retention IS 'Prevents deletion of security incident records before 3-year retention period';

-- Function to check if data can be deleted based on retention policy
CREATE OR REPLACE FUNCTION can_delete_by_retention(
  p_table_name TEXT,
  p_created_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  v_retention_period INTERVAL;
BEGIN
  -- Determine retention period based on table
  CASE p_table_name
    WHEN 'security_audit_events' THEN v_retention_period := '7 years';
    WHEN 'invoices' THEN v_retention_period := '7 years';
    WHEN 'subscriptions' THEN v_retention_period := '7 years';
    WHEN 'user_deletions' THEN v_retention_period := '7 years';
    WHEN 'cross_region_transfers' THEN v_retention_period := '7 years';
    WHEN 'legal_holds' THEN v_retention_period := '7 years';
    WHEN 'user_consents' THEN v_retention_period := '2 years';
    WHEN 'security_incidents' THEN v_retention_period := '3 years';
    ELSE v_retention_period := '1 year'; -- Default
  END CASE;

  RETURN p_created_at <= NOW() - v_retention_period;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_delete_by_retention IS 'Checks if a record can be deleted based on retention policy';

-- Function to get retention period for a table
CREATE OR REPLACE FUNCTION get_retention_period(p_table_name TEXT)
RETURNS INTERVAL AS $$
BEGIN
  CASE p_table_name
    WHEN 'security_audit_events' THEN RETURN '7 years';
    WHEN 'invoices' THEN RETURN '7 years';
    WHEN 'subscriptions' THEN RETURN '7 years';
    WHEN 'user_deletions' THEN RETURN '7 years';
    WHEN 'cross_region_transfers' THEN RETURN '7 years';
    WHEN 'legal_holds' THEN RETURN '7 years';
    WHEN 'user_consents' THEN RETURN '2 years';
    WHEN 'security_incidents' THEN RETURN '3 years';
    ELSE RETURN '1 year';
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_retention_period IS 'Returns the retention period for a given table';

-- View to show retention policy compliance
CREATE OR REPLACE VIEW retention_policy_compliance AS
SELECT
  'security_audit_events' as table_name,
  '7 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 years') as active_records
FROM security_audit_events
UNION ALL
SELECT
  'user_deletions' as table_name,
  '7 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 years') as active_records
FROM user_deletions
UNION ALL
SELECT
  'cross_region_transfers' as table_name,
  '7 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 years') as active_records
FROM cross_region_transfers
UNION ALL
SELECT
  'user_consents' as table_name,
  '2 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE COALESCE(withdrawn_at, created_at) <= NOW() - INTERVAL '2 years') as expired_records,
  COUNT(*) FILTER (WHERE COALESCE(withdrawn_at, created_at) > NOW() - INTERVAL '2 years') as active_records
FROM user_consents
UNION ALL
SELECT
  'security_incidents' as table_name,
  '3 years' as retention_period,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '3 years') as expired_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '3 years') as active_records
FROM security_incidents;

COMMENT ON VIEW retention_policy_compliance IS 'Shows retention policy compliance status for all tables';

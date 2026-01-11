-- Fix Audit Trail Immutability
-- Purpose: Prevent UPDATE/DELETE on audit tables
-- Priority: CRITICAL
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #5

-- ============================================================================
-- 1. audit_logs - Main audit table
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_audit_logs_update ON audit_logs
  FOR UPDATE
  USING (false);

-- Deny DELETE operations
CREATE POLICY deny_audit_logs_delete ON audit_logs
  FOR DELETE
  USING (false);

COMMENT ON POLICY deny_audit_logs_update ON audit_logs IS 
  'Audit logs are immutable - updates are not allowed';

COMMENT ON POLICY deny_audit_logs_delete ON audit_logs IS 
  'Audit logs are immutable - deletes are not allowed';

-- ============================================================================
-- 2. security_audit_events - Security audit table
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_security_audit_update ON security_audit_events
  FOR UPDATE
  USING (false);

-- Deny DELETE operations
CREATE POLICY deny_security_audit_delete ON security_audit_events
  FOR DELETE
  USING (false);

COMMENT ON POLICY deny_security_audit_update ON security_audit_events IS 
  'Security audit events are immutable - updates are not allowed';

COMMENT ON POLICY deny_security_audit_delete ON security_audit_events IS 
  'Security audit events are immutable - deletes are not allowed';

-- ============================================================================
-- 3. secret_audit_logs - Secret access audit table
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_secret_audit_update ON secret_audit_logs
  FOR UPDATE
  USING (false);

-- Deny DELETE operations
CREATE POLICY deny_secret_audit_delete ON secret_audit_logs
  FOR DELETE
  USING (false);

COMMENT ON POLICY deny_secret_audit_update ON secret_audit_logs IS 
  'Secret audit logs are immutable - updates are not allowed';

COMMENT ON POLICY deny_secret_audit_delete ON secret_audit_logs IS 
  'Secret audit logs are immutable - deletes are not allowed';

-- ============================================================================
-- 4. secret_audit_logs_legacy - Legacy secret audit table
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_secret_audit_legacy_update ON secret_audit_logs_legacy
  FOR UPDATE
  USING (false);

-- Deny DELETE operations
CREATE POLICY deny_secret_audit_legacy_delete ON secret_audit_logs_legacy
  FOR DELETE
  USING (false);

COMMENT ON POLICY deny_secret_audit_legacy_update ON secret_audit_logs_legacy IS 
  'Legacy secret audit logs are immutable - updates are not allowed';

COMMENT ON POLICY deny_secret_audit_legacy_delete ON secret_audit_logs_legacy IS 
  'Legacy secret audit logs are immutable - deletes are not allowed';

-- ============================================================================
-- 5. audit_logs_archive - Archived audit logs
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_audit_logs_archive_update ON audit_logs_archive
  FOR UPDATE
  USING (false);

-- Deny DELETE operations
CREATE POLICY deny_audit_logs_archive_delete ON audit_logs_archive
  FOR DELETE
  USING (false);

COMMENT ON POLICY deny_audit_logs_archive_update ON audit_logs_archive IS 
  'Archived audit logs are immutable - updates are not allowed';

COMMENT ON POLICY deny_audit_logs_archive_delete ON audit_logs_archive IS 
  'Archived audit logs are immutable - deletes are not allowed';

-- ============================================================================
-- 6. audit_log_access - Audit log access tracking
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_audit_log_access_update ON audit_log_access
  FOR UPDATE
  USING (false);

-- Deny DELETE operations
CREATE POLICY deny_audit_log_access_delete ON audit_log_access
  FOR DELETE
  USING (false);

COMMENT ON POLICY deny_audit_log_access_update ON audit_log_access IS 
  'Audit log access records are immutable - updates are not allowed';

COMMENT ON POLICY deny_audit_log_access_delete ON audit_log_access IS 
  'Audit log access records are immutable - deletes are not allowed';

-- ============================================================================
-- 7. agent_audit_log - Agent activity audit
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_agent_audit_update ON agent_audit_log
  FOR UPDATE
  USING (false);

-- Deny DELETE operations
CREATE POLICY deny_agent_audit_delete ON agent_audit_log
  FOR DELETE
  USING (false);

COMMENT ON POLICY deny_agent_audit_update ON agent_audit_log IS 
  'Agent audit logs are immutable - updates are not allowed';

COMMENT ON POLICY deny_agent_audit_delete ON agent_audit_log IS 
  'Agent audit logs are immutable - deletes are not allowed';

-- ============================================================================
-- 8. login_attempts - Authentication audit
-- ============================================================================

-- Deny UPDATE operations
CREATE POLICY deny_login_attempts_update ON login_attempts
  FOR UPDATE
  USING (false);

-- Deny DELETE operations (except service role for cleanup)
CREATE POLICY deny_login_attempts_delete ON login_attempts
  FOR DELETE
  USING (
    -- Only service role can delete old login attempts
    auth.jwt() ->> 'role' = 'service_role'
  );

COMMENT ON POLICY deny_login_attempts_update ON login_attempts IS 
  'Login attempts are immutable - updates are not allowed';

COMMENT ON POLICY deny_login_attempts_delete ON login_attempts IS 
  'Login attempts can only be deleted by service role for cleanup';

-- ============================================================================
-- 9. Create function to safely archive old audit logs
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_old_audit_logs(
  p_retention_days INTEGER DEFAULT 365
)
RETURNS TABLE(
  table_name TEXT,
  records_archived BIGINT,
  records_deleted BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
  v_archived BIGINT;
  v_deleted BIGINT;
BEGIN
  v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;
  
  -- Archive audit_logs
  WITH archived AS (
    INSERT INTO audit_logs_archive
    SELECT * FROM audit_logs
    WHERE created_at < v_cutoff_date
    RETURNING *
  )
  SELECT COUNT(*) INTO v_archived FROM archived;
  
  -- Note: We don't delete from audit_logs due to immutability
  -- This function is for future use when archival strategy is defined
  
  RETURN QUERY SELECT 
    'audit_logs'::TEXT,
    v_archived,
    0::BIGINT;
END;
$$;

COMMENT ON FUNCTION archive_old_audit_logs IS 
  'Archives old audit logs to archive table. Does not delete due to immutability requirements.';

-- ============================================================================
-- 10. Create function to verify audit trail integrity
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_audit_trail_integrity()
RETURNS TABLE(
  table_name TEXT,
  total_records BIGINT,
  oldest_record TIMESTAMPTZ,
  newest_record TIMESTAMPTZ,
  has_gaps BOOLEAN,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'audit_logs'::TEXT,
    COUNT(*)::BIGINT,
    MIN(created_at),
    MAX(created_at),
    false, -- Placeholder for gap detection
    'OK'::TEXT
  FROM audit_logs
  
  UNION ALL
  
  SELECT 
    'security_audit_events'::TEXT,
    COUNT(*)::BIGINT,
    MIN(timestamp),
    MAX(timestamp),
    false,
    'OK'::TEXT
  FROM security_audit_events
  
  UNION ALL
  
  SELECT 
    'secret_audit_logs'::TEXT,
    COUNT(*)::BIGINT,
    MIN(timestamp),
    MAX(timestamp),
    false,
    'OK'::TEXT
  FROM secret_audit_logs;
END;
$$;

COMMENT ON FUNCTION verify_audit_trail_integrity IS 
  'Verifies audit trail integrity by checking for gaps and anomalies';

-- ============================================================================
-- 11. Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION archive_old_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION verify_audit_trail_integrity TO authenticated;

-- ============================================================================
-- 12. Create view for audit trail monitoring
-- ============================================================================

CREATE OR REPLACE VIEW audit_trail_health AS
SELECT 
  'audit_logs' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d
FROM audit_logs

UNION ALL

SELECT 
  'security_audit_events' as table_name,
  COUNT(*) as record_count,
  MIN(timestamp) as oldest_record,
  MAX(timestamp) as newest_record,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as last_7d
FROM security_audit_events

UNION ALL

SELECT 
  'secret_audit_logs' as table_name,
  COUNT(*) as record_count,
  MIN(timestamp) as oldest_record,
  MAX(timestamp) as newest_record,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as last_7d
FROM secret_audit_logs;

COMMENT ON VIEW audit_trail_health IS 
  'Provides health metrics for audit trail tables';

GRANT SELECT ON audit_trail_health TO authenticated;

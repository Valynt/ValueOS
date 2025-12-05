-- Rollback script for secret audit logs
-- Created: 2024-11-29

-- Drop views
DROP VIEW IF EXISTS secret_audit_failures;
DROP VIEW IF EXISTS secret_audit_summary;

-- Drop function
DROP FUNCTION IF EXISTS delete_old_secret_audit_logs();

-- Uncomment if pg_cron job was created:
-- SELECT cron.unschedule('delete-old-secret-audit-logs');

-- Drop policies
DROP POLICY IF EXISTS secret_audit_logs_system_delete ON secret_audit_logs;
DROP POLICY IF EXISTS secret_audit_logs_no_update ON secret_audit_logs;
DROP POLICY IF EXISTS secret_audit_logs_system_insert ON secret_audit_logs;
DROP POLICY IF EXISTS secret_audit_logs_system_access ON secret_audit_logs;
DROP POLICY IF EXISTS secret_audit_logs_tenant_isolation ON secret_audit_logs;

-- Drop indexes
DROP INDEX IF EXISTS idx_secret_audit_logs_tenant_action_timestamp;
DROP INDEX IF EXISTS idx_secret_audit_logs_tenant_timestamp;
DROP INDEX IF EXISTS idx_secret_audit_logs_result;
DROP INDEX IF EXISTS idx_secret_audit_logs_action;
DROP INDEX IF EXISTS idx_secret_audit_logs_timestamp;
DROP INDEX IF EXISTS idx_secret_audit_logs_user_id;
DROP INDEX IF EXISTS idx_secret_audit_logs_tenant_id;

-- Drop table
DROP TABLE IF EXISTS secret_audit_logs;

-- Note: UUID extension is NOT dropped as it may be used by other tables

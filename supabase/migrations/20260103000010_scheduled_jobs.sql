-- Scheduled Deletion Jobs
-- Purpose: Automated cleanup of expired data
-- Compliance: GDPR Article 5(1)(e), SOC2 CC6.7
-- Requires: pg_cron extension

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Create temp_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS temp_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id TEXT REFERENCES tenants(id),
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_files_user_id ON temp_files(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_files_created_at ON temp_files(created_at);

-- Function 1: Delete expired sessions
CREATE OR REPLACE FUNCTION delete_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  retention_period INTERVAL := '30 days';
BEGIN
  DELETE FROM sessions
  WHERE expires_at < NOW() - retention_period
  RETURNING COUNT(*) INTO deleted_count;

  -- Log the cleanup
  RAISE NOTICE 'Deleted % expired sessions', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_expired_sessions IS 'Deletes sessions expired more than 30 days ago (runs daily at 2 AM)';

-- Function 2: Delete expired temporary files
CREATE OR REPLACE FUNCTION delete_expired_temp_files()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  retention_period INTERVAL := '7 days';
BEGIN
  DELETE FROM temp_files
  WHERE created_at < NOW() - retention_period
  RETURNING COUNT(*) INTO deleted_count;

  -- Log the cleanup
  RAISE NOTICE 'Deleted % expired temporary files', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_expired_temp_files IS 'Deletes temporary files older than 7 days (runs daily at 3 AM)';

-- Function 3: Permanently delete soft-deleted users
CREATE OR REPLACE FUNCTION permanently_delete_soft_deleted_users()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  grace_period INTERVAL := '30 days';
  v_user_id UUID;
BEGIN
  deleted_count := 0;

  -- Find soft-deleted users past grace period
  FOR v_user_id IN
    SELECT id FROM auth.users
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - grace_period
  LOOP
    -- Delete the user (triggers will handle cleanup)
    DELETE FROM auth.users WHERE id = v_user_id;
    deleted_count := deleted_count + 1;
  END LOOP;

  -- Log the cleanup
  RAISE NOTICE 'Permanently deleted % soft-deleted users', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION permanently_delete_soft_deleted_users IS 'Permanently deletes users soft-deleted more than 30 days ago (runs weekly on Sunday at 4 AM)';

-- Function 4: Aggregate usage events (for billing)
CREATE OR REPLACE FUNCTION aggregate_usage_events_job()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER;
BEGIN
  -- Call the existing aggregate function
  SELECT aggregate_usage_events() INTO processed_count;

  -- Log the aggregation
  RAISE NOTICE 'Aggregated % usage events', processed_count;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_usage_events_job IS 'Aggregates usage events into quotas (runs hourly)';

-- Function 5: Reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas_job()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Call the existing reset function
  SELECT reset_monthly_quotas() INTO reset_count;

  -- Log the reset
  RAISE NOTICE 'Reset % monthly quotas', reset_count;

  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_monthly_quotas_job IS 'Resets monthly usage quotas (runs daily at 1 AM)';

-- Function 6: Clean up old audit logs (after retention period)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  retention_period INTERVAL := '7 years';
BEGIN
  -- Only delete logs older than retention period
  DELETE FROM security_audit_events
  WHERE created_at < NOW() - retention_period
  RETURNING COUNT(*) INTO deleted_count;

  -- Log the cleanup
  RAISE NOTICE 'Cleaned up % old audit logs', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Deletes audit logs older than 7 years (runs monthly on 1st at 5 AM)';

-- Schedule Job 1: Delete expired sessions (daily at 2 AM)
SELECT cron.schedule(
  'delete-expired-sessions',
  '0 2 * * *',
  'SELECT delete_expired_sessions();'
);

-- Schedule Job 2: Delete expired temp files (daily at 3 AM)
SELECT cron.schedule(
  'delete-expired-temp-files',
  '0 3 * * *',
  'SELECT delete_expired_temp_files();'
);

-- Schedule Job 3: Permanently delete soft-deleted users (weekly on Sunday at 4 AM)
SELECT cron.schedule(
  'permanently-delete-soft-deleted-users',
  '0 4 * * 0',
  'SELECT permanently_delete_soft_deleted_users();'
);

-- Schedule Job 4: Aggregate usage events (hourly)
SELECT cron.schedule(
  'aggregate-usage-events',
  '0 * * * *',
  'SELECT aggregate_usage_events_job();'
);

-- Schedule Job 5: Reset monthly quotas (daily at 1 AM)
SELECT cron.schedule(
  'reset-monthly-quotas',
  '0 1 * * *',
  'SELECT reset_monthly_quotas_job();'
);

-- Schedule Job 6: Clean up old audit logs (monthly on 1st at 5 AM)
SELECT cron.schedule(
  'cleanup-old-audit-logs',
  '0 5 1 * *',
  'SELECT cleanup_old_audit_logs();'
);

-- View to monitor scheduled jobs
CREATE OR REPLACE VIEW scheduled_jobs_status AS
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobname;

COMMENT ON VIEW scheduled_jobs_status IS 'Shows status of all scheduled cron jobs';

-- Function to manually trigger a scheduled job (for testing)
CREATE OR REPLACE FUNCTION trigger_scheduled_job(p_job_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
BEGIN
  CASE p_job_name
    WHEN 'delete-expired-sessions' THEN
      PERFORM delete_expired_sessions();
      v_result := 'Triggered: delete_expired_sessions';
    WHEN 'delete-expired-temp-files' THEN
      PERFORM delete_expired_temp_files();
      v_result := 'Triggered: delete_expired_temp_files';
    WHEN 'permanently-delete-soft-deleted-users' THEN
      PERFORM permanently_delete_soft_deleted_users();
      v_result := 'Triggered: permanently_delete_soft_deleted_users';
    WHEN 'aggregate-usage-events' THEN
      PERFORM aggregate_usage_events_job();
      v_result := 'Triggered: aggregate_usage_events_job';
    WHEN 'reset-monthly-quotas' THEN
      PERFORM reset_monthly_quotas_job();
      v_result := 'Triggered: reset_monthly_quotas_job';
    WHEN 'cleanup-old-audit-logs' THEN
      PERFORM cleanup_old_audit_logs();
      v_result := 'Triggered: cleanup_old_audit_logs';
    ELSE
      v_result := 'Unknown job: ' || p_job_name;
  END CASE;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_scheduled_job IS 'Manually triggers a scheduled job for testing';

-- Table to track job execution history
CREATE TABLE IF NOT EXISTS job_execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  records_processed INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_job_execution_history_job_name ON job_execution_history(job_name);
CREATE INDEX IF NOT EXISTS idx_job_execution_history_started_at ON job_execution_history(started_at);
CREATE INDEX IF NOT EXISTS idx_job_execution_history_status ON job_execution_history(status);

COMMENT ON TABLE job_execution_history IS 'Tracks execution history of scheduled jobs';

-- Function to log job execution
CREATE OR REPLACE FUNCTION log_job_execution(
  p_job_name TEXT,
  p_status TEXT,
  p_records_processed INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO job_execution_history (
    job_name,
    status,
    records_processed,
    error_message,
    completed_at
  ) VALUES (
    p_job_name,
    p_status,
    p_records_processed,
    p_error_message,
    CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_job_execution IS 'Logs execution of a scheduled job';

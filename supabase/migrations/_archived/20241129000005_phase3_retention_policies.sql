-- Phase 3: Data Retention Policies & TTL Jobs
-- Created: 2024-11-29
-- Implements automated data retention and cleanup

-- ============================================================================
-- Retention Policies Configuration Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Table configuration
  table_name TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  date_column TEXT NOT NULL DEFAULT 'created_at',
  
  -- Archive configuration
  archive_before_delete BOOLEAN DEFAULT true,
  archive_table TEXT,
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_archived INTEGER,
  last_run_deleted INTEGER,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_enabled ON public.retention_policies(enabled);

COMMENT ON TABLE public.retention_policies IS 
'Phase 3: Defines data retention policies for automatic cleanup';

-- ============================================================================
-- Insert Default Retention Policies
-- ============================================================================

INSERT INTO public.retention_policies (table_name, retention_days, archive_before_delete, archive_table) VALUES
  ('login_attempts', 90, false, null),  -- 90 days (Phase 1)
  ('approval_requests', 365, true, 'approval_requests_archive'),  -- 1 year (Phase 2)
  ('approvals', 730, true, 'approvals_archive'),  -- 2 years
  ('audit_logs', 2555, true, 'audit_logs_archive')  -- 7 years (compliance)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- Archive Tables
-- ============================================================================

-- Approval requests archive
CREATE TABLE IF NOT EXISTS public.approval_requests_archive (
  LIKE public.approval_requests INCLUDING ALL
);
ALTER TABLE public.approval_requests_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();

-- Approvals archive
CREATE TABLE IF NOT EXISTS public.approvals_archive (
  LIKE public.approvals INCLUDING ALL
);
ALTER TABLE public.approvals_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON TABLE public.approval_requests_archive IS 'Archive for approval requests older than retention period';
COMMENT ON TABLE public.approvals_archive IS 'Archive for approvals older than retention period';

-- ============================================================================
-- TTL Cleanup Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS TABLE(
  table_name TEXT,
  archived_count BIGINT,
  deleted_count BIGINT,
  status TEXT
) AS $$
DECLARE
  policy RECORD;
  archived BIGINT;
  deleted BIGINT;
  cutoff_date TIMESTAMPTZ;
  error_msg TEXT;
BEGIN
  FOR policy IN 
    SELECT * FROM public.retention_policies WHERE enabled = true
  LOOP
    cutoff_date := NOW() - (policy.retention_days || ' days')::INTERVAL;
    archived := 0;
    deleted := 0;
    error_msg := NULL;
    
    BEGIN
      -- Archive if configured
      IF policy.archive_before_delete AND policy.archive_table IS NOT NULL THEN
        EXECUTE format(
          'INSERT INTO %I SELECT *, NOW() as archived_at FROM %I WHERE %I < $1',
          policy.archive_table,
          policy.table_name,
          policy.date_column
        ) USING cutoff_date;
        
        GET DIAGNOSTICS archived = ROW_COUNT;
      END IF;
      
      -- Delete expired records
      EXECUTE format(
        'DELETE FROM %I WHERE %I < $1',
        policy.table_name,
        policy.date_column
      ) USING cutoff_date;
      
      GET DIAGNOSTICS deleted = ROW_COUNT;
      
      -- Update policy status
      UPDATE public.retention_policies 
      SET 
        last_run_at = NOW(),
        last_run_status = 'success',
        last_run_archived = archived,
        last_run_deleted = deleted,
        updated_at = NOW()
      WHERE id = policy.id;
      
      -- Return results
      table_name := policy.table_name;
      archived_count := archived;
      deleted_count := deleted;
      status := 'success';
      RETURN NEXT;
      
    EXCEPTION WHEN OTHERS THEN
      error_msg := SQLERRM;
      
      -- Update policy with error
      UPDATE public.retention_policies 
      SET 
        last_run_at = NOW(),
        last_run_status = 'error: ' || error_msg,
        updated_at = NOW()
      WHERE id = policy.id;
      
      -- Return error
      table_name := policy.table_name;
      archived_count := 0;
      deleted_count := 0;
      status := 'error: ' || error_msg;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_expired_data IS 
'Phase 3: Executes retention policies - archives and deletes expired data';

-- ============================================================================
-- Manual cleanup function for specific table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_table_data(
  p_table_name TEXT,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  action TEXT,
  row_count BIGINT,
  cutoff_date TIMESTAMPTZ
) AS $$
DECLARE
  policy RECORD;
  archived BIGINT;
  deleted BIGINT;
  cutoff TIMESTAMPTZ;
BEGIN
  -- Get policy
  SELECT * INTO policy
  FROM public.retention_policies
  WHERE table_name = p_table_name AND enabled = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No enabled retention policy found for table: %', p_table_name;
  END IF;
  
  cutoff := NOW() - (policy.retention_days || ' days')::INTERVAL;
  
  -- Count records to be processed
  IF p_dry_run THEN
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE %I < $1',
      policy.table_name,
      policy.date_column
    ) USING cutoff INTO deleted;
    
    action := 'dry_run_would_delete';
    row_count := deleted;
    cutoff_date := cutoff;
    RETURN NEXT;
    
    IF policy.archive_before_delete AND policy.archive_table IS NOT NULL THEN
      action := 'dry_run_would_archive';
      row_count := deleted;
      cutoff_date := cutoff;
      RETURN NEXT;
    END IF;
  ELSE
    -- Archive if configured
    IF policy.archive_before_delete AND policy.archive_table IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO %I SELECT *, NOW() as archived_at FROM %I WHERE %I < $1',
        policy.archive_table,
        policy.table_name,
        policy.date_column
      ) USING cutoff;
      
      GET DIAGNOSTICS archived = ROW_COUNT;
      
      action := 'archived';
      row_count := archived;
      cutoff_date := cutoff;
      RETURN NEXT;
    END IF;
    
    -- Delete expired records
    EXECUTE format(
      'DELETE FROM %I WHERE %I < $1',
      policy.table_name,
      policy.date_column
    ) USING cutoff;
    
    GET DIAGNOSTICS deleted = ROW_COUNT;
    
    action := 'deleted';
    row_count := deleted;
    cutoff_date := cutoff;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_table_data IS 
'Phase 3: Manual cleanup for specific table with dry-run support';

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 3 Retention Policies Installed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - retention_policies';
  RAISE NOTICE '  - approval_requests_archive';
  RAISE NOTICE '  - approvals_archive';
  RAISE NOTICE '';
  RAISE NOTICE 'Default policies:';
  RAISE NOTICE '  - login_attempts: 90 days';
  RAISE NOTICE '  - approval_requests: 365 days (archived)';
  RAISE NOTICE '  - approvals: 730 days (archived)';
  RAISE NOTICE '  - audit_logs: 2555 days (archived)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - cleanup_expired_data()';
  RAISE NOTICE '  - cleanup_table_data(table_name, dry_run)';
  RAISE NOTICE '';
  RAISE NOTICE 'Schedule with cron:';
  RAISE NOTICE '  SELECT cron.schedule(''daily-cleanup'', ''0 2 * * *'', ''SELECT * FROM cleanup_expired_data()'');';
  RAISE NOTICE '';
END $$;

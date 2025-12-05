-- Phase 3: Audit Log Immutability (WORM - Write Once Read Many)
-- Created: 2024-11-29
-- Implements append-only audit logs with immutability guarantees

-- ============================================================================
-- Audit Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event details
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  
  -- Timestamp (immutable)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

COMMENT ON TABLE public.audit_logs IS 
'Phase 3: Immutable audit trail - append-only, no updates or deletes allowed';

-- ============================================================================
-- Prevent Modifications (Immutability)
-- ============================================================================

-- Revoke UPDATE and DELETE permissions
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;
REVOKE UPDATE, DELETE ON public.audit_logs FROM public;

-- Trigger to prevent updates
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable - updates not allowed';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

-- Trigger to prevent deletes
CREATE OR REPLACE FUNCTION public.prevent_audit_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable - deletion not allowed';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_deletion();

-- ============================================================================
-- Secure Append Function (Only Way to Add Audit Logs)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.append_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
  client_ip TEXT;
  client_ua TEXT;
BEGIN
  -- Get client info from current request context (if available)
  BEGIN
    client_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    client_ua := current_setting('request.headers', true)::json->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
    client_ua := NULL;
  END;
  
  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    client_ip::inet,
    client_ua,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.append_audit_log IS 
'Phase 3: Securely append audit log entry - only method to write audit logs';

-- ============================================================================
-- Audit Log Query Functions (Read-Only)
-- ============================================================================

-- Get audit logs for a user
CREATE OR REPLACE FUNCTION public.get_user_audit_logs(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.action,
    a.resource_type,
    a.resource_id,
    a.created_at,
    a.metadata
  FROM public.audit_logs a
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get audit logs for a resource
CREATE OR REPLACE FUNCTION public.get_resource_audit_logs(
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  action TEXT,
  created_at TIMESTAMPTZ,
  old_values JSONB,
  new_values JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.action,
    a.created_at,
    a.old_values,
    a.new_values
  FROM public.audit_logs a
  WHERE a.resource_type = p_resource_type
    AND a.resource_id = p_resource_id
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Audit Log Archive Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
  LIKE public.audit_logs INCLUDING ALL
);
ALTER TABLE public.audit_logs_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON TABLE public.audit_logs_archive IS 
'Archive for audit logs older than 7 years (compliance retention)';

-- Apply same immutability to archive
CREATE TRIGGER prevent_audit_archive_update
  BEFORE UPDATE ON public.audit_logs_archive
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

CREATE TRIGGER prevent_audit_archive_delete
  BEFORE DELETE ON public.audit_logs_archive
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_deletion();

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "admins_can_read_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- No one can insert directly (must use append_audit_log function)
CREATE POLICY "no_direct_insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (false);

-- Same for archive
CREATE POLICY "admins_can_read_audit_archive"
  ON public.audit_logs_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- ============================================================================
-- Test Immutability
-- ============================================================================

DO $$
DECLARE
  test_log_id UUID;
  test_passed BOOLEAN := true;
BEGIN
  -- Test: Can append
  BEGIN
    test_log_id := public.append_audit_log(
      NULL,  -- user_id
      'TEST_ACTION',
      'TEST_RESOURCE',
      'test-123',
      NULL,
      NULL,
      '{"test": true}'::jsonb
    );
    
    IF test_log_id IS NULL THEN
      RAISE EXCEPTION 'Failed to append audit log';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    test_passed := false;
    RAISE NOTICE 'Append test failed: %', SQLERRM;
  END;
  
  -- Test: Cannot update
  BEGIN
    UPDATE public.audit_logs SET action = 'MODIFIED' WHERE id = test_log_id;
    test_passed := false;
    RAISE NOTICE 'SECURITY BREACH: Update was allowed!';
  EXCEPTION WHEN OTHERS THEN
    -- Expected to fail
    NULL;
  END;
  
  -- Test: Cannot delete
  BEGIN
    DELETE FROM public.audit_logs WHERE id = test_log_id;
    test_passed := false;
    RAISE NOTICE 'SECURITY BREACH: Delete was allowed!';
  EXCEPTION WHEN OTHERS THEN
    -- Expected to fail
    NULL;
  END;
  
  -- Clean up test data
  -- Note: We can't delete it due to immutability, which is correct!
  -- In production, test data should be in a separate test database
  
  IF test_passed THEN
    RAISE NOTICE 'Immutability tests PASSED ✓';
  ELSE
    RAISE EXCEPTION 'Immutability tests FAILED!';
  END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 3 Audit Immutability Installed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - audit_logs (immutable)';
  RAISE NOTICE '  - audit_logs_archive (immutable)';
  RAISE NOTICE '';
  RAISE NOTICE 'Immutability enforced via:';
  RAISE NOTICE '  - REVOKE UPDATE/DELETE permissions';
  RAISE NOTICE '  - Triggers preventing modifications';
  RAISE NOTICE '  - RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - append_audit_log(...) - ONLY way to add logs';
  RAISE NOTICE '  - get_user_audit_logs(user_id, limit, offset)';
  RAISE NOTICE '  - get_resource_audit_logs(type, id, limit)';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT append_audit_log(user_id, ''LOGIN'', ''user'', user_id::text);';
  RAISE NOTICE '';
END $$;

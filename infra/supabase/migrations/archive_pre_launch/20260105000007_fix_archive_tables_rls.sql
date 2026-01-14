-- Fix Archive Tables RLS
-- Purpose: Add missing RLS policies to archive tables
-- Priority: HIGH
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #7

-- ============================================================================
-- ISSUE: Archive tables have RLS enabled but missing SELECT policies
-- 
-- Tables affected:
-- - audit_logs_archive (RLS enabled, no policies)
-- - approval_requests_archive (fixed in 20260105000001)
-- - approvals_archive (fixed in 20260105000001)
-- ============================================================================

-- ============================================================================
-- 1. audit_logs_archive - Add SELECT policies
-- ============================================================================

-- Users can view their own audit logs
CREATE POLICY audit_logs_archive_select_own ON audit_logs_archive
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all audit logs in their organizations
CREATE POLICY audit_logs_archive_select_admin ON audit_logs_archive
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      JOIN audit_logs al ON al.organization_id = uo.organization_id
      WHERE uo.user_id = auth.uid()
      AND uo.role IN ('admin', 'owner')
      AND uo.status = 'active'
      AND al.id = audit_logs_archive.id
    )
  );

-- Service role can access all
CREATE POLICY audit_logs_archive_service_role ON audit_logs_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY audit_logs_archive_select_own ON audit_logs_archive IS 
  'Users can view their own archived audit logs';

COMMENT ON POLICY audit_logs_archive_select_admin ON audit_logs_archive IS 
  'Admins can view all archived audit logs in their organizations';

-- ============================================================================
-- 2. Verify all archive tables have proper RLS
-- ============================================================================

-- Create verification view
CREATE OR REPLACE VIEW archive_tables_rls_status AS
SELECT 
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count,
  ARRAY_AGG(p.policyname ORDER BY p.policyname) FILTER (WHERE p.policyname IS NOT NULL) as policies,
  CASE 
    WHEN t.rowsecurity = false THEN '❌ RLS DISABLED'
    WHEN COUNT(p.policyname) = 0 THEN '⚠️ NO POLICIES'
    WHEN COUNT(p.policyname) FILTER (WHERE p.cmd = 'SELECT') = 0 THEN '⚠️ NO SELECT POLICY'
    ELSE '✅ PROTECTED'
  END as status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
AND t.tablename LIKE '%archive%'
GROUP BY t.tablename, t.rowsecurity
ORDER BY 
  CASE 
    WHEN t.rowsecurity = false THEN 0
    WHEN COUNT(p.policyname) = 0 THEN 1
    WHEN COUNT(p.policyname) FILTER (WHERE p.cmd = 'SELECT') = 0 THEN 2
    ELSE 3
  END,
  t.tablename;

COMMENT ON VIEW archive_tables_rls_status IS 
  'Shows RLS status for all archive tables';

GRANT SELECT ON archive_tables_rls_status TO authenticated;

-- ============================================================================
-- 3. Ensure archive tables match source table security
-- ============================================================================

-- approval_requests_archive should match approval_requests
-- (Already fixed in 20260105000001_fix_missing_rls.sql)

-- approvals_archive should match approvals
-- (Already fixed in 20260105000001_fix_missing_rls.sql)

-- audit_logs_archive should match audit_logs
-- (Fixed above)

-- ============================================================================
-- 4. Add missing indexes on archive tables
-- ============================================================================

-- audit_logs_archive indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_user 
ON audit_logs_archive(user_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_created 
ON audit_logs_archive(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_archived 
ON audit_logs_archive(archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_action 
ON audit_logs_archive(action, archived_at DESC);

COMMENT ON INDEX idx_audit_logs_archive_user IS 
  'Optimizes queries for user audit logs';

-- approval_requests_archive indexes (if not already created)
CREATE INDEX IF NOT EXISTS idx_approval_requests_archive_tenant 
ON approval_requests_archive(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_archive_requester 
ON approval_requests_archive(requester_id, created_at DESC)
WHERE requester_id IS NOT NULL;

-- approvals_archive indexes (if not already created)
CREATE INDEX IF NOT EXISTS idx_approvals_archive_tenant 
ON approvals_archive(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approvals_archive_approver 
ON approvals_archive(approver_id, created_at DESC)
WHERE approver_id IS NOT NULL;

-- ============================================================================
-- 5. Create function to verify archive table security
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_archive_table_security()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  has_select_policy BOOLEAN,
  has_insert_policy BOOLEAN,
  has_update_deny BOOLEAN,
  has_delete_deny BOOLEAN,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::TEXT,
    t.rowsecurity,
    EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = t.tablename 
      AND cmd = 'SELECT'
    ) as has_select,
    EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = t.tablename 
      AND cmd = 'INSERT'
    ) as has_insert,
    EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = t.tablename 
      AND cmd = 'UPDATE'
      AND qual = 'false'
    ) as has_update_deny,
    EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = t.tablename 
      AND cmd = 'DELETE'
      AND qual = 'false'
    ) as has_delete_deny,
    CASE 
      WHEN NOT t.rowsecurity THEN '❌ RLS DISABLED'
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t.tablename AND cmd = 'SELECT') 
        THEN '⚠️ NO SELECT POLICY'
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t.tablename AND cmd = 'UPDATE' AND qual = 'false')
        THEN '⚠️ NO UPDATE DENY'
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t.tablename AND cmd = 'DELETE' AND qual = 'false')
        THEN '⚠️ NO DELETE DENY'
      ELSE '✅ SECURE'
    END::TEXT
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  AND t.tablename LIKE '%archive%'
  ORDER BY t.tablename;
END;
$$;

COMMENT ON FUNCTION verify_archive_table_security IS 
  'Verifies that archive tables have proper RLS and immutability policies';

GRANT EXECUTE ON FUNCTION verify_archive_table_security TO authenticated;

-- ============================================================================
-- 6. Verification
-- ============================================================================

DO $$
DECLARE
  v_archive_count INTEGER;
  v_protected_count INTEGER;
  v_unprotected_count INTEGER;
BEGIN
  -- Count archive tables
  SELECT COUNT(*) INTO v_archive_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename LIKE '%archive%';
  
  -- Count protected tables
  SELECT COUNT(*) INTO v_protected_count
  FROM archive_tables_rls_status
  WHERE status = '✅ PROTECTED';
  
  -- Count unprotected tables
  SELECT COUNT(*) INTO v_unprotected_count
  FROM archive_tables_rls_status
  WHERE status != '✅ PROTECTED';
  
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Archive Tables RLS Fix Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total archive tables: %', v_archive_count;
  RAISE NOTICE 'Protected tables: %', v_protected_count;
  RAISE NOTICE 'Unprotected tables: %', v_unprotected_count;
  RAISE NOTICE '';
  
  IF v_unprotected_count > 0 THEN
    RAISE WARNING '⚠️  Some archive tables still need protection';
    RAISE NOTICE 'Run: SELECT * FROM archive_tables_rls_status WHERE status != ''✅ PROTECTED'';';
  ELSE
    RAISE NOTICE '✅ All archive tables are properly protected';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';
  RAISE NOTICE '  SELECT * FROM archive_tables_rls_status;';
  RAISE NOTICE '  SELECT * FROM verify_archive_table_security();';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;

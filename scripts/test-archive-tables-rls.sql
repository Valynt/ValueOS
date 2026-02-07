-- Test Archive Tables RLS
-- Purpose: Verify archive tables have proper RLS policies
-- Usage: psql $DATABASE_URL -f scripts/test-archive-tables-rls.sql

\echo '============================================================'
\echo 'Testing Archive Tables RLS'
\echo '============================================================'
\echo ''

-- ============================================================================
-- 1. List all archive tables
-- ============================================================================

\echo '1. Listing all archive tables...'
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%archive%'
ORDER BY tablename;

\echo ''

-- ============================================================================
-- 2. Check RLS status for each archive table
-- ============================================================================

\echo '2. Checking RLS status...'
SELECT * FROM archive_tables_rls_status
ORDER BY 
  CASE status
    WHEN '❌ RLS DISABLED' THEN 0
    WHEN '⚠️ NO POLICIES' THEN 1
    WHEN '⚠️ NO SELECT POLICY' THEN 2
    ELSE 3
  END,
  tablename;

\echo ''

-- ============================================================================
-- 3. Detailed security verification
-- ============================================================================

\echo '3. Detailed security verification...'
SELECT * FROM verify_archive_table_security()
ORDER BY 
  CASE status
    WHEN '❌ RLS DISABLED' THEN 0
    WHEN '⚠️ NO SELECT POLICY' THEN 1
    WHEN '⚠️ NO UPDATE DENY' THEN 2
    WHEN '⚠️ NO DELETE DENY' THEN 3
    ELSE 4
  END,
  table_name;

\echo ''

-- ============================================================================
-- 4. Check approval_requests_archive
-- ============================================================================

\echo '4. Checking approval_requests_archive policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%tenant_id%' THEN '✅ TENANT ISOLATED'
    WHEN qual = 'true' THEN '✅ SERVICE ROLE'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'approval_requests_archive'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 5. Check approvals_archive
-- ============================================================================

\echo '5. Checking approvals_archive policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%tenant_id%' THEN '✅ TENANT ISOLATED'
    WHEN qual = 'true' THEN '✅ SERVICE ROLE'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'approvals_archive'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 6. Check audit_logs_archive
-- ============================================================================

\echo '6. Checking audit_logs_archive policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%user_id%' THEN '✅ USER ISOLATED'
    WHEN qual LIKE '%admin%' THEN '✅ ADMIN ACCESS'
    WHEN qual = 'true' THEN '✅ SERVICE ROLE'
    WHEN qual = 'false' THEN '✅ IMMUTABLE'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'audit_logs_archive'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 7. Check for immutability policies
-- ============================================================================

\echo '7. Checking immutability policies...'
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename LIKE '%archive%'
AND cmd IN ('UPDATE', 'DELETE')
AND qual = 'false'
ORDER BY tablename, cmd;

\echo ''

-- ============================================================================
-- 8. Check indexes on archive tables
-- ============================================================================

\echo '8. Checking indexes on archive tables...'
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE '%archive%'
ORDER BY tablename, indexname;

\echo ''

-- ============================================================================
-- 9. Summary
-- ============================================================================

\echo '============================================================'
\echo 'Test Summary'
\echo '============================================================'
\echo ''

DO $$
DECLARE
  v_total_archives INTEGER;
  v_protected_archives INTEGER;
  v_with_select INTEGER;
  v_with_immutability INTEGER;
  v_with_indexes INTEGER;
BEGIN
  -- Count total archive tables
  SELECT COUNT(*) INTO v_total_archives
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename LIKE '%archive%';
  
  -- Count protected archives
  SELECT COUNT(*) INTO v_protected_archives
  FROM archive_tables_rls_status
  WHERE status = '✅ PROTECTED';
  
  -- Count with SELECT policies
  SELECT COUNT(DISTINCT tablename) INTO v_with_select
  FROM pg_policies
  WHERE tablename LIKE '%archive%'
  AND cmd = 'SELECT';
  
  -- Count with immutability policies
  SELECT COUNT(DISTINCT tablename) INTO v_with_immutability
  FROM pg_policies
  WHERE tablename LIKE '%archive%'
  AND cmd IN ('UPDATE', 'DELETE')
  AND qual = 'false';
  
  -- Count with indexes
  SELECT COUNT(DISTINCT tablename) INTO v_with_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename LIKE '%archive%';
  
  RAISE NOTICE 'Total archive tables: %', v_total_archives;
  RAISE NOTICE 'Protected archives: %', v_protected_archives;
  RAISE NOTICE 'With SELECT policies: %', v_with_select;
  RAISE NOTICE 'With immutability: %', v_with_immutability;
  RAISE NOTICE 'With indexes: %', v_with_indexes;
  RAISE NOTICE '';
  
  IF v_protected_archives = v_total_archives THEN
    RAISE NOTICE '✅ SUCCESS: All archive tables are protected';
  ELSE
    RAISE WARNING '❌ FAILURE: % archive tables need protection', 
      v_total_archives - v_protected_archives;
  END IF;
  
  IF v_with_immutability = v_total_archives THEN
    RAISE NOTICE '✅ All archive tables are immutable';
  ELSE
    RAISE WARNING '⚠️  % archive tables missing immutability policies', 
      v_total_archives - v_with_immutability;
  END IF;
  
  IF v_with_indexes = v_total_archives THEN
    RAISE NOTICE '✅ All archive tables have indexes';
  ELSE
    RAISE WARNING '⚠️  % archive tables missing indexes', 
      v_total_archives - v_with_indexes;
  END IF;
END $$;

\echo ''
\echo '============================================================'

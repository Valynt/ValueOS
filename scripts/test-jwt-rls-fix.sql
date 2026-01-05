-- Test JWT-Based RLS Policy Fix
-- Purpose: Verify JWT policies were replaced with auth.uid()
-- Usage: psql $DATABASE_URL -f scripts/test-jwt-rls-fix.sql

\echo '============================================================'
\echo 'Testing JWT-Based RLS Policy Fix'
\echo '============================================================'
\echo ''

-- ============================================================================
-- 1. Check for remaining JWT usage in policies
-- ============================================================================

\echo '1. Checking for JWT usage in RLS policies...'
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%' 
    THEN '❌ USES JWT'
    ELSE '✅ SAFE'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
AND (qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%')
ORDER BY tablename, policyname;

\echo ''

-- ============================================================================
-- 2. Verify helper functions exist
-- ============================================================================

\echo '2. Checking helper functions...'
SELECT 
  proname as function_name,
  CASE 
    WHEN provolatile = 'i' THEN '✅ IMMUTABLE'
    WHEN provolatile = 's' THEN '✅ STABLE'
    WHEN provolatile = 'v' THEN '⚠️ VOLATILE'
  END as volatility,
  prosecdef as security_definer
FROM pg_proc
WHERE proname IN (
  'get_user_tenant_ids',
  'get_user_organization_ids',
  'is_user_admin',
  'is_user_org_admin'
)
ORDER BY proname;

\echo ''

-- ============================================================================
-- 3. Check llm_gating_policies
-- ============================================================================

\echo '3. Checking llm_gating_policies policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%get_user_tenant_ids%' THEN '✅ USES HELPER'
    WHEN qual LIKE '%auth.jwt()%' THEN '❌ USES JWT'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'llm_gating_policies'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 4. Check llm_usage
-- ============================================================================

\echo '4. Checking llm_usage policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%get_user_tenant_ids%' OR qual LIKE '%auth.uid()%' THEN '✅ SAFE'
    WHEN qual LIKE '%auth.jwt()%' THEN '❌ USES JWT'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'llm_usage'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 5. Check agent_accuracy_metrics
-- ============================================================================

\echo '5. Checking agent_accuracy_metrics policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%get_user_organization_ids%' THEN '✅ USES HELPER'
    WHEN qual LIKE '%auth.jwt()%' THEN '❌ USES JWT'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'agent_accuracy_metrics'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 6. Check backup_logs
-- ============================================================================

\echo '6. Checking backup_logs policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%is_user_admin%' THEN '✅ USES HELPER'
    WHEN qual LIKE '%auth.jwt()%' THEN '❌ USES JWT'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'backup_logs'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 7. Check cost_alerts
-- ============================================================================

\echo '7. Checking cost_alerts policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%is_user_admin%' THEN '✅ USES HELPER'
    WHEN qual LIKE '%auth.jwt()%' THEN '❌ USES JWT'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'cost_alerts'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 8. Check rate_limit_violations
-- ============================================================================

\echo '8. Checking rate_limit_violations policies...'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%is_user_admin%' THEN '✅ USES HELPER'
    WHEN qual LIKE '%auth.jwt()%' THEN '❌ USES JWT'
    ELSE '⚠️ OTHER'
  END as policy_type
FROM pg_policies
WHERE tablename = 'rate_limit_violations'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- 9. Use jwt_policy_audit view
-- ============================================================================

\echo '9. Overall JWT policy audit...'
SELECT * FROM jwt_policy_audit 
WHERE status = '⚠️ USES JWT'
ORDER BY tablename;

\echo ''

-- ============================================================================
-- 10. Summary
-- ============================================================================

\echo '============================================================'
\echo 'Test Summary'
\echo '============================================================'
\echo ''

DO $$
DECLARE
  v_jwt_count INTEGER;
  v_total_count INTEGER;
  v_helper_count INTEGER;
BEGIN
  -- Count JWT usage
  SELECT COUNT(*) INTO v_jwt_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND (qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%');
  
  -- Count total policies
  SELECT COUNT(*) INTO v_total_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- Count helper function usage
  SELECT COUNT(*) INTO v_helper_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND (
    qual LIKE '%get_user_tenant_ids%' 
    OR qual LIKE '%get_user_organization_ids%'
    OR qual LIKE '%is_user_admin%'
    OR qual LIKE '%is_user_org_admin%'
  );
  
  RAISE NOTICE 'Total policies: %', v_total_count;
  RAISE NOTICE 'Policies using JWT: %', v_jwt_count;
  RAISE NOTICE 'Policies using helpers: %', v_helper_count;
  RAISE NOTICE '';
  
  IF v_jwt_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: No policies use JWT';
  ELSE
    RAISE WARNING '❌ FAILURE: % policies still use JWT', v_jwt_count;
  END IF;
  
  IF v_helper_count > 0 THEN
    RAISE NOTICE '✅ Helper functions are being used';
  ELSE
    RAISE WARNING '⚠️  No policies use helper functions';
  END IF;
END $$;

\echo ''
\echo '============================================================'

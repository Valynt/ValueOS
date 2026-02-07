-- ============================================================================
-- RLS Policy Audit Script
-- ============================================================================
-- Purpose: Comprehensive audit of current RLS policies
-- Usage: Run in Supabase SQL Editor or psql
-- ============================================================================

\echo '═══════════════════════════════════════════════════════════════'
\echo '                    RLS POLICY AUDIT REPORT                     '
\echo '═══════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- 1. Tables Without RLS Enabled
-- ============================================================================

\echo '1. TABLES WITHOUT RLS ENABLED'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  schemaname,
  tablename,
  '⚠️  RLS NOT ENABLED' AS status
FROM pg_tables t
WHERE schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_class c
    WHERE c.relname = t.tablename
      AND c.relrowsecurity = true
  )
ORDER BY tablename;

\echo ''

-- ============================================================================
-- 2. Tables With RLS But No Policies
-- ============================================================================

\echo '2. TABLES WITH RLS BUT NO POLICIES'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  c.relname AS tablename,
  '⚠️  NO POLICIES DEFINED' AS status,
  'RLS enabled but no policies = no access for anyone!' AS issue
FROM pg_class c
WHERE c.relrowsecurity = true
  AND c.relnamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
  )
ORDER BY c.relname;

\echo ''

-- ============================================================================
-- 3. Overly Permissive Policies
-- ============================================================================

\echo '3. POTENTIALLY OVERLY PERMISSIVE POLICIES'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual = 'true' AND cmd IN ('INSERT', 'UPDATE', 'DELETE') 
    THEN '🔴 CRITICAL: Allows all writes'
    WHEN qual = 'true' AND cmd = 'SELECT'
    THEN '🟡 WARNING: Allows all reads'
    ELSE '🟢 OK'
  END AS risk_level,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
ORDER BY 
  CASE 
    WHEN qual = 'true' AND cmd IN ('INSERT', 'UPDATE', 'DELETE') THEN 1
    WHEN qual = 'true' AND cmd = 'SELECT' THEN 2
    ELSE 3
  END,
  tablename;

\echo ''

-- ============================================================================
-- 4. Policies Using JWT Claims (Potential Security Risk)
-- ============================================================================

\echo '4. POLICIES USING JWT CLAIMS DIRECTLY'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  tablename,
  policyname,
  '⚠️  Uses JWT claims' AS warning,
  'Consider using SECURITY DEFINER functions instead' AS recommendation,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual LIKE '%auth.jwt()%' OR
    with_check LIKE '%auth.jwt()%'
  )
ORDER BY tablename;

\echo ''

-- ============================================================================
-- 5. Tables Missing Service Role Bypass
-- ============================================================================

\echo '5. TABLES WITHOUT SERVICE ROLE BYPASS'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  c.relname AS tablename,
  '⚠️  No service role bypass' AS issue,
  'Backend operations may fail' AS impact
FROM pg_class c
WHERE c.relrowsecurity = true
  AND c.relnamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_policy p
    WHERE p.polrelid = c.oid
      AND p.polroles @> ARRAY['service_role'::regrole::oid]
  )
ORDER BY c.relname;

\echo ''

-- ============================================================================
-- 6. Performance: Tables Without Indexes on RLS Columns
-- ============================================================================

\echo '6. PERFORMANCE: MISSING INDEXES ON RLS COLUMNS'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  p.tablename,
  'user_id' AS column_name,
  '⚠️  No index on user_id' AS issue,
  'RLS queries may be slow' AS impact
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.qual LIKE '%user_id%'
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_indexes i
    WHERE i.tablename = p.tablename
      AND (
        i.indexdef LIKE '%user_id%' OR
        i.indexname LIKE '%user_id%'
      )
  )
GROUP BY p.tablename
ORDER BY p.tablename;

\echo ''

-- ============================================================================
-- 7. Audit Tables Without Immutability Protection
-- ============================================================================

\echo '7. AUDIT TABLES WITHOUT IMMUTABILITY PROTECTION'
\echo '─────────────────────────────────────────────────────────────────'

WITH audit_tables AS (
  SELECT tablename 
  FROM pg_tables 
  WHERE schemaname = 'public'
    AND (
      tablename LIKE '%audit%' OR
      tablename LIKE '%log%' OR
      tablename = 'sof_audit_events'
    )
)
SELECT 
  a.tablename,
  CASE 
    WHEN up.policyname IS NULL THEN '❌ No UPDATE prevention'
    ELSE '✅ UPDATE blocked'
  END AS update_protection,
  CASE 
    WHEN dp.policyname IS NULL THEN '❌ No DELETE prevention'
    ELSE '✅ DELETE blocked'
  END AS delete_protection
FROM audit_tables a
LEFT JOIN pg_policies up ON up.tablename = a.tablename 
  AND up.cmd = 'UPDATE' 
  AND up.qual = 'false'
LEFT JOIN pg_policies dp ON dp.tablename = a.tablename 
  AND dp.cmd = 'DELETE' 
  AND dp.qual = 'false'
WHERE up.policyname IS NULL OR dp.policyname IS NULL
ORDER BY a.tablename;

\echo ''

-- ============================================================================
-- 8. Policy Summary by Table
-- ============================================================================

\echo '8. POLICY SUMMARY BY TABLE'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  tablename,
  COUNT(*) AS policy_count,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') AS select_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') AS insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') AS update_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') AS delete_policies,
  COUNT(*) FILTER (WHERE cmd = 'ALL') AS all_policies,
  COUNT(*) FILTER (WHERE roles @> ARRAY['service_role'::regrole]) AS service_role_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- ============================================================================
-- 9. Helper Functions Check
-- ============================================================================

\echo '9. RLS HELPER FUNCTIONS'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  proname AS function_name,
  CASE 
    WHEN prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '⚠️  Not SECURITY DEFINER'
  END AS security_status,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname IN ('is_admin', 'is_tenant_member', 'is_tenant_admin', 'user_owns_record')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;

\echo ''

-- ============================================================================
-- 10. Summary Statistics
-- ============================================================================

\echo '10. SUMMARY STATISTICS'
\echo '─────────────────────────────────────────────────────────────────'

SELECT 
  'Total tables' AS metric,
  COUNT(*)::text AS value
FROM pg_tables WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Tables with RLS enabled',
  COUNT(*)::text
FROM pg_class c
WHERE c.relrowsecurity = true AND c.relnamespace = 'public'::regnamespace
UNION ALL
SELECT 
  'Total RLS policies',
  COUNT(*)::text
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 
  'Policies using auth.uid()',
  COUNT(*)::text
FROM pg_policies 
WHERE schemaname = 'public' AND qual LIKE '%auth.uid()%'
UNION ALL
SELECT 
  'Policies using JWT claims',
  COUNT(*)::text
FROM pg_policies 
WHERE schemaname = 'public' AND qual LIKE '%auth.jwt()%'
UNION ALL
SELECT 
  'Service role bypass policies',
  COUNT(*)::text
FROM pg_policies 
WHERE schemaname = 'public' AND roles @> ARRAY['service_role'::regrole]
UNION ALL
SELECT 
  'Helper functions',
  COUNT(*)::text
FROM pg_proc
WHERE proname IN ('is_admin', 'is_tenant_member', 'is_tenant_admin')
  AND pronamespace = 'public'::regnamespace;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo ''
\echo 'AUDIT COMPLETE!'
\echo ''
\echo 'Recommendations:'
\echo '  1. Enable RLS on all tables that store user data'
\echo '  2. Add service role bypass to all tables'
\echo '  3. Replace JWT claim checks with SECURITY DEFINER functions'
\echo '  4. Add indexes on columns used in RLS policies'
\echo '  5. Protect audit tables from updates/deletes'
\echo ''
\echo 'Next steps:'
\echo '  - Review findings above'
\echo '  - Apply fixes: supabase/migrations/20251201000000_rls_refinements_phase1.sql'
\echo '  - Run tests: test/rls_tests.sql'
\echo '  - Monitor performance: Check query plans'
\echo ''
\echo '═══════════════════════════════════════════════════════════════'

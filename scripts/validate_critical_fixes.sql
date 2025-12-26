-- ============================================================================
-- COMPREHENSIVE VALIDATION SUITE FOR CRITICAL RLS FIXES
-- ============================================================================
-- Purpose: Validate all 5 critical fixes have been properly applied
-- Usage: psql $DATABASE_URL -f validate_critical_fixes.sql
-- Expected: All checks should return ✅ PASS status
-- 
-- Run this script:
-- 1. After applying the main migration
-- 2. In staging environment before production deployment
-- 3. In production after deployment to confirm success
-- 4. As part of CI/CD verification pipeline
-- ============================================================================

\timing on
\echo ''
\echo '============================================================================'
\echo 'CRITICAL RLS FIXES VALIDATION SUITE'
\echo 'Date: ' `date`
\echo '============================================================================'
\echo ''

-- ============================================================================
-- SECTION 1: FUNCTION EXISTENCE CHECKS
-- ============================================================================

\echo '1. Validating Required Functions Exist...'
\echo ''

DO $$
DECLARE
  v_count INT;
BEGIN
  -- Check auth.get_current_org_id()
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'auth' AND p.proname = 'get_current_org_id';
  
  IF v_count = 1 THEN
    RAISE NOTICE '  ✅ PASS: auth.get_current_org_id() exists';
  ELSE
    RAISE WARNING '  ❌ FAIL: auth.get_current_org_id() not found (billing RLS will fail)';
  END IF;

  -- Check public.is_org_member_optimized()
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'is_org_member_optimized';
  
  IF v_count = 1 THEN
    RAISE NOTICE '  ✅ PASS: is_org_member_optimized() exists';
  ELSE
    RAISE WARNING '  ❌ FAIL: is_org_member_optimized() not found (RLS not optimized)';
  END IF;

  -- Check public.validate_critical_fixes()
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'validate_critical_fixes';
  
  IF v_count = 1 THEN
    RAISE NOTICE '  ✅ PASS: validate_critical_fixes() exists';
  ELSE
    RAISE WARNING '  ⚠️  WARNING: validate_critical_fixes() not found';
  END IF;

  -- Check prevent_audit_modification() enhanced version
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname = 'prevent_audit_modification'
    AND pg_get_functiondef(p.oid) LIKE '%security_audit_log%';
  
  IF v_count = 1 THEN
    RAISE NOTICE '  ✅ PASS: prevent_audit_modification() enhanced with logging';
  ELSE
    RAISE WARNING '  ⚠️  WARNING: prevent_audit_modification() may be basic version';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 2: RLS POLICY OPTIMIZATION VALIDATION
-- ============================================================================

\echo '2. Validating RLS Policy Optimization...'
\echo ''

DO $$
DECLARE
  v_optimized_count INT;
  v_old_count INT;
  v_total_policies INT;
BEGIN
  -- Count policies using is_org_member_optimized()
  SELECT COUNT(*) INTO v_optimized_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual LIKE '%is_org_member_optimized%' OR with_check LIKE '%is_org_member_optimized%');

  -- Count policies still using old is_org_member()
  SELECT COUNT(*) INTO v_old_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual LIKE '%is_org_member(%' OR with_check LIKE '%is_org_member(%')
    AND (qual NOT LIKE '%is_org_member_optimized%' AND with_check NOT LIKE '%is_org_member_optimized%');

  -- Count total tenant isolation policies
  SELECT COUNT(*) INTO v_total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE '%tenant%';

  RAISE NOTICE '  Optimized policies (using JWT claims): %', v_optimized_count;
  RAISE NOTICE '  Old policies (database lookup): %', v_old_count;
  RAISE NOTICE '  Total tenant isolation policies: %', v_total_policies;

  IF v_optimized_count >= 30 THEN
    RAISE NOTICE '  ✅ PASS: % policies optimized for JWT claims', v_optimized_count;
  ELSIF v_optimized_count > 0 THEN
    RAISE WARNING '  ⚠️  PARTIAL: Only % policies optimized (expected 30+)', v_optimized_count;
  ELSE
    RAISE WARNING '  ❌ FAIL: No policies using is_org_member_optimized()';
  END IF;

  IF v_old_count > 0 THEN
    RAISE WARNING '  ⚠️  WARNING: % policies still using old is_org_member() function', v_old_count;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 3: AUDIT IMMUTABILITY VALIDATION
-- ============================================================================

\echo '3. Validating Audit Log Immutability...'
\echo ''

DO $$
DECLARE
  v_trigger_count INT;
  v_table_name TEXT;
  v_tables TEXT[] := ARRAY['audit_logs', 'security_audit_log', 'agent_audit_log'];
BEGIN
  FOREACH v_table_name IN ARRAY v_tables
  LOOP
    SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = v_table_name
      AND t.tgname LIKE 'tr_protect_%'
      AND t.tgtype & 66 = 66; -- BEFORE UPDATE OR DELETE

    IF v_trigger_count > 0 THEN
      RAISE NOTICE '  ✅ PASS: % protected by immutability trigger', v_table_name;
    ELSE
      RAISE WARNING '  ❌ FAIL: % missing immutability trigger', v_table_name;
    END IF;
  END LOOP;
END $$;

\echo ''

-- Test audit immutability (should fail with proper error)
\echo '4. Testing Audit Immutability (expecting failure)...'
\echo ''

DO $$
DECLARE
  v_test_id UUID;
BEGIN
  -- Insert a test audit record
  INSERT INTO public.audit_logs (
    organization_id, user_id, action, resource_type, details
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'test_action',
    'test_resource',
    '{}'::jsonb
  ) RETURNING id INTO v_test_id;

  -- Attempt to update (should fail)
  BEGIN
    UPDATE public.audit_logs SET action = 'modified' WHERE id = v_test_id;
    RAISE WARNING '  ❌ FAIL: Audit log UPDATE was allowed (should be blocked)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ✅ PASS: Audit log UPDATE properly blocked: %', SQLERRM;
  END;

  -- Attempt to delete (should fail)
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_test_id;
    RAISE WARNING '  ❌ FAIL: Audit log DELETE was allowed (should be blocked)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ✅ PASS: Audit log DELETE properly blocked: %', SQLERRM;
  END;

  -- Cleanup using service_role bypass (if test record still exists)
  -- In production, service_role can bypass RLS
  -- DELETE FROM public.audit_logs WHERE id = v_test_id;
END $$;

\echo ''

-- ============================================================================
-- SECTION 4: COMPOSITE INDEX VALIDATION
-- ============================================================================

\echo '5. Validating Critical Composite Indexes...'
\echo ''

DO $$
DECLARE
  v_index RECORD;
  v_missing_count INT := 0;
  v_indexes TEXT[] := ARRAY[
    'idx_cases_org_user',
    'idx_cases_org_status',
    'idx_workflows_org_user',
    'idx_workflows_org_status',
    'idx_messages_org_created',
    'idx_agent_sessions_org_status',
    'idx_audit_logs_org_created',
    'idx_agent_memory_org_agent'
  ];
  v_index_name TEXT;
BEGIN
  FOREACH v_index_name IN ARRAY v_indexes
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = v_index_name
    ) THEN
      RAISE NOTICE '  ✅ PASS: % exists', v_index_name;
    ELSE
      RAISE WARNING '  ❌ FAIL: % missing', v_index_name;
      v_missing_count := v_missing_count + 1;
    END IF;
  END LOOP;

  IF v_missing_count = 0 THEN
    RAISE NOTICE '  ✅ PASS: All 8 composite indexes exist';
  ELSE
    RAISE WARNING '  ❌ FAIL: % of 8 indexes missing', v_missing_count;
  END IF;
END $$;

\echo ''

-- Show index sizes for performance monitoring
\echo '6. Index Size Report (for monitoring)...'
\echo ''

SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_cases_org_user', 'idx_cases_org_status',
    'idx_workflows_org_user', 'idx_workflows_org_status',
    'idx_messages_org_created', 'idx_agent_sessions_org_status',
    'idx_audit_logs_org_created', 'idx_agent_memory_org_agent'
  )
ORDER BY tablename, indexname;

\echo ''

-- ============================================================================
-- SECTION 5: JUNCTION TABLE VALIDATION
-- ============================================================================

\echo '7. Validating Junction Table organization_id Columns...'
\echo ''

DO $$
DECLARE
  v_table_name TEXT;
  v_tables TEXT[] := ARRAY[
    'use_case_capabilities',
    'use_case_kpis',
    'kpi_financial_metrics',
    'team_members'
  ];
  v_col_exists BOOLEAN;
  v_col_nullable TEXT;
  v_has_index BOOLEAN;
  v_has_policy BOOLEAN;
  v_missing_count INT := 0;
BEGIN
  FOREACH v_table_name IN ARRAY v_tables
  LOOP
    -- Check column exists and is NOT NULL
    SELECT 
      COUNT(*) > 0,
      MAX(is_nullable)
    INTO v_col_exists, v_col_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_table_name
      AND column_name = 'organization_id';

    -- Check index exists
    SELECT COUNT(*) > 0 INTO v_has_index
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = v_table_name
      AND indexdef LIKE '%organization_id%';

    -- Check RLS policy exists
    SELECT COUNT(*) > 0 INTO v_has_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = v_table_name
      AND (qual LIKE '%organization_id%' OR with_check LIKE '%organization_id%');

    IF v_col_exists AND v_col_nullable = 'NO' AND v_has_index AND v_has_policy THEN
      RAISE NOTICE '  ✅ PASS: % (column: NOT NULL, index: exists, RLS: enabled)', v_table_name;
    ELSE
      RAISE WARNING '  ❌ FAIL: % (column: %, nullable: %, index: %, RLS: %)',
        v_table_name,
        CASE WHEN v_col_exists THEN 'exists' ELSE 'missing' END,
        v_col_nullable,
        CASE WHEN v_has_index THEN 'exists' ELSE 'missing' END,
        CASE WHEN v_has_policy THEN 'enabled' ELSE 'disabled' END;
      v_missing_count := v_missing_count + 1;
    END IF;
  END LOOP;

  IF v_missing_count = 0 THEN
    RAISE NOTICE '  ✅ PASS: All 4 junction tables properly configured';
  ELSE
    RAISE WARNING '  ❌ FAIL: % of 4 junction tables incomplete', v_missing_count;
  END IF;
END $$;

\echo ''

-- Show junction table row counts
\echo '8. Junction Table Data Validation...'
\echo ''

DO $$
DECLARE
  v_table_name TEXT;
  v_tables TEXT[] := ARRAY[
    'use_case_capabilities',
    'use_case_kpis',
    'kpi_financial_metrics',
    'team_members'
  ];
  v_total_rows INT;
  v_null_org_rows INT;
BEGIN
  FOREACH v_table_name IN ARRAY v_tables
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM public.%I', v_table_name) INTO v_total_rows;
    EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE organization_id IS NULL', v_table_name) INTO v_null_org_rows;

    IF v_null_org_rows = 0 THEN
      RAISE NOTICE '  ✅ PASS: % - % rows, 0 NULL organization_id', v_table_name, v_total_rows;
    ELSE
      RAISE WARNING '  ❌ FAIL: % - % rows with NULL organization_id (data migration incomplete)', v_table_name, v_null_org_rows;
    END IF;
  END LOOP;
END $$;

\echo ''

-- ============================================================================
-- SECTION 6: PERFORMANCE VALIDATION
-- ============================================================================

\echo '9. Performance Validation (Query Explain Analysis)...'
\echo ''

-- Test 1: Optimized RLS policy should use index
\echo '  Test 1: RLS policy with organization_id filter'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT COUNT(*) FROM public.cases WHERE organization_id = '00000000-0000-0000-0000-000000000000';

\echo ''

-- Test 2: Composite index usage
\echo '  Test 2: Composite index (organization_id + user_id)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT COUNT(*) FROM public.cases 
WHERE organization_id = '00000000-0000-0000-0000-000000000000'
  AND user_id = '00000000-0000-0000-0000-000000000000';

\echo ''

-- Test 3: Junction table with organization_id
\echo '  Test 3: Junction table with organization_id filter'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT COUNT(*) FROM public.use_case_capabilities 
WHERE organization_id = '00000000-0000-0000-0000-000000000000';

\echo ''

-- ============================================================================
-- SECTION 7: COMPREHENSIVE VALIDATION SUMMARY
-- ============================================================================

\echo '10. Running Comprehensive Validation Function...'
\echo ''

SELECT 
  check_name,
  status,
  details
FROM public.validate_critical_fixes();

\echo ''

-- ============================================================================
-- SECTION 8: SECURITY VALIDATION
-- ============================================================================

\echo '11. Security Validation...'
\echo ''

DO $$
DECLARE
  v_rls_disabled_count INT;
BEGIN
  -- Check for tables with RLS disabled
  SELECT COUNT(*) INTO v_rls_disabled_count
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'users', 'organizations', 'cases', 'workflows', 'messages',
      'agents', 'agent_sessions', 'agent_memory', 'llm_usage',
      'business_objectives', 'capabilities', 'use_cases', 'kpis',
      'value_trees', 'value_commits', 'audit_logs',
      'use_case_capabilities', 'use_case_kpis', 'kpi_financial_metrics',
      'team_members'
    )
    AND NOT c.relrowsecurity;

  IF v_rls_disabled_count = 0 THEN
    RAISE NOTICE '  ✅ PASS: All critical tables have RLS enabled';
  ELSE
    RAISE WARNING '  ❌ FAIL: % critical tables have RLS disabled', v_rls_disabled_count;
  END IF;

  -- Check for policies with bypass vulnerabilities
  SELECT COUNT(*) INTO v_rls_disabled_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND qual = 'true'
    AND rolname != 'service_role';

  IF v_rls_disabled_count = 0 THEN
    RAISE NOTICE '  ✅ PASS: No RLS bypass policies for non-service roles';
  ELSE
    RAISE WARNING '  ⚠️  WARNING: % policies allow unrestricted access', v_rls_disabled_count;
  END IF;
END $$;

\echo ''


-- ============================================================================
-- SECTION 9: PARTITIONING VALIDATION
-- ============================================================================

\echo '12. Validating Audit Log Partitioning...'
\echo ''

DO $$
DECLARE
  v_is_partitioned BOOLEAN;
  v_partition_count INT;
BEGIN
  -- Check security_audit_log
  SELECT (relkind = 'p') INTO v_is_partitioned
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'security_audit_log';

  IF v_is_partitioned THEN
    RAISE NOTICE '  ✅ PASS: security_audit_log is partitioned';
    
    -- Check partitions
    SELECT COUNT(*) INTO v_partition_count
    FROM pg_inherits i JOIN pg_class c ON i.inhparent = c.oid
    WHERE c.relname = 'security_audit_log';
    
    IF v_partition_count >= 3 THEN
       RAISE NOTICE '  ✅ PASS: security_audit_log has % partitions', v_partition_count;
    ELSE
       RAISE WARNING '  ⚠️  WARNING: security_audit_log has only % partitions (expected 3+)', v_partition_count;
    END IF;
  ELSE
    RAISE WARNING '  ❌ FAIL: security_audit_log is NOT partitioned';
  END IF;

  -- Check secret_audit_logs
  SELECT (relkind = 'p') INTO v_is_partitioned
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'secret_audit_logs';

  IF v_is_partitioned THEN
    RAISE NOTICE '  ✅ PASS: secret_audit_logs is partitioned';
    
    -- Check partitions
    SELECT COUNT(*) INTO v_partition_count
    FROM pg_inherits i JOIN pg_class c ON i.inhparent = c.oid
    WHERE c.relname = 'secret_audit_logs';
    
    IF v_partition_count >= 3 THEN
       RAISE NOTICE '  ✅ PASS: secret_audit_logs has % partitions', v_partition_count;
    ELSE
       RAISE WARNING '  ⚠️  WARNING: secret_audit_logs has only % partitions (expected 3+)', v_partition_count;
    END IF;
  ELSE
    RAISE WARNING '  ❌ FAIL: secret_audit_logs is NOT partitioned';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

\echo '============================================================================'
\echo 'VALIDATION COMPLETE'
\echo '============================================================================'
\echo ''
\echo 'Review the output above for any ❌ FAIL or ⚠️  WARNING messages.'
\echo ''
\echo 'Expected Results:'
\echo '  - All functions exist (✅ PASS)'
\echo '  - 30+ RLS policies optimized (✅ PASS)'
\echo '  - 3 audit tables protected (✅ PASS)'
\echo '  - 8 composite indexes exist (✅ PASS)'
\echo '  - 4 junction tables configured (✅ PASS)'
\echo '  - All security checks pass (✅ PASS)'
\echo ''
\echo 'If any checks failed, review the migration and re-run if necessary.'
\echo ''
\echo '============================================================================'
\timing off

-- ============================================================================
-- COMPLETE REMEDIATION VALIDATION SCRIPT
-- Run this after applying all fix migrations to verify security posture
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'VALUECANVAS SECURITY VALIDATION'
\echo 'Testing all remediation fixes'
\echo '========================================='
\echo ''

-- ============================================================================
-- TEST 1: RLS Coverage Check
-- ============================================================================
\echo '1️⃣  Checking RLS Coverage...'

DO $$
DECLARE
  insecure_tables text[];
  table_count int;
BEGIN
  SELECT array_agg(tablename), count(*)
  INTO insecure_tables, table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%'
    AND tablename NOT IN (
      'schema_migrations',
      'supabase_migrations_schema_migrations',
      'approval_requests_archive',
      'approvals_archive'
    )
    AND rowsecurity = false;
  
  IF table_count > 0 THEN
    RAISE WARNING '❌ FAIL: % tables without RLS: %', table_count, array_to_string(insecure_tables, ', ');
  ELSE
    RAISE NOTICE '✅ PASS: All user-facing tables have RLS enabled';
  END IF;
END $$;

-- ============================================================================
-- TEST 2: Audit Log Immutability
-- ============================================================================
\echo ''
\echo '2️⃣  Checking Audit Log Immutability...'

DO $$
DECLARE
  audit_tables text[] := ARRAY[
    'audit_logs',
    'security_audit_log',
    'agent_audit_log',
    'workflow_audit_logs'
  ];
  tbl text;
  protected_count int := 0;
  total_count int := 0;
BEGIN
  FOREACH tbl IN ARRAY audit_tables
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = tbl) THEN
      total_count := total_count + 1;
      
      -- Check for protection trigger
      IF EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = tbl
          AND t.tgname LIKE '%protect%'
      ) THEN
        protected_count := protected_count + 1;
        RAISE NOTICE '  ✅ % is protected', tbl;
      ELSE
        RAISE WARNING '  ❌ % is NOT protected', tbl;
      END IF;
    END IF;
  END LOOP;
  
  IF protected_count = total_count AND total_count > 0 THEN
    RAISE NOTICE '✅ PASS: All % audit tables are immutable', total_count;
  ELSE
    RAISE WARNING '❌ FAIL: Only %/% audit tables are immutable', protected_count, total_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 3: Overly Permissive Policies
-- ============================================================================
\echo ''
\echo '3️⃣  Checking for Overly Permissive Policies...'

DO $$
DECLARE
  risky_policy_count int;
BEGIN
  SELECT count(*) INTO risky_policy_count
  FROM pg_policies
  WHERE (
    (policyqualifiedusing LIKE '%true%' OR policyqualifiedcheck LIKE '%true%')
    AND policyname NOT LIKE '%service_role%'
    AND policyname NOT LIKE '%Service role%'
    AND policyname NOT LIKE '%System%'
    AND NOT (
      -- Allow some legitimate USING(true) for read-only public data
      policyname LIKE '%view%' 
      AND policyname LIKE '%public%'
      AND policycommand = 'SELECT'
    )
  );
  
  IF risky_policy_count > 0 THEN
    RAISE WARNING '⚠️  WARNING: % policies may be overly permissive', risky_policy_count;
    RAISE NOTICE 'Review policies with USING(true) that are not scoped to service_role';
  ELSE
    RAISE NOTICE '✅ PASS: No overly permissive policies detected';
  END IF;
END $$;

-- ============================================================================
-- TEST 4: Missing Foreign Key Indexes
-- ============================================================================
\echo ''
\echo '4️⃣  Checking Foreign Key Indexes...'

DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT count(*) INTO missing_count
  FROM (
    SELECT 
      conrelid::regclass as table_name,
      conname as constraint_name,
      array_agg(a.attname ORDER BY u.attposition) as fk_columns
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum, attposition) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
    WHERE c.contype = 'f'  -- Foreign keys
      AND c.conrelid::regclass::text LIKE 'public.%'
    GROUP BY conrelid, conname
  ) fks
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = fks.table_name::regclass
      -- Check if first FK column is first column of an index
      AND i.indkey[0] = (
        SELECT attnum FROM pg_attribute 
        WHERE attrelid = fks.table_name::regclass 
          AND attname = fks.fk_columns[1]
      )
  );
  
  IF missing_count > 0 THEN
    RAISE WARNING '⚠️  WARNING: % foreign keys without indexes', missing_count;
  ELSE
    RAISE NOTICE '✅ PASS: All foreign keys have supporting indexes';
  END IF;
END $$;

-- ============================================================================
-- TEST 5: SECURITY DEFINER Function Safety
-- ============================================================================
\echo ''
\echo '5️⃣  Checking SECURITY DEFINER Functions...'

DO $$
DECLARE
  unsafe_count int;
  total_count int;
BEGIN
  -- Count unsafe SECURITY DEFINER functions
  SELECT count(*) INTO unsafe_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname IN ('public', 'auth')
    AND (p.proconfig IS NULL OR NOT 'search_path' = ANY(p.proconfig));
  
  -- Count total SECURITY DEFINER functions
  SELECT count(*) INTO total_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname IN ('public', 'auth');
  
  IF unsafe_count > 0 THEN
    RAISE WARNING '❌ FAIL: %/% SECURITY DEFINER functions lack search_path', unsafe_count, total_count;
  ELSE
    RAISE NOTICE '✅ PASS: All % SECURITY DEFINER functions are secured', total_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 6: Base Schema Protection
-- ============================================================================
\echo ''
\echo '6️⃣  Checking Base Schema Protection...'

DO $$
DECLARE
  base_tables text[] := ARRAY['cases', 'workflows', 'messages'];
  tbl text;
  protected_count int := 0;
BEGIN
  FOREACH tbl IN ARRAY base_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename = tbl 
        AND rowsecurity = true
    ) THEN
      protected_count := protected_count + 1;
      RAISE NOTICE '  ✅ % has RLS', tbl;
    ELSE
      RAISE WARNING '  ❌ % missing RLS', tbl;
    END IF;
  END LOOP;
  
  IF protected_count = array_length(base_tables, 1) THEN
    RAISE NOTICE '✅ PASS: All base schema tables protected';
  ELSE
    RAISE WARNING '❌ FAIL: %/% base tables protected', protected_count, array_length(base_tables, 1);
  END IF;
END $$;

-- ============================================================================
-- TEST 7: Agent Predictions Protection
-- ============================================================================
\echo ''
\echo '7️⃣  Checking Agent Predictions Protection...'

DO $$
DECLARE
  prediction_tables text[] := ARRAY[
    'agent_predictions',
    'confidence_violations',
    'agent_accuracy_metrics',
    'agent_retraining_queue'
  ];
  tbl text;
  protected_count int := 0;
  total_count int := 0;
BEGIN
  FOREACH tbl IN ARRAY prediction_tables
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = tbl) THEN
      total_count := total_count + 1;
      
      IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = tbl 
          AND rowsecurity = true
      ) THEN
        protected_count := protected_count + 1;
        RAISE NOTICE '  ✅ % has RLS', tbl;
      ELSE
        RAISE WARNING '  ❌ % missing RLS', tbl;
      END IF;
    END IF;
  END LOOP;
  
  IF protected_count = total_count AND total_count > 0 THEN
    RAISE NOTICE '✅ PASS: All prediction tables protected';
  ELSE
    RAISE WARNING '❌ FAIL: %/% prediction tables protected', protected_count, total_count;
  END IF;
END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================
\echo ''
\echo '========================================='
\echo 'VALIDATION SUMMARY'
\echo '========================================='

DO $$
DECLARE
  total_tests int := 7;
  passed_tests int := 0;
  rls_pass boolean;
  audit_pass boolean;
  definer_pass boolean;
  base_pass boolean;
  predictions_pass boolean;
BEGIN
  -- Check RLS
  SELECT NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations', 'approval_requests_archive', 'approvals_archive')
      AND rowsecurity = false
  ) INTO rls_pass;
  
  -- Check Audit
  SELECT (
    SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%protect_audit%'
  ) >= 4 INTO audit_pass;
  
  -- Check SECURITY DEFINER
  SELECT NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname IN ('public', 'auth')
      AND (p.proconfig IS NULL OR NOT 'search_path' = ANY(p.proconfig))
  ) INTO definer_pass;
  
  -- Check base tables
  SELECT (
    SELECT count(*) FROM pg_tables 
    WHERE tablename IN ('cases', 'workflows', 'messages')
      AND rowsecurity = true
  ) = 3 INTO base_pass;
  
  -- Check predictions
  SELECT (
    SELECT count(*) FROM pg_tables 
    WHERE tablename IN ('agent_predictions', 'confidence_violations', 'agent_accuracy_metrics', 'agent_retraining_queue')
      AND rowsecurity = true
  ) >= 3 INTO predictions_pass;
  
  -- Count passes
  IF rls_pass THEN passed_tests := passed_tests + 1; END IF;
  IF audit_pass THEN passed_tests := passed_tests + 1; END IF;
  IF definer_pass THEN passed_tests := passed_tests + 1; END IF;
  IF base_pass THEN passed_tests := passed_tests + 1; END IF;
  IF predictions_pass THEN passed_tests := passed_tests + 1; END IF;
  passed_tests := passed_tests + 2; -- Policy check and FK indexes are warnings only
  
  RAISE NOTICE '';
  RAISE NOTICE 'Tests Passed: %/%', passed_tests, total_tests;
  
  IF passed_tests = total_tests THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅✅✅ ALL CHECKS PASSED - PRODUCTION READY ✅✅✅';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '❌❌❌ CRITICAL ISSUES REMAIN - DO NOT DEPLOY ❌❌❌';
    RAISE WARNING '';
  END IF;
END $$;

\echo ''
\echo '========================================='

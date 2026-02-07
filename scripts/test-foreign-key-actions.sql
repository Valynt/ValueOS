-- Test Foreign Key Actions
-- Purpose: Verify all FKs have appropriate ON DELETE actions
-- Usage: psql $DATABASE_URL -f scripts/test-foreign-key-actions.sql

\echo '============================================================'
\echo 'Testing Foreign Key Actions'
\echo '============================================================'
\echo ''

-- ============================================================================
-- 1. Check all foreign keys and their delete actions
-- ============================================================================

\echo '1. Checking all foreign key delete actions...'
SELECT * FROM foreign_key_actions_audit
ORDER BY 
  CASE status
    WHEN '❌ NO ACTION' THEN 0
    WHEN '⚠️ NO ACTION' THEN 1
    ELSE 2
  END,
  table_name;

\echo ''

-- ============================================================================
-- 2. Count FKs by delete action
-- ============================================================================

\echo '2. Counting FKs by delete action...'
SELECT 
  delete_rule,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM information_schema.referential_constraints
WHERE constraint_schema = 'public'
GROUP BY delete_rule
ORDER BY count DESC;

\echo ''

-- ============================================================================
-- 3. Check for FKs without explicit actions
-- ============================================================================

\echo '3. Checking for FKs without explicit actions...'
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND rc.delete_rule = 'NO ACTION'
ORDER BY tc.table_name;

\echo ''

-- ============================================================================
-- 4. Test CASCADE behavior
-- ============================================================================

\echo '4. Checking CASCADE foreign keys...'
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  '✅ Will delete dependent records' as behavior
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND rc.delete_rule = 'CASCADE'
ORDER BY tc.table_name;

\echo ''

-- ============================================================================
-- 5. Test SET NULL behavior
-- ============================================================================

\echo '5. Checking SET NULL foreign keys...'
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  c.is_nullable,
  CASE 
    WHEN c.is_nullable = 'YES' THEN '✅ Column is nullable'
    ELSE '❌ Column NOT nullable - SET NULL will fail!'
  END as validation
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
JOIN information_schema.columns AS c
  ON c.table_name = tc.table_name
  AND c.column_name = kcu.column_name
  AND c.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND rc.delete_rule = 'SET NULL'
ORDER BY tc.table_name;

\echo ''

-- ============================================================================
-- 6. Check tenant-related FKs
-- ============================================================================

\echo '6. Checking tenant-related foreign keys...'
SELECT 
  tc.table_name,
  kcu.column_name,
  rc.delete_rule,
  CASE 
    WHEN rc.delete_rule = 'CASCADE' THEN '✅ Tenant data will be cleaned up'
    WHEN rc.delete_rule = 'SET NULL' THEN '⚠️ Records preserved, reference nulled'
    WHEN rc.delete_rule = 'RESTRICT' THEN '⚠️ Tenant deletion blocked'
    ELSE '❌ No action defined'
  END as tenant_deletion_behavior
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'tenants'
ORDER BY tc.table_name;

\echo ''

-- ============================================================================
-- 7. Check user-related FKs
-- ============================================================================

\echo '7. Checking user-related foreign keys...'
SELECT 
  tc.table_name,
  kcu.column_name,
  rc.delete_rule,
  CASE 
    WHEN rc.delete_rule = 'CASCADE' THEN '✅ User data will be cleaned up'
    WHEN rc.delete_rule = 'SET NULL' THEN '✅ Audit trail preserved'
    WHEN rc.delete_rule = 'RESTRICT' THEN '⚠️ User deletion blocked'
    ELSE '❌ No action defined'
  END as user_deletion_behavior
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'users'
ORDER BY tc.table_name;

\echo ''

-- ============================================================================
-- 8. Check agent-related FKs
-- ============================================================================

\echo '8. Checking agent-related foreign keys...'
SELECT 
  tc.table_name,
  kcu.column_name,
  rc.delete_rule,
  CASE 
    WHEN rc.delete_rule = 'CASCADE' THEN '✅ Agent data will be cleaned up'
    WHEN rc.delete_rule = 'SET NULL' THEN '✅ Audit trail preserved'
    WHEN rc.delete_rule = 'RESTRICT' THEN '⚠️ Agent deletion blocked'
    ELSE '❌ No action defined'
  END as agent_deletion_behavior
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'agents'
ORDER BY tc.table_name;

\echo ''

-- ============================================================================
-- 9. Use test function
-- ============================================================================

\echo '9. Testing FK cascade behavior...'
SELECT * FROM test_foreign_key_cascade()
WHERE test_result LIKE '❌%' OR test_result LIKE '⚠️%'
ORDER BY table_name;

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
  v_total_fks INTEGER;
  v_cascade INTEGER;
  v_set_null INTEGER;
  v_restrict INTEGER;
  v_no_action INTEGER;
  v_nullable_issues INTEGER;
BEGIN
  -- Count total FKs
  SELECT COUNT(*) INTO v_total_fks
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public';
  
  -- Count by action
  SELECT COUNT(*) INTO v_cascade
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule = 'CASCADE';
  
  SELECT COUNT(*) INTO v_set_null
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule = 'SET NULL';
  
  SELECT COUNT(*) INTO v_restrict
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule = 'RESTRICT';
  
  SELECT COUNT(*) INTO v_no_action
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule = 'NO ACTION';
  
  -- Check for nullable issues
  SELECT COUNT(*) INTO v_nullable_issues
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
  JOIN information_schema.columns AS c
    ON c.table_name = tc.table_name
    AND c.column_name = kcu.column_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND rc.delete_rule = 'SET NULL'
    AND c.is_nullable = 'NO';
  
  RAISE NOTICE 'Total foreign keys: %', v_total_fks;
  RAISE NOTICE '';
  RAISE NOTICE 'Delete actions:';
  RAISE NOTICE '  CASCADE: % (%.1f%%)', v_cascade, 
    100.0 * v_cascade / NULLIF(v_total_fks, 0);
  RAISE NOTICE '  SET NULL: % (%.1f%%)', v_set_null, 
    100.0 * v_set_null / NULLIF(v_total_fks, 0);
  RAISE NOTICE '  RESTRICT: % (%.1f%%)', v_restrict, 
    100.0 * v_restrict / NULLIF(v_total_fks, 0);
  RAISE NOTICE '  NO ACTION: % (%.1f%%)', v_no_action, 
    100.0 * v_no_action / NULLIF(v_total_fks, 0);
  RAISE NOTICE '';
  
  IF v_no_action = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All FKs have explicit delete actions';
  ELSE
    RAISE WARNING '❌ FAILURE: % FKs still have NO ACTION', v_no_action;
  END IF;
  
  IF v_nullable_issues = 0 THEN
    RAISE NOTICE '✅ All SET NULL FKs reference nullable columns';
  ELSE
    RAISE WARNING '❌ FAILURE: % SET NULL FKs reference non-nullable columns', 
      v_nullable_issues;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Expected after migration:';
  RAISE NOTICE '  CASCADE: ~10 (dependent data)';
  RAISE NOTICE '  SET NULL: ~9 (audit references)';
  RAISE NOTICE '  NO ACTION: 0';
END $$;

\echo ''
\echo '============================================================'

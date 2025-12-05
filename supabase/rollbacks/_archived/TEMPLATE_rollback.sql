-- ============================================================================
-- Rollback: [Original Migration Description]
-- ============================================================================
-- Date: YYYY-MM-DD
-- Rollback for: ../migrations/YYYYMMDD_HHMMSS_migration_name.sql
-- Author: [Your Name]
--
-- ## Rollback Strategy
-- [Description of what this rollback does]
--
-- ## Data Impact
-- [Describe any data that will be lost/restored]
--
-- ## Steps to Execute
-- 1. Verify backup exists
-- 2. Notify team
-- 3. Run this script
-- 4. Verify application still works
-- 5. Monitor for issues
--
-- ## Restoration Notes
-- [Any manual steps needed after rollback]
-- ============================================================================

-- Pre-rollback verification
DO $$
BEGIN
  RAISE NOTICE 'Starting rollback at %', NOW();
  RAISE NOTICE 'Current user: %', current_user;
  RAISE NOTICE 'Current database: %', current_database();
  
  -- Confirm with user (manual step)
  RAISE WARNING '⚠️  This will rollback the migration. Ensure backup exists!';
  -- Uncomment to require manual confirmation
  -- RAISE EXCEPTION 'Rollback cancelled. Remove this line to proceed.';
END $$;

-- ============================================================================
-- Rollback Steps (Reverse order of migration)
-- ============================================================================

BEGIN;

-- Step 3: Drop policies (if created)
DROP POLICY IF EXISTS "users_own_data" ON new_table;
DROP POLICY IF EXISTS "service_role_bypass" ON new_table;

-- Step 2: Drop indexes (if created)
DROP INDEX IF EXISTS idx_new_table_user_id;

-- Step 1: Drop table (if created)
DROP TABLE IF EXISTS new_table;

-- Alternative: If need to restore data
-- CREATE TABLE new_table_backup AS SELECT * FROM new_table;
-- DROP TABLE new_table;
-- -- Later restore: INSERT INTO new_table SELECT * FROM new_table_backup;

COMMIT;

-- ============================================================================
-- Post-Rollback Verification
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  -- Verify table is gone
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE tablename = 'new_table'
  ) INTO table_exists;
  
  IF table_exists THEN
    RAISE EXCEPTION '❌ Rollback failed: table still exists';
  END IF;
  
  RAISE NOTICE '✅ Rollback successful!';
  RAISE NOTICE '   Table removed: new_table';
  RAISE NOTICE '   Completed at: %', NOW();
  
  RAISE WARNING 'Remember to:';
  RAISE WARNING '  1. Verify application still works';
  RAISE WARNING '  2. Check for errors in logs';
  RAISE WARNING '  3. Monitor for 30 minutes';
END $$;

-- ============================================================================
-- Manual Verification (uncomment to run)
-- ============================================================================

-- Check table doesn't exist
-- SELECT * FROM pg_tables WHERE tablename = 'new_table';
-- Should return 0 rows

-- Check policies are gone
-- SELECT * FROM pg_policies WHERE tablename = 'new_table';
-- Should return 0 rows

-- Check indexes are gone
-- SELECT * FROM pg_indexes WHERE tablename = 'new_table';
-- Should return 0 rows

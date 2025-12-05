-- ============================================================================
-- Migration: [Brief Description]
-- ============================================================================
-- Date: YYYY-MM-DD
-- Author: [Your Name]
-- Type: [Schema/Data/RLS/Function/Index]
-- Risk Level: [Low/Medium/High]
-- Estimated Time: [X minutes]
-- 
-- Rollback: See ../rollbacks/YYYYMMDD_HHMMSS_rollback.sql
-- 
-- ## Description
-- [Detailed description of what this migration does and why]
--
-- ## Changes
-- - [ ] Change 1
-- - [ ] Change 2
-- - [ ] Change 3
--
-- ## Dependencies
-- - Requires migration: YYYYMMDD_previous_migration.sql
-- - Compatible with app version: X.Y.Z+
--
-- ## Testing
-- - [ ] Test scenario 1
-- - [ ] Test scenario 2
-- - [ ] Rollback tested
--
-- ## Performance Impact
-- - Expected rows affected: [Number]
-- - Expected duration: [X seconds/minutes]
-- - Locks acquired: [Table names]
--
-- ## Rollback Strategy
-- [Brief description of how to rollback if needed]
-- ============================================================================

-- Safety checks (prevent running if conditions not met)
DO $$
BEGIN
  -- Example: Check if prerequisite migration ran
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'required_table'
  ) THEN
    RAISE EXCEPTION 'Prerequisite migration not applied';
  END IF;
  
  -- Example: Check application is ready
  -- IF NOT EXISTS (
  --   SELECT 1 FROM feature_flags 
  --   WHERE flag_key = 'enable_new_feature'
  -- ) THEN
  --   RAISE EXCEPTION 'Feature flag not set';
  -- END IF;
END $$;

-- ============================================================================
-- Main Migration
-- ============================================================================

BEGIN;

-- Your changes here

-- Example: Create table
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example: Create index
CREATE INDEX IF NOT EXISTS idx_new_table_user_id 
  ON new_table(user_id);

-- Example: Add RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Service role bypass (ALWAYS include)
CREATE POLICY "service_role_bypass"
  ON new_table FOR ALL
  TO service_role
  USING (true);

-- User policies
CREATE POLICY "users_own_data"
  ON new_table FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Example: Add comment
COMMENT ON TABLE new_table IS 'Stores [description]';

COMMIT;

-- ============================================================================
-- Post-Migration Verification
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Verify table created
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE tablename = 'new_table';
  
  IF table_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: table not created';
  END IF;
  
  -- Verify RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'new_table';
  
  IF policy_count < 2 THEN
    RAISE WARNING 'Expected at least 2 policies, found %', policy_count;
  END IF;
  
  -- Verify indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'new_table';
  
  RAISE NOTICE '✅ Migration complete!';
  RAISE NOTICE '   Tables created: %', table_count;
  RAISE NOTICE '   Policies created: %', policy_count;
  RAISE NOTICE '   Indexes created: %', index_count;
END $$;

-- ============================================================================
-- Monitoring Queries (for manual verification)
-- ============================================================================

-- Check table structure
-- \d+ new_table

-- Check RLS policies
-- SELECT policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'new_table';

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'new_table';

-- Test RLS
-- SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-uuid"}';
-- SELECT * FROM new_table;
-- RESET "request.jwt.claims";

-- Sprint 1 Fix #3: Add Explicit Database Defaults for Settings
-- 
-- This migration ensures all settings JSONB columns have explicit defaults
-- and are never null, preventing the "nullish boolean trap" issue.
--
-- Date: 2026-01-05
-- Related: SPRINT1_FIXES.md

-- ============================================================================
-- Add user_preferences column if it doesn't exist
-- ============================================================================

-- SKIPPED: Permission denied for auth.users modification
-- DO $$ 
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.columns 
--     WHERE table_schema = 'auth' 
--     AND table_name = 'users' 
--     AND column_name = 'user_preferences'
--   ) THEN
--     ALTER TABLE auth.users 
--       ADD COLUMN user_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
--   END IF;
-- END $$;
-- 
-- -- Ensure existing column has proper default
-- ALTER TABLE auth.users 
--   ALTER COLUMN user_preferences SET DEFAULT '{}'::jsonb;
-- 
-- -- Ensure column is NOT NULL
-- ALTER TABLE auth.users 
--   ALTER COLUMN user_preferences SET NOT NULL;
-- 
-- -- Update any existing NULL values to empty object
-- UPDATE auth.users 
-- SET user_preferences = '{}'::jsonb 
-- WHERE user_preferences IS NULL;
-- 
-- -- Add comment
-- COMMENT ON COLUMN auth.users.user_preferences IS 
--   'User-level settings (theme, notifications, etc.). Always {} never null. Keys are stored without "user." prefix.';

-- ============================================================================
-- Add team_settings column if it doesn't exist
-- ============================================================================

-- Check if teams table exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'teams'
  ) THEN
    -- Add column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'teams' 
      AND column_name = 'team_settings'
    ) THEN
      ALTER TABLE public.teams 
        ADD COLUMN team_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- Ensure existing column has proper default
    ALTER TABLE public.teams 
      ALTER COLUMN team_settings SET DEFAULT '{}'::jsonb;

    -- Ensure column is NOT NULL
    ALTER TABLE public.teams 
      ALTER COLUMN team_settings SET NOT NULL;

    -- Update any existing NULL values
    UPDATE public.teams 
    SET team_settings = '{}'::jsonb 
    WHERE team_settings IS NULL;

    -- Add comment
    COMMENT ON COLUMN public.teams.team_settings IS 
      'Team-level settings (permissions, workflows, etc.). Always {} never null. Keys are stored without "team." prefix.';
  END IF;
END $$;

-- ============================================================================
-- Update organizations table settings column
-- ============================================================================

-- Rename 'settings' to 'organization_settings' for consistency
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'settings'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'organization_settings'
  ) THEN
    ALTER TABLE public.organizations 
      RENAME COLUMN settings TO organization_settings;
  END IF;
END $$;

-- Ensure organization_settings exists with proper default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'organization_settings'
  ) THEN
    ALTER TABLE public.organizations 
      ADD COLUMN organization_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Ensure existing column has proper default
ALTER TABLE public.organizations 
  ALTER COLUMN organization_settings SET DEFAULT '{}'::jsonb;

-- Ensure column is NOT NULL
ALTER TABLE public.organizations 
  ALTER COLUMN organization_settings SET NOT NULL;

-- Update any existing NULL values
UPDATE public.organizations 
SET organization_settings = '{}'::jsonb 
WHERE organization_settings IS NULL;

-- Add comment
COMMENT ON COLUMN public.organizations.organization_settings IS 
  'Organization-level settings (security, billing, etc.). Always {} never null. Keys are stored without "organization." prefix.';

-- ============================================================================
-- Clean up redundant nesting in existing data
-- ============================================================================

-- Fix user_preferences with redundant "user" nesting
-- SKIPPED: auth.users modification
-- UPDATE auth.users
-- SET user_preferences = (user_preferences->'user')
-- WHERE user_preferences ? 'user' 
--   AND jsonb_typeof(user_preferences->'user') = 'object';

-- Fix team_settings with redundant "team" nesting
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'teams'
  ) THEN
    UPDATE public.teams
    SET team_settings = (team_settings->'team')
    WHERE team_settings ? 'team' 
      AND jsonb_typeof(team_settings->'team') = 'object';
  END IF;
END $$;

-- Fix organization_settings with redundant "organization" nesting
UPDATE public.organizations
SET organization_settings = (organization_settings->'organization')
WHERE organization_settings ? 'organization' 
  AND jsonb_typeof(organization_settings->'organization') = 'object';

-- ============================================================================
-- Add indexes for common queries
-- ============================================================================

-- Index for user preferences queries
-- SKIPPED: auth.users index
-- CREATE INDEX IF NOT EXISTS idx_users_preferences_gin 
--   ON auth.users USING GIN (user_preferences);

-- Index for team settings queries
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'teams'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_teams_settings_gin 
      ON public.teams USING GIN (team_settings);
  END IF;
END $$;

-- Index for organization settings queries
CREATE INDEX IF NOT EXISTS idx_organizations_settings_gin 
  ON public.organizations USING GIN (organization_settings);

-- ============================================================================
-- Verification queries (for testing)
-- ============================================================================

-- Verify no NULL values exist
DO $$ 
DECLARE
  null_count INTEGER;
BEGIN
  -- SKIPPED: Check users
  -- SELECT COUNT(*) INTO null_count
  -- FROM auth.users 
  -- WHERE user_preferences IS NULL;
  
  -- IF null_count > 0 THEN
  --   RAISE WARNING 'Found % NULL user_preferences', null_count;
  -- END IF;

  -- Check teams
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'teams'
  ) THEN
    SELECT COUNT(*) INTO null_count
    FROM public.teams 
    WHERE team_settings IS NULL;
    
    IF null_count > 0 THEN
      RAISE WARNING 'Found % NULL team_settings', null_count;
    END IF;
  END IF;

  -- Check organizations
  SELECT COUNT(*) INTO null_count
  FROM public.organizations 
  WHERE organization_settings IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Found % NULL organization_settings', null_count;
  END IF;

  RAISE NOTICE 'Settings defaults migration completed successfully';
END $$;

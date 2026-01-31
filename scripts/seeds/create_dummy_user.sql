-- Inserts a dummy user/profile for local development
-- WARNING: Run ONLY in development or test environments
--
-- SECURITY: This script includes environment checks to prevent
-- accidental execution in production.

-- ============================================================================
-- Environment Check
-- ============================================================================

DO $$
DECLARE
  v_env TEXT;
BEGIN
  -- Check if we're in a safe environment
  -- This assumes you set app.environment in your database config
  BEGIN
    v_env := current_setting('app.environment', true);
  EXCEPTION WHEN OTHERS THEN
    v_env := 'unknown';
  END;

  IF v_env = 'production' THEN
    RAISE EXCEPTION 'SECURITY: Cannot run seed script in production environment!';
  END IF;

  RAISE NOTICE 'Running seed script in % environment', COALESCE(v_env, 'development');
END $$;

-- ============================================================================
-- Create Dummy User
-- ============================================================================

BEGIN;

-- Use a random UUID instead of predictable one
INSERT INTO users (id, email, created_at, updated_at)
VALUES (
  gen_random_uuid(),  -- Random UUID instead of hardcoded
  'dev+dummy@localhost',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET updated_at = NOW()
RETURNING id;

-- Optional profiles table
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the user ID we just created
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'dev+dummy@localhost';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    INSERT INTO profiles (id, user_id, full_name, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      v_user_id,
      'Local Dev Dummy',
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END$$;

COMMIT;

-- ============================================================================
-- Log Success
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Dummy user created successfully';
  RAISE NOTICE '   Email: dev+dummy@localhost';
  RAISE NOTICE '   Note: Use Supabase Auth to set password';
END $$;

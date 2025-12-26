-- Inserts a dummy user/profile for local development
-- WARNING: Run ONLY in development or test environments

-- Adjust columns to match your schema; this script assumes a 'users' table
-- and a 'profiles' table pattern common in Supabase setups.

BEGIN;

INSERT INTO users (id, email, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev+dummy@localhost',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW();

-- Optional profiles table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    INSERT INTO profiles (id, user_id, full_name, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000001',
      'Local Dev Dummy',
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END$$;

COMMIT;

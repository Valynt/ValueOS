-- Minimal, idempotent auth schema for tests
-- This migration creates a safe stub of the Supabase `auth` schema
-- to satisfy RLS, function, and FK references in migrations/tests.

-- Ensure pgcrypto extension for gen_random_uuid (Postgres):
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create auth schema only if it doesn't exist (production remains unchanged)
CREATE SCHEMA IF NOT EXISTS auth;

-- Minimal auth.users table with the columns commonly referenced
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal auth.uid() stub function (Supabase provides a real implementation)
-- For tests, return a stable UUID value helpful for ownership checks
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
  RETURN '00000000-0000-0000-0000-000000000001'::UUID;
END;
$$ LANGUAGE plpgsql;

-- Minimal auth.role() stub for role checks
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
BEGIN
  RETURN 'authenticated'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Minimal auth.jwt() stub function returning JSON with role and organization_id
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object('role', 'service_role', 'organization_id', 'org-0001');
END;
$$ LANGUAGE plpgsql;

-- Insert a seeded test user (id matches auth.uid())
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com')
ON CONFLICT (id) DO NOTHING;
-- End of auth test scaffold
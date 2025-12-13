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

-- Insert a seeded test user (id matches auth.uid())
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com')
ON CONFLICT (id) DO NOTHING;
-- Minimal auth schema for test environments (vanilla Postgres via Testcontainers)
-- This creates stubs for Supabase auth objects referenced in migrations/tests.
-- Idempotent: safe to run in production where auth schema already exists.

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.users table stub (minimal columns for testing)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create auth.uid() function stub (returns a test UUID in non-Supabase environments)
-- In production Supabase, this is a built-in function; here it's a safe override.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    -- Return a fixed test UUID for consistency in tests
    RETURN '550e8400-e29b-41d4-a716-446655440000'::UUID;
END;
$$ LANGUAGE plpgsql;

-- Optional: Insert a test user for seeding if needed
INSERT INTO auth.users (id, email) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'test@example.com')
ON CONFLICT (id) DO NOTHING;
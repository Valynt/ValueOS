-- Test Database Initialization Script
-- Sets up basic schema for integration tests

-- Create test extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create auth schema (required for RLS policies)
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.users table (mock for tests)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock auth functions for tests
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN '00000000-0000-0000-0000-000000000001'::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
BEGIN
    RETURN 'authenticated'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_build_object(
        'role', 'authenticated',
        'organization_id', 'org-0001',
        'user_id', '00000000-0000-0000-0000-000000000001'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create basic roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
END $$;

-- Create test schema for integration tests
CREATE SCHEMA IF NOT EXISTS test;

-- Grant permissions
GRANT ALL ON SCHEMA test TO public;
GRANT ALL ON SCHEMA auth TO public;

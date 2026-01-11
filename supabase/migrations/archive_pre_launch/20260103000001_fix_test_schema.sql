-- Fix test schema to match production schema
-- This migration ensures the test database has all required columns

-- Add missing columns to organizations table if they don't exist
DO $$ 
BEGIN
  -- Add slug column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='organizations' AND column_name='slug') THEN
    ALTER TABLE organizations ADD COLUMN slug TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add metadata column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='organizations' AND column_name='metadata') THEN
    ALTER TABLE organizations ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add plan_tier column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='organizations' AND column_name='plan_tier') THEN
    ALTER TABLE organizations ADD COLUMN plan_tier TEXT DEFAULT 'free';
  END IF;

  -- Add status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='organizations' AND column_name='status') THEN
    ALTER TABLE organizations ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Update existing test organizations to have slugs
UPDATE organizations 
SET slug = 'test-org-' || SUBSTRING(id::TEXT FROM 1 FOR 8)
WHERE slug = '' OR slug IS NULL;

-- Create tenants table as alias for organizations (for compatibility)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  plan_tier TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add tenant_id column to user_tenants if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_tenants' AND column_name='status') THEN
    ALTER TABLE user_tenants ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Create cases table for testing
DROP TABLE IF EXISTS cases CASCADE;
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id TEXT,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table for testing
DROP TABLE IF EXISTS messages CASCADE;
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id TEXT,
  content TEXT NOT NULL,
  role TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create security_audit_events table for testing
CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('ACCESS_DENIED', 'ACCESS_GRANTED')),
  resource TEXT NOT NULL,
  required_permissions TEXT[] NOT NULL DEFAULT '{}',
  user_permissions TEXT[] NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='security_audit_events' AND column_name='tenant_id') THEN
    ALTER TABLE security_audit_events ADD COLUMN tenant_id TEXT;
  ELSE
    ALTER TABLE security_audit_events ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_tenant_id ON security_audit_events(tenant_id);

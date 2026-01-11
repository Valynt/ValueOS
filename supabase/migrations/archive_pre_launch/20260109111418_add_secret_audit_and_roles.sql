-- Migration: Add Secret Audit Logs and Update User Roles
-- Description: Adds secret_audit_logs table and updates user_roles for multi-tenancy support.
-- Created: 2026-01-09

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create secret_audit_logs table
CREATE TABLE IF NOT EXISTS secret_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  secret_key VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('READ', 'WRITE', 'DELETE', 'ROTATE')),
  result VARCHAR(50) NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for secret_audit_logs
ALTER TABLE secret_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for secret_audit_logs
CREATE POLICY "secret_audit_logs_insert" ON secret_audit_logs
  FOR INSERT
  WITH CHECK (true); -- Allow inserts from application

CREATE POLICY "secret_audit_logs_select" ON secret_audit_logs
  FOR SELECT
  USING (true); -- Adjust access control as needed (e.g., admin only)

-- Update user_roles table for multi-tenancy if it exists
DO $$
DECLARE
  default_tenant_id UUID := '00000000-0000-0000-0000-000000000000'; -- System/Default Tenant ID
  sql_statement TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles') THEN
    -- Add tenant_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'tenant_id') THEN
      -- Use dynamic SQL to handle variable substitution in DDL
      sql_statement := format('ALTER TABLE user_roles ADD COLUMN tenant_id UUID DEFAULT %L NOT NULL', default_tenant_id);
      EXECUTE sql_statement;
    END IF;

    -- Drop existing primary key constraint
    ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

    -- Create new composite primary key including tenant_id
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role, tenant_id);
  END IF;
END $$;

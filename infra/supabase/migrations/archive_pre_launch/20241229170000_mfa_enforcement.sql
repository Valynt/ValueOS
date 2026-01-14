/**
 * Database Migration: MFA Enforcement
 * 
 * Adds MFA support columns to users table and role-based enforcement
 * 
 * AUTH-001: MFA enforcement for privileged roles (super_admin, admin, manager)
 */

-- Add MFA columns to auth.users metadata (via user_metadata)
-- Supabase stores MFA data in user metadata, but we need to track enforcement

-- Create MFA secrets table for TOTP
CREATE TABLE IF NOT EXISTS mfa_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_mfa UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE mfa_secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own MFA secrets
DROP POLICY IF EXISTS "Users can view own MFA secrets" ON mfa_secrets;
CREATE POLICY "Users can view own MFA secrets"
  ON mfa_secrets
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own MFA secrets" ON mfa_secrets;
CREATE POLICY "Users can update own MFA secrets"
  ON mfa_secrets
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own MFA secrets" ON mfa_secrets;
CREATE POLICY "Users can insert own MFA secrets"
  ON mfa_secrets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all MFA status (for support)
DROP POLICY IF EXISTS "Admins can view all MFA secrets" ON mfa_secrets;
CREATE POLICY "Admins can view all MFA secrets"
  ON mfa_secrets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' IN ('super_admin', 'admin'))
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_mfa_secrets_user_id ON mfa_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_secrets_enabled ON mfa_secrets(enabled);

-- Function to check if MFA is required for user role
CREATE OR REPLACE FUNCTION is_mfa_required(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_role IN ('super_admin', 'admin', 'manager');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user has MFA enabled
CREATE OR REPLACE FUNCTION has_mfa_enabled(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  mfa_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO mfa_enabled
  FROM mfa_secrets
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(mfa_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mfa_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mfa_secrets_updated_at
  BEFORE UPDATE ON mfa_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_mfa_secrets_updated_at();

-- Add comment for documentation
COMMENT ON TABLE mfa_secrets IS 'AUTH-001: MFA secrets for TOTP-based two-factor authentication';
COMMENT ON COLUMN mfa_secrets.secret IS 'Base32-encoded TOTP secret key';
COMMENT ON COLUMN mfa_secrets.backup_codes IS 'One-time backup codes for account recovery';
COMMENT ON COLUMN mfa_secrets.enabled IS 'Whether MFA is active for this user';

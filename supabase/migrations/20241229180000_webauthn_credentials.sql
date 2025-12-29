/**
 * WebAuthn Credentials Database Migration
 * 
 * Stores registered security keys (YubiKey, TouchID, Windows Hello, etc.)
 * 
 * WebAuthn Support: Passwordless authentication with hardware-backed credentials
 */

-- Create webauthn_credentials table
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Credential data (WebAuthn spec)
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  
  -- Device information
  device_type TEXT NOT NULL CHECK (device_type IN ('platform', 'cross-platform')),
  -- platform: TouchID, FaceID, Windows Hello (built-in)
  -- cross-platform: YubiKey, hardware security keys
  
  aaguid TEXT, -- Authenticator AAGUID
  transports TEXT[], -- ['usb', 'nfc', 'ble', 'internal']
  
  -- User-friendly name
  name TEXT NOT NULL, -- e.g., "My YubiKey", "MacBook TouchID"
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT unique_user_credential UNIQUE(user_id, credential_id)
);

-- Enable RLS
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own credentials
CREATE POLICY "Users can view own WebAuthn credentials"
  ON webauthn_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WebAuthn credentials"
  ON webauthn_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WebAuthn credentials"
  ON webauthn_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own WebAuthn credentials"
  ON webauthn_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all credentials (for support)
CREATE POLICY "Admins can view all WebAuthn credentials"
  ON webauthn_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' IN ('super_admin', 'admin'))
    )
  );

-- Indexes for performance
CREATE INDEX idx_webauthn_user_id ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credential_id ON webauthn_credentials(credential_id);
CREATE INDEX idx_webauthn_last_used ON webauthn_credentials(last_used_at);

-- Comments for documentation
COMMENT ON TABLE webauthn_credentials IS 'WebAuthn: Passwordless authentication credentials (hardware keys, biometrics)';
COMMENT ON COLUMN webauthn_credentials.credential_id IS 'Base64-encoded credential ID from WebAuthn';
COMMENT ON COLUMN webauthn_credentials.public_key IS 'Base64-encoded public key for verification';
COMMENT ON COLUMN webauthn_credentials.counter IS 'Signature counter for replay protection';
COMMENT ON COLUMN webauthn_credentials.device_type IS 'platform (TouchID) or cross-platform (YubiKey)';

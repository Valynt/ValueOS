/**
 * Trusted Devices Database Migration
 * 
 * Stores trusted device fingerprints for MFA bypass
 * 
 * Trusted Devices: Skip MFA for known devices (30-day trust period)
 */

-- Create trusted_devices table
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Device fingerprint (hash of browser+OS+screen characteristics)
  device_fingerprint TEXT NOT NULL,
  
  -- Device information (for display)
  device_name TEXT NOT NULL, -- "Chrome on macOS"
  ip_address INET,
  user_agent TEXT,
  
  -- Trust metadata
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- 30 days from creation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_device_fingerprint UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own trusted devices
CREATE POLICY "Users can view own trusted devices"
  ON trusted_devices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trusted devices"
  ON trusted_devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trusted devices"
  ON trusted_devices
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trusted devices"
  ON trusted_devices
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all trusted devices (for security monitoring)
CREATE POLICY "Admins can view all trusted devices"
  ON trusted_devices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' IN ('super_admin', 'admin'))
    )
  );

-- Indexes
CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX idx_trusted_devices_expires ON trusted_devices(expires_at);

-- Auto-cleanup expired devices (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_trusted_devices()
RETURNS void AS $$
BEGIN
  DELETE FROM trusted_devices
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE trusted_devices IS 'Trusted Devices: Skip MFA for known devices (30-day trust period)';
COMMENT ON COLUMN trusted_devices.device_fingerprint IS 'SHA-256 hash of browser characteristics';
COMMENT ON COLUMN trusted_devices.expires_at IS 'Trust expires after 30 days';

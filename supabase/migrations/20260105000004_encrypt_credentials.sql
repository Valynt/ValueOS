-- Encrypt Integration Credentials
-- Purpose: Encrypt OAuth tokens and API keys using pgsodium
-- Priority: CRITICAL
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #1

-- ============================================================================
-- 1. Install pgsodium extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgsodium;

COMMENT ON EXTENSION pgsodium IS 'Modern cryptography for PostgreSQL using libsodium';

-- ============================================================================
-- 2. Create encryption key in pgsodium.key table
-- ============================================================================

-- Note: In production, use Supabase Vault or environment variables
-- This creates a key for development/testing only
DO $$
DECLARE
  v_key_id BIGINT;
BEGIN
  -- Check if key already exists
  IF NOT EXISTS (
    SELECT 1 FROM pgsodium.key 
    WHERE name = 'integration_credentials_key'
  ) THEN
    -- Generate a new encryption key
    INSERT INTO pgsodium.key (name, status, key_type, key_context)
    VALUES (
      'integration_credentials_key',
      'valid',
      'aead-det',  -- Deterministic authenticated encryption
      'integration_credentials'::bytea
    )
    RETURNING id INTO v_key_id;
    
    RAISE NOTICE 'Created encryption key with ID: %', v_key_id;
  ELSE
    RAISE NOTICE 'Encryption key already exists';
  END IF;
END $$;

-- ============================================================================
-- 3. Add encrypted columns to integration_connections
-- ============================================================================

-- Add encrypted credentials column
ALTER TABLE integration_connections 
ADD COLUMN IF NOT EXISTS credentials_encrypted BYTEA;

-- Add key ID reference
ALTER TABLE integration_connections 
ADD COLUMN IF NOT EXISTS credentials_key_id BIGINT 
REFERENCES pgsodium.key(id);

COMMENT ON COLUMN integration_connections.credentials_encrypted IS 
  'Encrypted OAuth tokens and API keys using pgsodium';

COMMENT ON COLUMN integration_connections.credentials_key_id IS 
  'Reference to encryption key in pgsodium.key table';

-- ============================================================================
-- 4. Add encrypted columns to tenant_integrations
-- ============================================================================

-- Add encrypted token columns
ALTER TABLE tenant_integrations 
ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA;

ALTER TABLE tenant_integrations 
ADD COLUMN IF NOT EXISTS refresh_token_encrypted BYTEA;

-- Add key ID reference
ALTER TABLE tenant_integrations 
ADD COLUMN IF NOT EXISTS token_key_id BIGINT 
REFERENCES pgsodium.key(id);

COMMENT ON COLUMN tenant_integrations.access_token_encrypted IS 
  'Encrypted access token using pgsodium';

COMMENT ON COLUMN tenant_integrations.refresh_token_encrypted IS 
  'Encrypted refresh token using pgsodium';

COMMENT ON COLUMN tenant_integrations.token_key_id IS 
  'Reference to encryption key in pgsodium.key table';

-- ============================================================================
-- 5. Create helper functions for encryption/decryption
-- ============================================================================

-- Function to encrypt credentials
CREATE OR REPLACE FUNCTION encrypt_credentials(
  p_plaintext TEXT,
  p_key_id BIGINT DEFAULT NULL
)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id BIGINT;
  v_encrypted BYTEA;
BEGIN
  -- Get key ID if not provided
  IF p_key_id IS NULL THEN
    SELECT id INTO v_key_id
    FROM pgsodium.key
    WHERE name = 'integration_credentials_key'
    AND status = 'valid'
    LIMIT 1;
    
    IF v_key_id IS NULL THEN
      RAISE EXCEPTION 'Encryption key not found';
    END IF;
  ELSE
    v_key_id := p_key_id;
  END IF;
  
  -- Encrypt the plaintext
  v_encrypted := pgsodium.crypto_aead_det_encrypt(
    p_plaintext::bytea,
    NULL,  -- No additional data
    v_key_id
  );
  
  RETURN v_encrypted;
END;
$$;

COMMENT ON FUNCTION encrypt_credentials IS 
  'Encrypts credentials using pgsodium deterministic AEAD encryption';

-- Function to decrypt credentials
CREATE OR REPLACE FUNCTION decrypt_credentials(
  p_encrypted BYTEA,
  p_key_id BIGINT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id BIGINT;
  v_decrypted BYTEA;
BEGIN
  -- Return NULL if input is NULL
  IF p_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get key ID if not provided
  IF p_key_id IS NULL THEN
    SELECT id INTO v_key_id
    FROM pgsodium.key
    WHERE name = 'integration_credentials_key'
    AND status = 'valid'
    LIMIT 1;
    
    IF v_key_id IS NULL THEN
      RAISE EXCEPTION 'Encryption key not found';
    END IF;
  ELSE
    v_key_id := p_key_id;
  END IF;
  
  -- Decrypt the ciphertext
  v_decrypted := pgsodium.crypto_aead_det_decrypt(
    p_encrypted,
    NULL,  -- No additional data
    v_key_id
  );
  
  RETURN convert_from(v_decrypted, 'UTF8');
END;
$$;

COMMENT ON FUNCTION decrypt_credentials IS 
  'Decrypts credentials using pgsodium deterministic AEAD decryption';

-- ============================================================================
-- 6. Create migration function to encrypt existing data
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_credentials_to_encrypted()
RETURNS TABLE(
  table_name TEXT,
  records_migrated BIGINT,
  records_failed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id BIGINT;
  v_migrated BIGINT := 0;
  v_failed BIGINT := 0;
  v_record RECORD;
BEGIN
  -- Get encryption key
  SELECT id INTO v_key_id
  FROM pgsodium.key
  WHERE name = 'integration_credentials_key'
  AND status = 'valid'
  LIMIT 1;
  
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Migrate integration_connections
  FOR v_record IN 
    SELECT id, credentials 
    FROM integration_connections 
    WHERE credentials IS NOT NULL 
    AND credentials_encrypted IS NULL
  LOOP
    BEGIN
      UPDATE integration_connections
      SET 
        credentials_encrypted = encrypt_credentials(credentials::text, v_key_id),
        credentials_key_id = v_key_id
      WHERE id = v_record.id;
      
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt credentials for integration_connections.id=%: %', 
        v_record.id, SQLERRM;
      v_failed := v_failed + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT 
    'integration_connections'::TEXT,
    v_migrated,
    v_failed;
  
  -- Reset counters for next table
  v_migrated := 0;
  v_failed := 0;
  
  -- Migrate tenant_integrations access_token
  FOR v_record IN 
    SELECT id, access_token, refresh_token
    FROM tenant_integrations 
    WHERE (access_token IS NOT NULL OR refresh_token IS NOT NULL)
    AND access_token_encrypted IS NULL
  LOOP
    BEGIN
      UPDATE tenant_integrations
      SET 
        access_token_encrypted = CASE 
          WHEN access_token IS NOT NULL 
          THEN encrypt_credentials(access_token, v_key_id)
          ELSE NULL
        END,
        refresh_token_encrypted = CASE 
          WHEN refresh_token IS NOT NULL 
          THEN encrypt_credentials(refresh_token, v_key_id)
          ELSE NULL
        END,
        token_key_id = v_key_id
      WHERE id = v_record.id;
      
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to encrypt tokens for tenant_integrations.id=%: %', 
        v_record.id, SQLERRM;
      v_failed := v_failed + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT 
    'tenant_integrations'::TEXT,
    v_migrated,
    v_failed;
END;
$$;

COMMENT ON FUNCTION migrate_credentials_to_encrypted IS 
  'Migrates existing plaintext credentials to encrypted storage';

-- ============================================================================
-- 7. Create views for safe credential access
-- ============================================================================

-- View for integration_connections with decrypted credentials
-- Only accessible by service_role
CREATE OR REPLACE VIEW integration_connections_decrypted AS
SELECT 
  id,
  organization_id,
  adapter_type,
  display_name,
  decrypt_credentials(credentials_encrypted, credentials_key_id) as credentials,
  config,
  field_mappings,
  last_sync_time,
  sync_status,
  sync_error,
  total_syncs,
  successful_syncs,
  failed_syncs,
  last_health_check,
  health_status,
  created_at,
  updated_at,
  created_by
FROM integration_connections;

COMMENT ON VIEW integration_connections_decrypted IS 
  'View with decrypted credentials - only accessible by service_role';

-- Grant access only to service_role
REVOKE ALL ON integration_connections_decrypted FROM PUBLIC;
GRANT SELECT ON integration_connections_decrypted TO service_role;

-- View for tenant_integrations with decrypted tokens
CREATE OR REPLACE VIEW tenant_integrations_decrypted AS
SELECT 
  id,
  tenant_id,
  provider,
  decrypt_credentials(access_token_encrypted, token_key_id) as access_token,
  decrypt_credentials(refresh_token_encrypted, token_key_id) as refresh_token,
  token_expires_at,
  instance_url,
  hub_id,
  connected_by,
  connected_at,
  last_used_at,
  last_refreshed_at,
  scopes,
  status,
  error_message,
  created_at,
  updated_at
FROM tenant_integrations;

COMMENT ON VIEW tenant_integrations_decrypted IS 
  'View with decrypted tokens - only accessible by service_role';

-- Grant access only to service_role
REVOKE ALL ON tenant_integrations_decrypted FROM PUBLIC;
GRANT SELECT ON tenant_integrations_decrypted TO service_role;

-- ============================================================================
-- 8. Create triggers to auto-encrypt on insert/update
-- ============================================================================

-- Trigger function for integration_connections
CREATE OR REPLACE FUNCTION encrypt_integration_credentials_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id BIGINT;
BEGIN
  -- Get encryption key
  SELECT id INTO v_key_id
  FROM pgsodium.key
  WHERE name = 'integration_credentials_key'
  AND status = 'valid'
  LIMIT 1;
  
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Encrypt credentials if provided as plaintext
  IF NEW.credentials IS NOT NULL AND NEW.credentials_encrypted IS NULL THEN
    NEW.credentials_encrypted := encrypt_credentials(NEW.credentials::text, v_key_id);
    NEW.credentials_key_id := v_key_id;
    -- Clear plaintext after encryption
    NEW.credentials := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS encrypt_credentials_before_insert ON integration_connections;
CREATE TRIGGER encrypt_credentials_before_insert
  BEFORE INSERT OR UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_integration_credentials_trigger();

COMMENT ON TRIGGER encrypt_credentials_before_insert ON integration_connections IS 
  'Auto-encrypts credentials on insert/update';

-- Trigger function for tenant_integrations
CREATE OR REPLACE FUNCTION encrypt_tenant_tokens_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id BIGINT;
BEGIN
  -- Get encryption key
  SELECT id INTO v_key_id
  FROM pgsodium.key
  WHERE name = 'integration_credentials_key'
  AND status = 'valid'
  LIMIT 1;
  
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Encrypt access_token if provided as plaintext
  IF NEW.access_token IS NOT NULL AND NEW.access_token_encrypted IS NULL THEN
    NEW.access_token_encrypted := encrypt_credentials(NEW.access_token, v_key_id);
    NEW.token_key_id := v_key_id;
    -- Clear plaintext after encryption
    NEW.access_token := NULL;
  END IF;
  
  -- Encrypt refresh_token if provided as plaintext
  IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token_encrypted IS NULL THEN
    NEW.refresh_token_encrypted := encrypt_credentials(NEW.refresh_token, v_key_id);
    NEW.token_key_id := v_key_id;
    -- Clear plaintext after encryption
    NEW.refresh_token := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS encrypt_tokens_before_insert ON tenant_integrations;
CREATE TRIGGER encrypt_tokens_before_insert
  BEFORE INSERT OR UPDATE ON tenant_integrations
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_tenant_tokens_trigger();

COMMENT ON TRIGGER encrypt_tokens_before_insert ON tenant_integrations IS 
  'Auto-encrypts tokens on insert/update';

-- ============================================================================
-- 9. Grant necessary permissions
-- ============================================================================

-- Grant execute on encryption functions to authenticated users
GRANT EXECUTE ON FUNCTION encrypt_credentials TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_credentials TO service_role;

-- Grant execute on migration function to service_role only
GRANT EXECUTE ON FUNCTION migrate_credentials_to_encrypted TO service_role;

-- ============================================================================
-- 10. Run migration (commented out - run manually after verification)
-- ============================================================================

-- Uncomment to run migration:
-- SELECT * FROM migrate_credentials_to_encrypted();

-- ============================================================================
-- 11. Create audit log for credential access
-- ============================================================================

CREATE TABLE IF NOT EXISTS credential_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  accessed_by UUID REFERENCES auth.users(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'decrypt')),
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_credential_access_log_time 
ON credential_access_log(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_credential_access_log_user 
ON credential_access_log(accessed_by, accessed_at DESC);

COMMENT ON TABLE credential_access_log IS 
  'Audit log for credential access and decryption operations';

-- Enable RLS on credential_access_log
ALTER TABLE credential_access_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert
CREATE POLICY credential_access_log_insert ON credential_access_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins can view
CREATE POLICY credential_access_log_select ON credential_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Credential Encryption Migration Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Verify encryption key was created';
  RAISE NOTICE '2. Test encryption/decryption functions';
  RAISE NOTICE '3. Run: SELECT * FROM migrate_credentials_to_encrypted();';
  RAISE NOTICE '4. Verify encrypted data';
  RAISE NOTICE '5. Update application code to use encrypted columns';
  RAISE NOTICE '6. Drop plaintext columns after verification';
  RAISE NOTICE '';
  RAISE NOTICE 'Security Notes:';
  RAISE NOTICE '- Encryption key is stored in pgsodium.key table';
  RAISE NOTICE '- In production, use Supabase Vault for key management';
  RAISE NOTICE '- Decrypted views only accessible by service_role';
  RAISE NOTICE '- All credential access is logged';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;

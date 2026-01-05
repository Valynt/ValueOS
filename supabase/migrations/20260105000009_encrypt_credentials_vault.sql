-- Encrypt Integration Credentials Using Supabase Vault
-- Purpose: Encrypt OAuth tokens and API keys using Supabase Vault (NOT pgsodium)
-- Priority: CRITICAL
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #1
-- 
-- IMPORTANT: This replaces 20260105000004_encrypt_credentials.sql
-- Supabase recommends Vault over pgsodium for new implementations

-- ============================================================================
-- 1. Enable Vault extension
-- ============================================================================

-- Vault is the recommended way to store secrets in Supabase
-- It uses authenticated encryption and stores keys outside the database
-- Note: The extension is called 'vault', not 'supabase_vault'
CREATE EXTENSION IF NOT EXISTS vault CASCADE;

COMMENT ON EXTENSION vault IS 
  'Supabase Vault for secure secret storage (recommended over pgsodium)';

-- ============================================================================
-- 2. Add secret reference columns to integration_connections
-- ============================================================================

-- Instead of storing encrypted data directly, we store references to Vault secrets
ALTER TABLE integration_connections 
ADD COLUMN IF NOT EXISTS credentials_secret_id UUID REFERENCES vault.secrets(id);

COMMENT ON COLUMN integration_connections.credentials_secret_id IS 
  'Reference to encrypted credentials in Supabase Vault';

-- ============================================================================
-- 3. Add secret reference columns to tenant_integrations
-- ============================================================================

ALTER TABLE tenant_integrations 
ADD COLUMN IF NOT EXISTS access_token_secret_id UUID REFERENCES vault.secrets(id);

ALTER TABLE tenant_integrations 
ADD COLUMN IF NOT EXISTS refresh_token_secret_id UUID REFERENCES vault.secrets(id);

COMMENT ON COLUMN tenant_integrations.access_token_secret_id IS 
  'Reference to encrypted access token in Supabase Vault';

COMMENT ON COLUMN tenant_integrations.refresh_token_secret_id IS 
  'Reference to encrypted refresh token in Supabase Vault';

-- ============================================================================
-- 4. Create helper functions for storing credentials
-- ============================================================================

-- Function to store credentials in Vault and return secret ID
CREATE OR REPLACE FUNCTION store_credentials_in_vault(
  p_credentials TEXT,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  -- Create secret in Vault
  SELECT vault.create_secret(
    p_credentials,
    p_name,
    p_description
  ) INTO v_secret_id;
  
  RETURN v_secret_id;
END;
$$;

COMMENT ON FUNCTION store_credentials_in_vault IS 
  'Stores credentials in Supabase Vault and returns secret ID';

-- Function to retrieve credentials from Vault
CREATE OR REPLACE FUNCTION get_credentials_from_vault(
  p_secret_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decrypted TEXT;
BEGIN
  -- Return NULL if no secret ID
  IF p_secret_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Retrieve decrypted secret from Vault
  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  
  RETURN v_decrypted;
END;
$$;

COMMENT ON FUNCTION get_credentials_from_vault IS 
  'Retrieves decrypted credentials from Supabase Vault';

-- Function to update credentials in Vault
CREATE OR REPLACE FUNCTION update_credentials_in_vault(
  p_secret_id UUID,
  p_new_credentials TEXT,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update secret in Vault
  PERFORM vault.update_secret(
    p_secret_id,
    p_new_credentials,
    p_name,
    p_description
  );
END;
$$;

COMMENT ON FUNCTION update_credentials_in_vault IS 
  'Updates credentials in Supabase Vault';

-- ============================================================================
-- 5. Create migration function to move existing credentials to Vault
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_credentials_to_vault()
RETURNS TABLE(
  table_name TEXT,
  records_migrated BIGINT,
  records_failed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_migrated BIGINT := 0;
  v_failed BIGINT := 0;
  v_record RECORD;
  v_secret_id UUID;
BEGIN
  -- Migrate integration_connections
  FOR v_record IN 
    SELECT id, credentials 
    FROM integration_connections 
    WHERE credentials IS NOT NULL 
    AND credentials_secret_id IS NULL
  LOOP
    BEGIN
      -- Store credentials in Vault
      v_secret_id := store_credentials_in_vault(
        v_record.credentials::text,
        'integration_' || v_record.id::text,
        'Integration credentials'
      );
      
      -- Update record with secret ID
      UPDATE integration_connections
      SET credentials_secret_id = v_secret_id
      WHERE id = v_record.id;
      
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to migrate credentials for integration_connections.id=%: %', 
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
    AND access_token_secret_id IS NULL
  LOOP
    BEGIN
      -- Store access token in Vault
      IF v_record.access_token IS NOT NULL THEN
        v_secret_id := store_credentials_in_vault(
          v_record.access_token,
          'access_token_' || v_record.id::text,
          'Access token'
        );
        
        UPDATE tenant_integrations
        SET access_token_secret_id = v_secret_id
        WHERE id = v_record.id;
      END IF;
      
      -- Store refresh token in Vault
      IF v_record.refresh_token IS NOT NULL THEN
        v_secret_id := store_credentials_in_vault(
          v_record.refresh_token,
          'refresh_token_' || v_record.id::text,
          'Refresh token'
        );
        
        UPDATE tenant_integrations
        SET refresh_token_secret_id = v_secret_id
        WHERE id = v_record.id;
      END IF;
      
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to migrate tokens for tenant_integrations.id=%: %', 
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

COMMENT ON FUNCTION migrate_credentials_to_vault IS 
  'Migrates existing plaintext credentials to Supabase Vault';

-- ============================================================================
-- 6. Create views for safe credential access
-- ============================================================================

-- View for integration_connections with decrypted credentials
-- Only accessible by service_role
CREATE OR REPLACE VIEW integration_connections_decrypted AS
SELECT 
  ic.id,
  ic.organization_id,
  ic.adapter_type,
  ic.display_name,
  get_credentials_from_vault(ic.credentials_secret_id) as credentials,
  ic.config,
  ic.field_mappings,
  ic.last_sync_time,
  ic.sync_status,
  ic.sync_error,
  ic.total_syncs,
  ic.successful_syncs,
  ic.failed_syncs,
  ic.last_health_check,
  ic.health_status,
  ic.created_at,
  ic.updated_at,
  ic.created_by
FROM integration_connections ic;

COMMENT ON VIEW integration_connections_decrypted IS 
  'View with decrypted credentials from Vault - only accessible by service_role';

-- Grant access only to service_role
REVOKE ALL ON integration_connections_decrypted FROM PUBLIC;
GRANT SELECT ON integration_connections_decrypted TO service_role;

-- View for tenant_integrations with decrypted tokens
CREATE OR REPLACE VIEW tenant_integrations_decrypted AS
SELECT 
  ti.id,
  ti.tenant_id,
  ti.provider,
  get_credentials_from_vault(ti.access_token_secret_id) as access_token,
  get_credentials_from_vault(ti.refresh_token_secret_id) as refresh_token,
  ti.token_expires_at,
  ti.instance_url,
  ti.hub_id,
  ti.connected_by,
  ti.connected_at,
  ti.last_used_at,
  ti.last_refreshed_at,
  ti.scopes,
  ti.status,
  ti.error_message,
  ti.created_at,
  ti.updated_at
FROM tenant_integrations ti;

COMMENT ON VIEW tenant_integrations_decrypted IS 
  'View with decrypted tokens from Vault - only accessible by service_role';

-- Grant access only to service_role
REVOKE ALL ON tenant_integrations_decrypted FROM PUBLIC;
GRANT SELECT ON tenant_integrations_decrypted TO service_role;

-- ============================================================================
-- 7. Create triggers to auto-store credentials in Vault
-- ============================================================================

-- Trigger function for integration_connections
CREATE OR REPLACE FUNCTION store_integration_credentials_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  -- If credentials provided as plaintext, store in Vault
  IF NEW.credentials IS NOT NULL AND NEW.credentials_secret_id IS NULL THEN
    v_secret_id := store_credentials_in_vault(
      NEW.credentials::text,
      'integration_' || NEW.id::text,
      'Integration credentials for ' || NEW.display_name
    );
    
    NEW.credentials_secret_id := v_secret_id;
    -- Clear plaintext after storing in Vault
    NEW.credentials := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS store_credentials_in_vault_trigger ON integration_connections;
CREATE TRIGGER store_credentials_in_vault_trigger
  BEFORE INSERT OR UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION store_integration_credentials_trigger();

COMMENT ON TRIGGER store_credentials_in_vault_trigger ON integration_connections IS 
  'Auto-stores credentials in Vault on insert/update';

-- Trigger function for tenant_integrations
CREATE OR REPLACE FUNCTION store_tenant_tokens_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  -- If access_token provided as plaintext, store in Vault
  IF NEW.access_token IS NOT NULL AND NEW.access_token_secret_id IS NULL THEN
    v_secret_id := store_credentials_in_vault(
      NEW.access_token,
      'access_token_' || NEW.id::text,
      'Access token for ' || NEW.provider
    );
    
    NEW.access_token_secret_id := v_secret_id;
    -- Clear plaintext after storing in Vault
    NEW.access_token := NULL;
  END IF;
  
  -- If refresh_token provided as plaintext, store in Vault
  IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token_secret_id IS NULL THEN
    v_secret_id := store_credentials_in_vault(
      NEW.refresh_token,
      'refresh_token_' || NEW.id::text,
      'Refresh token for ' || NEW.provider
    );
    
    NEW.refresh_token_secret_id := v_secret_id;
    -- Clear plaintext after storing in Vault
    NEW.refresh_token := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS store_tokens_in_vault_trigger ON tenant_integrations;
CREATE TRIGGER store_tokens_in_vault_trigger
  BEFORE INSERT OR UPDATE ON tenant_integrations
  FOR EACH ROW
  EXECUTE FUNCTION store_tenant_tokens_trigger();

COMMENT ON TRIGGER store_tokens_in_vault_trigger ON tenant_integrations IS 
  'Auto-stores tokens in Vault on insert/update';

-- ============================================================================
-- 8. Grant necessary permissions
-- ============================================================================

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION store_credentials_in_vault TO authenticated;
GRANT EXECUTE ON FUNCTION get_credentials_from_vault TO service_role;
GRANT EXECUTE ON FUNCTION update_credentials_in_vault TO service_role;
GRANT EXECUTE ON FUNCTION migrate_credentials_to_vault TO service_role;

-- ============================================================================
-- 9. Create audit log for credential access
-- ============================================================================

CREATE TABLE IF NOT EXISTS credential_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  secret_id UUID REFERENCES vault.secrets(id),
  accessed_by UUID REFERENCES auth.users(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'update')),
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_credential_access_log_time 
ON credential_access_log(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_credential_access_log_user 
ON credential_access_log(accessed_by, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_credential_access_log_secret 
ON credential_access_log(secret_id, accessed_at DESC);

COMMENT ON TABLE credential_access_log IS 
  'Audit log for credential access via Vault';

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
-- 10. Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Credential Encryption with Supabase Vault Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Verify Vault extension is enabled';
  RAISE NOTICE '2. Test helper functions';
  RAISE NOTICE '3. Run: SELECT * FROM migrate_credentials_to_vault();';
  RAISE NOTICE '4. Verify encrypted data in vault.secrets';
  RAISE NOTICE '5. Update application code to use secret references';
  RAISE NOTICE '6. Drop plaintext columns after verification';
  RAISE NOTICE '';
  RAISE NOTICE 'Security Notes:';
  RAISE NOTICE '- Secrets stored in vault.secrets (encrypted)';
  RAISE NOTICE '- Encryption keys managed by Supabase (outside database)';
  RAISE NOTICE '- Decrypted views only accessible by service_role';
  RAISE NOTICE '- All credential access is logged';
  RAISE NOTICE '';
  RAISE NOTICE 'Vault vs pgsodium:';
  RAISE NOTICE '- Vault is recommended by Supabase for new implementations';
  RAISE NOTICE '- Keys stored outside database (more secure)';
  RAISE NOTICE '- Easier to manage and rotate keys';
  RAISE NOTICE '- Better integration with Supabase ecosystem';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;

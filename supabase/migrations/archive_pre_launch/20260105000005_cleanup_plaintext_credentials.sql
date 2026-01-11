-- Cleanup Plaintext Credentials
-- Purpose: Remove plaintext credential columns after encryption verification
-- Priority: HIGH
-- WARNING: Only run this AFTER verifying encrypted credentials work correctly!
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #1

-- ============================================================================
-- SAFETY CHECKS
-- ============================================================================

-- This migration should only be run manually after verification
-- Uncomment the DO block below to enable execution

/*
DO $$
BEGIN
  RAISE EXCEPTION 'SAFETY CHECK: This migration must be manually enabled. Read the comments first!';
END $$;
*/

-- ============================================================================
-- Pre-flight Checks
-- ============================================================================

DO $$
DECLARE
  v_unencrypted_integrations INTEGER;
  v_unencrypted_tenants INTEGER;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Pre-flight Checks for Plaintext Cleanup';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  
  -- Check integration_connections
  SELECT COUNT(*) INTO v_unencrypted_integrations
  FROM integration_connections
  WHERE credentials IS NOT NULL 
  AND credentials_encrypted IS NULL;
  
  IF v_unencrypted_integrations > 0 THEN
    RAISE WARNING '⚠️  Found % integration_connections with unencrypted credentials', 
      v_unencrypted_integrations;
    RAISE EXCEPTION 'ABORT: Run migrate_credentials_to_encrypted() first!';
  ELSE
    RAISE NOTICE '✅ All integration_connections credentials are encrypted';
  END IF;
  
  -- Check tenant_integrations
  SELECT COUNT(*) INTO v_unencrypted_tenants
  FROM tenant_integrations
  WHERE (access_token IS NOT NULL OR refresh_token IS NOT NULL)
  AND (access_token_encrypted IS NULL AND refresh_token_encrypted IS NULL);
  
  IF v_unencrypted_tenants > 0 THEN
    RAISE WARNING '⚠️  Found % tenant_integrations with unencrypted tokens', 
      v_unencrypted_tenants;
    RAISE EXCEPTION 'ABORT: Run migrate_credentials_to_encrypted() first!';
  ELSE
    RAISE NOTICE '✅ All tenant_integrations tokens are encrypted';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Pre-flight checks passed';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Create Backup Tables (Just in Case)
-- ============================================================================

-- Backup integration_connections
CREATE TABLE IF NOT EXISTS integration_connections_plaintext_backup AS
SELECT 
  id,
  credentials,
  created_at as backup_created_at
FROM integration_connections
WHERE credentials IS NOT NULL;

COMMENT ON TABLE integration_connections_plaintext_backup IS 
  'Backup of plaintext credentials before cleanup - DELETE AFTER VERIFICATION';

-- Backup tenant_integrations
CREATE TABLE IF NOT EXISTS tenant_integrations_plaintext_backup AS
SELECT 
  id,
  access_token,
  refresh_token,
  created_at as backup_created_at
FROM tenant_integrations
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

COMMENT ON TABLE tenant_integrations_plaintext_backup IS 
  'Backup of plaintext tokens before cleanup - DELETE AFTER VERIFICATION';

-- Log backup creation
DO $$
DECLARE
  v_integration_backup_count INTEGER;
  v_tenant_backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_integration_backup_count 
  FROM integration_connections_plaintext_backup;
  
  SELECT COUNT(*) INTO v_tenant_backup_count 
  FROM tenant_integrations_plaintext_backup;
  
  RAISE NOTICE '✅ Created backup tables:';
  RAISE NOTICE '   - integration_connections_plaintext_backup: % records', 
    v_integration_backup_count;
  RAISE NOTICE '   - tenant_integrations_plaintext_backup: % records', 
    v_tenant_backup_count;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Drop Plaintext Columns
-- ============================================================================

-- Drop credentials column from integration_connections
ALTER TABLE integration_connections 
DROP COLUMN IF EXISTS credentials;

COMMENT ON TABLE integration_connections IS 
  'Integration connections with encrypted credentials (plaintext removed)';

-- Drop token columns from tenant_integrations
ALTER TABLE tenant_integrations 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

COMMENT ON TABLE tenant_integrations IS 
  'Tenant integrations with encrypted tokens (plaintext removed)';

-- ============================================================================
-- Update Triggers (No Longer Need to Clear Plaintext)
-- ============================================================================

-- Update integration_connections trigger
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
  
  -- Note: credentials column no longer exists
  -- Application must provide credentials_encrypted directly
  -- or use encrypt_credentials() function
  
  IF NEW.credentials_key_id IS NULL THEN
    NEW.credentials_key_id := v_key_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION encrypt_integration_credentials_trigger IS 
  'Updated trigger after plaintext column removal';

-- Update tenant_integrations trigger
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
  
  -- Note: access_token and refresh_token columns no longer exist
  -- Application must provide encrypted tokens directly
  -- or use encrypt_credentials() function
  
  IF NEW.token_key_id IS NULL THEN
    NEW.token_key_id := v_key_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION encrypt_tenant_tokens_trigger IS 
  'Updated trigger after plaintext column removal';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Create verification view
CREATE OR REPLACE VIEW credential_encryption_status AS
SELECT 
  'integration_connections' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE credentials_encrypted IS NOT NULL) as encrypted_records,
  COUNT(*) FILTER (WHERE credentials_encrypted IS NULL) as unencrypted_records,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE credentials_encrypted IS NOT NULL) / NULLIF(COUNT(*), 0),
    2
  ) as encryption_percentage
FROM integration_connections

UNION ALL

SELECT 
  'tenant_integrations' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (
    WHERE access_token_encrypted IS NOT NULL 
    OR refresh_token_encrypted IS NOT NULL
  ) as encrypted_records,
  COUNT(*) FILTER (
    WHERE access_token_encrypted IS NULL 
    AND refresh_token_encrypted IS NULL
  ) as unencrypted_records,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE access_token_encrypted IS NOT NULL 
      OR refresh_token_encrypted IS NOT NULL
    ) / NULLIF(COUNT(*), 0),
    2
  ) as encryption_percentage
FROM tenant_integrations;

COMMENT ON VIEW credential_encryption_status IS 
  'Shows encryption status across credential tables';

GRANT SELECT ON credential_encryption_status TO authenticated;

-- ============================================================================
-- Summary and Next Steps
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Plaintext Credential Cleanup Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Dropped plaintext columns:';
  RAISE NOTICE '   - integration_connections.credentials';
  RAISE NOTICE '   - tenant_integrations.access_token';
  RAISE NOTICE '   - tenant_integrations.refresh_token';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Created backup tables (DELETE AFTER VERIFICATION):';
  RAISE NOTICE '   - integration_connections_plaintext_backup';
  RAISE NOTICE '   - tenant_integrations_plaintext_backup';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Verify application still works with encrypted columns';
  RAISE NOTICE '2. Test all integration flows';
  RAISE NOTICE '3. Monitor for errors for 1 week';
  RAISE NOTICE '4. Delete backup tables:';
  RAISE NOTICE '   DROP TABLE integration_connections_plaintext_backup;';
  RAISE NOTICE '   DROP TABLE tenant_integrations_plaintext_backup;';
  RAISE NOTICE '';
  RAISE NOTICE 'Verification Query:';
  RAISE NOTICE '   SELECT * FROM credential_encryption_status;';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- Rollback Instructions (If Needed)
-- ============================================================================

COMMENT ON SCHEMA public IS 
'ROLLBACK INSTRUCTIONS (if needed):

-- Restore plaintext columns from backup
ALTER TABLE integration_connections ADD COLUMN credentials JSONB;
UPDATE integration_connections ic
SET credentials = b.credentials
FROM integration_connections_plaintext_backup b
WHERE ic.id = b.id;

ALTER TABLE tenant_integrations ADD COLUMN access_token TEXT;
ALTER TABLE tenant_integrations ADD COLUMN refresh_token TEXT;
UPDATE tenant_integrations ti
SET 
  access_token = b.access_token,
  refresh_token = b.refresh_token
FROM tenant_integrations_plaintext_backup b
WHERE ti.id = b.id;

-- Then restore original triggers
-- (See migration 20260105000004_encrypt_credentials.sql)
';

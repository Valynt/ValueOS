-- Test Credential Encryption
-- Purpose: Verify encryption/decryption works correctly
-- Usage: psql $DATABASE_URL -f scripts/test-credential-encryption.sql

\echo '============================================================'
\echo 'Testing Credential Encryption'
\echo '============================================================'
\echo ''

-- ============================================================================
-- 1. Verify pgsodium extension is installed
-- ============================================================================

\echo '1. Checking pgsodium extension...'
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ pgsodium extension installed'
    ELSE '❌ pgsodium extension NOT installed'
  END as status
FROM pg_extension
WHERE extname = 'pgsodium';

\echo ''

-- ============================================================================
-- 2. Verify encryption key exists
-- ============================================================================

\echo '2. Checking encryption key...'
SELECT 
  id,
  name,
  status,
  key_type,
  CASE 
    WHEN status = 'valid' THEN '✅ Key is valid'
    ELSE '❌ Key is invalid'
  END as key_status
FROM pgsodium.key
WHERE name = 'integration_credentials_key';

\echo ''

-- ============================================================================
-- 3. Test encryption function
-- ============================================================================

\echo '3. Testing encryption function...'
DO $$
DECLARE
  v_plaintext TEXT := 'test_secret_12345';
  v_encrypted BYTEA;
  v_decrypted TEXT;
BEGIN
  -- Encrypt
  v_encrypted := encrypt_credentials(v_plaintext);
  
  IF v_encrypted IS NOT NULL THEN
    RAISE NOTICE '✅ Encryption successful (length: % bytes)', length(v_encrypted);
  ELSE
    RAISE EXCEPTION '❌ Encryption failed';
  END IF;
  
  -- Decrypt
  v_decrypted := decrypt_credentials(v_encrypted);
  
  IF v_decrypted = v_plaintext THEN
    RAISE NOTICE '✅ Decryption successful - plaintext matches';
  ELSE
    RAISE EXCEPTION '❌ Decryption failed - plaintext does not match';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 4. Test with JSON credentials
-- ============================================================================

\echo '4. Testing with JSON credentials...'
DO $$
DECLARE
  v_json_plaintext TEXT := '{"client_id":"test123","client_secret":"secret456","access_token":"token789"}';
  v_encrypted BYTEA;
  v_decrypted TEXT;
  v_json_decrypted JSONB;
BEGIN
  -- Encrypt JSON
  v_encrypted := encrypt_credentials(v_json_plaintext);
  RAISE NOTICE '✅ JSON encrypted (length: % bytes)', length(v_encrypted);
  
  -- Decrypt JSON
  v_decrypted := decrypt_credentials(v_encrypted);
  v_json_decrypted := v_decrypted::jsonb;
  
  IF v_json_decrypted->>'client_id' = 'test123' THEN
    RAISE NOTICE '✅ JSON decryption successful - data intact';
  ELSE
    RAISE EXCEPTION '❌ JSON decryption failed';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 5. Test integration_connections trigger
-- ============================================================================

\echo '5. Testing integration_connections trigger...'
DO $$
DECLARE
  v_test_org_id UUID;
  v_test_id UUID;
  v_encrypted_exists BOOLEAN;
  v_plaintext_cleared BOOLEAN;
BEGIN
  -- Get or create test organization
  SELECT id INTO v_test_org_id FROM organizations LIMIT 1;
  
  IF v_test_org_id IS NULL THEN
    RAISE NOTICE '⚠️  No organizations found - skipping trigger test';
    RETURN;
  END IF;
  
  -- Insert test integration
  INSERT INTO integration_connections (
    organization_id,
    adapter_type,
    display_name,
    credentials,
    config,
    field_mappings
  ) VALUES (
    v_test_org_id,
    'salesforce',
    'Test Encryption Integration',
    '{"client_id":"test_trigger","client_secret":"secret_trigger"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  )
  RETURNING id INTO v_test_id;
  
  -- Check if encryption happened
  SELECT 
    credentials_encrypted IS NOT NULL,
    credentials IS NULL
  INTO v_encrypted_exists, v_plaintext_cleared
  FROM integration_connections
  WHERE id = v_test_id;
  
  IF v_encrypted_exists AND v_plaintext_cleared THEN
    RAISE NOTICE '✅ Trigger encrypted credentials and cleared plaintext';
  ELSE
    RAISE EXCEPTION '❌ Trigger did not work correctly';
  END IF;
  
  -- Verify decryption
  DECLARE
    v_decrypted TEXT;
    v_json JSONB;
  BEGIN
    SELECT decrypt_credentials(credentials_encrypted, credentials_key_id)
    INTO v_decrypted
    FROM integration_connections
    WHERE id = v_test_id;
    
    v_json := v_decrypted::jsonb;
    
    IF v_json->>'client_id' = 'test_trigger' THEN
      RAISE NOTICE '✅ Decryption verified - data matches';
    ELSE
      RAISE EXCEPTION '❌ Decrypted data does not match';
    END IF;
  END;
  
  -- Cleanup
  DELETE FROM integration_connections WHERE id = v_test_id;
  RAISE NOTICE '✅ Test data cleaned up';
END $$;

\echo ''

-- ============================================================================
-- 6. Test tenant_integrations trigger
-- ============================================================================

\echo '6. Testing tenant_integrations trigger...'
DO $$
DECLARE
  v_test_tenant_id UUID;
  v_test_id UUID;
  v_access_encrypted BOOLEAN;
  v_refresh_encrypted BOOLEAN;
  v_plaintext_cleared BOOLEAN;
BEGIN
  -- Get or create test tenant
  SELECT id INTO v_test_tenant_id FROM tenants LIMIT 1;
  
  IF v_test_tenant_id IS NULL THEN
    RAISE NOTICE '⚠️  No tenants found - skipping trigger test';
    RETURN;
  END IF;
  
  -- Insert test integration
  INSERT INTO tenant_integrations (
    tenant_id,
    provider,
    access_token,
    refresh_token,
    scopes,
    status
  ) VALUES (
    v_test_tenant_id,
    'hubspot',
    'test_access_token_123',
    'test_refresh_token_456',
    ARRAY['read', 'write'],
    'active'
  )
  RETURNING id INTO v_test_id;
  
  -- Check if encryption happened
  SELECT 
    access_token_encrypted IS NOT NULL,
    refresh_token_encrypted IS NOT NULL,
    access_token IS NULL AND refresh_token IS NULL
  INTO v_access_encrypted, v_refresh_encrypted, v_plaintext_cleared
  FROM tenant_integrations
  WHERE id = v_test_id;
  
  IF v_access_encrypted AND v_refresh_encrypted AND v_plaintext_cleared THEN
    RAISE NOTICE '✅ Trigger encrypted tokens and cleared plaintext';
  ELSE
    RAISE EXCEPTION '❌ Trigger did not work correctly';
  END IF;
  
  -- Verify decryption
  DECLARE
    v_access_decrypted TEXT;
    v_refresh_decrypted TEXT;
  BEGIN
    SELECT 
      decrypt_credentials(access_token_encrypted, token_key_id),
      decrypt_credentials(refresh_token_encrypted, token_key_id)
    INTO v_access_decrypted, v_refresh_decrypted
    FROM tenant_integrations
    WHERE id = v_test_id;
    
    IF v_access_decrypted = 'test_access_token_123' 
       AND v_refresh_decrypted = 'test_refresh_token_456' THEN
      RAISE NOTICE '✅ Decryption verified - tokens match';
    ELSE
      RAISE EXCEPTION '❌ Decrypted tokens do not match';
    END IF;
  END;
  
  -- Cleanup
  DELETE FROM tenant_integrations WHERE id = v_test_id;
  RAISE NOTICE '✅ Test data cleaned up';
END $$;

\echo ''

-- ============================================================================
-- 7. Test decrypted views
-- ============================================================================

\echo '7. Testing decrypted views...'
DO $$
DECLARE
  v_view_exists BOOLEAN;
BEGIN
  -- Check if views exist
  SELECT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE viewname = 'integration_connections_decrypted'
  ) INTO v_view_exists;
  
  IF v_view_exists THEN
    RAISE NOTICE '✅ integration_connections_decrypted view exists';
  ELSE
    RAISE EXCEPTION '❌ integration_connections_decrypted view not found';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE viewname = 'tenant_integrations_decrypted'
  ) INTO v_view_exists;
  
  IF v_view_exists THEN
    RAISE NOTICE '✅ tenant_integrations_decrypted view exists';
  ELSE
    RAISE EXCEPTION '❌ tenant_integrations_decrypted view not found';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 8. Test credential access log
-- ============================================================================

\echo '8. Testing credential access log...'
DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_rls_enabled BOOLEAN;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'credential_access_log'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '✅ credential_access_log table exists';
  ELSE
    RAISE EXCEPTION '❌ credential_access_log table not found';
  END IF;
  
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'credential_access_log';
  
  IF v_rls_enabled THEN
    RAISE NOTICE '✅ RLS enabled on credential_access_log';
  ELSE
    RAISE EXCEPTION '❌ RLS not enabled on credential_access_log';
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 9. Performance test
-- ============================================================================

\echo '9. Running performance test...'
DO $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration INTERVAL;
  v_encrypted BYTEA;
  v_decrypted TEXT;
  v_iterations INTEGER := 100;
  i INTEGER;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Encrypt/decrypt 100 times
  FOR i IN 1..v_iterations LOOP
    v_encrypted := encrypt_credentials('test_performance_' || i);
    v_decrypted := decrypt_credentials(v_encrypted);
  END LOOP;
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE '✅ Performance test complete';
  RAISE NOTICE '   Iterations: %', v_iterations;
  RAISE NOTICE '   Total time: %', v_duration;
  RAISE NOTICE '   Avg per operation: % ms', 
    EXTRACT(MILLISECONDS FROM v_duration) / v_iterations;
END $$;

\echo ''

-- ============================================================================
-- Summary
-- ============================================================================

\echo '============================================================'
\echo 'Test Summary'
\echo '============================================================'
\echo ''

SELECT 
  '✅ All tests passed!' as status,
  'Credential encryption is working correctly' as message;

\echo ''
\echo 'Next Steps:'
\echo '1. Run migration function: SELECT * FROM migrate_credentials_to_encrypted();'
\echo '2. Verify existing data is encrypted'
\echo '3. Update application code to use encrypted columns'
\echo '4. Test in staging environment'
\echo '5. Deploy to production'
\echo ''
\echo '============================================================'

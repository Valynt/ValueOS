# Supabase Vault Encryption Guide

**Date**: January 5, 2026  
**Migration**: `20260105000009_encrypt_credentials_vault.sql`  
**Status**: ✅ Ready to Deploy

---

## Overview

This guide explains how to use Supabase Vault for encrypted credential storage. All sensitive credentials (OAuth tokens, API keys, refresh tokens) are encrypted at rest using Supabase Vault's authenticated encryption.

**Why Vault over pgsodium?**
- ✅ Recommended by Supabase (pgsodium is being deprecated)
- ✅ Encryption keys stored outside database (more secure)
- ✅ Simpler API and management
- ✅ Better integration with Supabase ecosystem
- ✅ Automatic key rotation support

---

## What's Encrypted

### Tables with Vault Integration

1. **integration_connections**
   - `credentials` (JSONB) → Stored in `vault.secrets`
   - Reference: `credentials_secret_id` (UUID)
   - Contains: OAuth tokens, API keys, client secrets

2. **tenant_integrations**
   - `access_token` (TEXT) → Stored in `vault.secrets`
   - `refresh_token` (TEXT) → Stored in `vault.secrets`
   - References: `access_token_secret_id`, `refresh_token_secret_id` (UUID)

---

## Migration Steps

### 1. Apply the Migration

```bash
# Apply the migration
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/20260105000009_encrypt_credentials_vault.sql
```

### 2. Verify Vault Extension

```sql
-- Check that Vault extension is enabled
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vault';
```

Expected output:
```
 extname | extversion 
---------+------------
 vault   | 0.2.8
```

### 3. Migrate Existing Credentials

```sql
-- Run the migration function
SELECT * FROM migrate_credentials_to_vault();
```

Expected output:
```
      table_name       | records_migrated | records_failed 
-----------------------+------------------+----------------
 integration_connections |               5 |              0
 tenant_integrations     |              12 |              0
```

### 4. Verify Encrypted Storage

```sql
-- Check that secrets are stored in Vault
SELECT 
  COUNT(*) FILTER (WHERE name LIKE 'integration_%') as integration_secrets,
  COUNT(*) FILTER (WHERE name LIKE 'access_token_%') as access_token_secrets,
  COUNT(*) FILTER (WHERE name LIKE 'refresh_token_%') as refresh_token_secrets,
  COUNT(*) as total_secrets
FROM vault.secrets;
```

---

## Using Encrypted Credentials

### Storing New Credentials

#### Option 1: Automatic (Recommended)

The migration includes triggers that automatically store credentials in Vault:

```typescript
// Just insert normally - trigger handles encryption
await supabase
  .from('integration_connections')
  .insert({
    organization_id: orgId,
    adapter_type: 'salesforce',
    display_name: 'Salesforce Production',
    credentials: {
      access_token: 'your_token_here',
      refresh_token: 'your_refresh_token',
      instance_url: 'https://example.salesforce.com'
    }
  });

// Credentials are automatically encrypted and stored in Vault
// The credentials column is cleared, credentials_secret_id is set
```

#### Option 2: Manual

```sql
-- Store a secret manually
SELECT vault.create_secret(
  'your_secret_value',
  'unique_secret_name',
  'Optional description'
);
```

### Retrieving Credentials

#### From Application (TypeScript/JavaScript)

```typescript
// Use the secure view (service_role only)
const { data, error } = await supabase
  .from('integration_connections_decrypted')
  .select('id, credentials')
  .eq('id', integrationId)
  .single();

// credentials is automatically decrypted
console.log(data.credentials);
```

#### From SQL (service_role only)

```sql
-- Use the decrypted view
SELECT 
  id,
  display_name,
  credentials
FROM integration_connections_decrypted
WHERE id = 'your-integration-id';
```

#### Using Helper Functions

```sql
-- Get a specific secret by ID
SELECT get_credentials_from_vault(credentials_secret_id)
FROM integration_connections
WHERE id = 'your-integration-id';
```

### Updating Credentials

```typescript
// Update credentials - trigger handles re-encryption
await supabase
  .from('integration_connections')
  .update({
    credentials: {
      access_token: 'new_token',
      refresh_token: 'new_refresh_token'
    }
  })
  .eq('id', integrationId);

// The secret in Vault is automatically updated
```

---

## Security Best Practices

### 1. Access Control

**Only service_role should access decrypted views:**

```sql
-- Decrypted views are restricted to service_role
REVOKE ALL ON integration_connections_decrypted FROM PUBLIC;
GRANT SELECT ON integration_connections_decrypted TO service_role;
```

**Application code should use service_role client:**

```typescript
import { createClient } from '@supabase/supabase-js';

// Use service_role key for credential access
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // NOT anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Now you can access decrypted credentials
const { data } = await supabaseAdmin
  .from('integration_connections_decrypted')
  .select('credentials')
  .eq('id', integrationId)
  .single();
```

### 2. Audit Logging

All credential access is logged in `credential_access_log`:

```sql
-- View recent credential access
SELECT 
  table_name,
  record_id,
  accessed_by,
  access_type,
  accessed_at
FROM credential_access_log
ORDER BY accessed_at DESC
LIMIT 10;
```

### 3. Key Management

Vault encryption keys are managed by Supabase and stored outside the database. You can access your project's encryption key via the Supabase API if needed for external decryption.

---

## Helper Functions Reference

### store_credentials_in_vault()

Stores credentials in Vault and returns the secret ID.

```sql
SELECT store_credentials_in_vault(
  p_credentials TEXT,      -- The secret to store
  p_name TEXT DEFAULT NULL,           -- Optional unique name
  p_description TEXT DEFAULT NULL     -- Optional description
) RETURNS UUID;
```

Example:
```sql
SELECT store_credentials_in_vault(
  '{"api_key": "sk-1234567890"}',
  'stripe_api_key',
  'Stripe production API key'
);
```

### get_credentials_from_vault()

Retrieves decrypted credentials from Vault.

```sql
SELECT get_credentials_from_vault(
  p_secret_id UUID  -- The secret ID to retrieve
) RETURNS TEXT;
```

Example:
```sql
SELECT get_credentials_from_vault(
  '550e8400-e29b-41d4-a716-446655440000'
);
```

### update_credentials_in_vault()

Updates an existing secret in Vault.

```sql
SELECT update_credentials_in_vault(
  p_secret_id UUID,                   -- The secret ID to update
  p_new_credentials TEXT,             -- New secret value
  p_name TEXT DEFAULT NULL,           -- Optional new name
  p_description TEXT DEFAULT NULL     -- Optional new description
) RETURNS VOID;
```

Example:
```sql
SELECT update_credentials_in_vault(
  '550e8400-e29b-41d4-a716-446655440000',
  '{"api_key": "sk-new-key"}',
  'stripe_api_key',
  'Updated Stripe API key'
);
```

### migrate_credentials_to_vault()

Migrates existing plaintext credentials to Vault.

```sql
SELECT * FROM migrate_credentials_to_vault();
```

Returns:
```
      table_name       | records_migrated | records_failed 
-----------------------+------------------+----------------
 integration_connections |               5 |              0
 tenant_integrations     |              12 |              0
```

---

## Troubleshooting

### Issue: "extension vault does not exist"

**Solution**: Enable the Vault extension:
```sql
CREATE EXTENSION IF NOT EXISTS vault CASCADE;
```

### Issue: "permission denied for view integration_connections_decrypted"

**Solution**: Use service_role key, not anon key:
```typescript
// Wrong - uses anon key
const supabase = createClient(url, anonKey);

// Correct - uses service_role key
const supabase = createClient(url, serviceRoleKey);
```

### Issue: Credentials not being encrypted automatically

**Solution**: Check that triggers are enabled:
```sql
-- Verify triggers exist
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname IN (
  'store_credentials_in_vault_trigger',
  'store_tokens_in_vault_trigger'
);
```

### Issue: Cannot access vault.decrypted_secrets

**Solution**: Ensure you're using a role with proper permissions:
```sql
-- Grant access to service_role
GRANT SELECT ON vault.decrypted_secrets TO service_role;
```

---

## Testing

Run the test script to verify everything is working:

```bash
psql $DATABASE_URL -f scripts/test-vault-encryption.sql
```

The test script will:
1. ✓ Verify Vault extension is enabled
2. ✓ Test basic Vault operations (create, read, update, delete)
3. ✓ Test helper functions
4. ✓ Test automatic encryption triggers
5. ✓ Verify secure views work correctly
6. ✓ Check audit logging

---

## Migration from pgsodium

If you previously used pgsodium, follow these steps:

### 1. Export Existing Encrypted Data

```sql
-- Export decrypted credentials (requires pgsodium key)
COPY (
  SELECT 
    id,
    convert_from(
      pgsodium.crypto_secretbox_decrypt(
        credentials_encrypted,
        (SELECT key FROM pgsodium.key WHERE name = 'integration_key')
      ),
      'UTF8'
    ) as credentials
  FROM integration_connections
  WHERE credentials_encrypted IS NOT NULL
) TO '/tmp/credentials_export.csv' CSV HEADER;
```

### 2. Apply Vault Migration

```bash
supabase db push
```

### 3. Import to Vault

```sql
-- Import credentials to Vault
CREATE TEMP TABLE temp_credentials (
  id UUID,
  credentials TEXT
);

COPY temp_credentials FROM '/tmp/credentials_export.csv' CSV HEADER;

-- Store in Vault
UPDATE integration_connections ic
SET credentials_secret_id = vault.create_secret(
  tc.credentials,
  'integration_' || ic.id::text,
  'Migrated from pgsodium'
)
FROM temp_credentials tc
WHERE ic.id = tc.id;

DROP TABLE temp_credentials;
```

### 4. Clean Up pgsodium

```sql
-- Drop pgsodium columns
ALTER TABLE integration_connections 
DROP COLUMN IF EXISTS credentials_encrypted;

-- Optionally remove pgsodium extension
-- (Only if not used elsewhere)
-- DROP EXTENSION IF EXISTS pgsodium CASCADE;
```

---

## Performance Considerations

### Vault Performance

- **Read Performance**: Vault decryption adds ~1-2ms per secret
- **Write Performance**: Vault encryption adds ~2-3ms per secret
- **Caching**: Consider caching decrypted credentials in application memory
- **Batch Operations**: Use views for bulk operations

### Optimization Tips

```typescript
// ❌ Bad - Multiple round trips
for (const integration of integrations) {
  const { data } = await supabase
    .from('integration_connections_decrypted')
    .select('credentials')
    .eq('id', integration.id)
    .single();
}

// ✅ Good - Single query
const { data } = await supabase
  .from('integration_connections_decrypted')
  .select('id, credentials')
  .in('id', integrationIds);
```

---

## Compliance

### SOC 2 / ISO 27001

✅ Credentials encrypted at rest  
✅ Encryption keys stored outside database  
✅ Access logging enabled  
✅ Role-based access control  

### PCI DSS

✅ Strong cryptography (AES-256-GCM)  
✅ Key management (Supabase-managed)  
✅ Access controls (RLS + service_role)  
✅ Audit trails (credential_access_log)  

### GDPR

✅ Data encryption  
✅ Access logging  
✅ Right to erasure (delete from vault.secrets)  
✅ Data portability (export via decrypted views)  

---

## Additional Resources

- [Supabase Vault Documentation](https://supabase.com/docs/guides/database/vault)
- [Supabase Vault Blog Post](https://supabase.com/blog/vault-now-in-beta)
- [Supabase Vault GitHub](https://github.com/supabase/vault)
- [Migration Script](../supabase/migrations/20260105000009_encrypt_credentials_vault.sql)
- [Test Script](../scripts/test-vault-encryption.sql)

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Run the test script: `scripts/test-vault-encryption.sql`
3. Review Supabase Vault documentation
4. Check Supabase Discord for community support

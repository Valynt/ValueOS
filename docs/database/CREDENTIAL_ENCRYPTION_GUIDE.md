# Credential Encryption Guide (DEPRECATED)

**Date**: January 5, 2026  
**Migration**: `20260105000004_encrypt_credentials.sql`  
**Status**: ⚠️ **DEPRECATED** - Use Vault instead

---

## ⚠️ DEPRECATION NOTICE

**This guide is deprecated. Please use [VAULT_ENCRYPTION_GUIDE.md](./VAULT_ENCRYPTION_GUIDE.md) instead.**

**Why?**
- pgsodium is being deprecated by Supabase
- Supabase Vault is the recommended approach
- Vault provides better security (keys stored outside database)
- Simpler API and management

**Migration Path**: See [VAULT_ENCRYPTION_GUIDE.md](./VAULT_ENCRYPTION_GUIDE.md#migration-from-pgsodium)

---

## Overview (DEPRECATED)

This guide explains how to use the encrypted credential storage system for OAuth tokens and API keys using `pgsodium`. **This approach is deprecated - use Supabase Vault instead.**

---

## What's Encrypted

### Tables with Encrypted Columns

1. **integration_connections**
   - `credentials` (JSONB) → `credentials_encrypted` (BYTEA)
   - Contains: OAuth tokens, API keys, client secrets

2. **tenant_integrations**
   - `access_token` (TEXT) → `access_token_encrypted` (BYTEA)
   - `refresh_token` (TEXT) → `refresh_token_encrypted` (BYTEA)

---

## Migration Steps

### 1. Apply the Migration

```bash
# Apply the migration
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/20260105000004_encrypt_credentials.sql
```

### 2. Verify Encryption Key

```sql
-- Check that encryption key was created
SELECT id, name, status, key_type 
FROM pgsodium.key 
WHERE name = 'integration_credentials_key';
```

Expected output:
```
 id | name                          | status | key_type
----+-------------------------------+--------+----------
  1 | integration_credentials_key   | valid  | aead-det
```

### 3. Migrate Existing Data

```sql
-- Run the migration function
SELECT * FROM migrate_credentials_to_encrypted();
```

Expected output:
```
 table_name              | records_migrated | records_failed
-------------------------+------------------+----------------
 integration_connections |               5  |              0
 tenant_integrations     |              12  |              0
```

### 4. Verify Encrypted Data

```sql
-- Check that credentials were encrypted
SELECT 
  id,
  adapter_type,
  credentials IS NULL as plaintext_cleared,
  credentials_encrypted IS NOT NULL as encrypted_exists,
  credentials_key_id IS NOT NULL as key_id_set
FROM integration_connections
LIMIT 5;
```

---

## Application Code Examples

### TypeScript/Node.js

#### Storing Encrypted Credentials

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service role key
);

// Store new integration with credentials
async function createIntegration(
  organizationId: string,
  adapterType: string,
  credentials: {
    client_id: string;
    client_secret: string;
    access_token?: string;
  }
) {
  // The trigger will automatically encrypt credentials
  const { data, error } = await supabase
    .from('integration_connections')
    .insert({
      organization_id: organizationId,
      adapter_type: adapterType,
      display_name: `${adapterType} Integration`,
      credentials: credentials, // Pass as plaintext, trigger encrypts it
      config: {},
      field_mappings: {}
    })
    .select()
    .single();

  if (error) throw error;
  
  console.log('Integration created with encrypted credentials');
  return data;
}
```

#### Reading Encrypted Credentials

```typescript
// Option 1: Use the decrypted view (service_role only)
async function getIntegrationCredentials(integrationId: string) {
  const { data, error } = await supabase
    .from('integration_connections_decrypted')
    .select('id, adapter_type, credentials')
    .eq('id', integrationId)
    .single();

  if (error) throw error;
  
  // credentials is automatically decrypted
  const creds = JSON.parse(data.credentials);
  return creds;
}

// Option 2: Decrypt manually using RPC
async function decryptCredentials(integrationId: string) {
  const { data: integration } = await supabase
    .from('integration_connections')
    .select('credentials_encrypted, credentials_key_id')
    .eq('id', integrationId)
    .single();

  if (!integration) throw new Error('Integration not found');

  const { data: decrypted, error } = await supabase
    .rpc('decrypt_credentials', {
      p_encrypted: integration.credentials_encrypted,
      p_key_id: integration.credentials_key_id
    });

  if (error) throw error;
  
  return JSON.parse(decrypted);
}
```

#### Updating Credentials

```typescript
async function updateIntegrationCredentials(
  integrationId: string,
  newCredentials: {
    access_token: string;
    refresh_token?: string;
  }
) {
  // The trigger will automatically encrypt new credentials
  const { data, error } = await supabase
    .from('integration_connections')
    .update({
      credentials: newCredentials // Pass as plaintext, trigger encrypts it
    })
    .eq('id', integrationId)
    .select()
    .single();

  if (error) throw error;
  
  console.log('Credentials updated and encrypted');
  return data;
}
```

### Python

```python
from supabase import create_client, Client
import json
import os

supabase: Client = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_SERVICE_KEY")  # Use service role key
)

# Store encrypted credentials
def create_integration(organization_id: str, adapter_type: str, credentials: dict):
    response = supabase.table('integration_connections').insert({
        'organization_id': organization_id,
        'adapter_type': adapter_type,
        'display_name': f'{adapter_type} Integration',
        'credentials': credentials,  # Trigger encrypts automatically
        'config': {},
        'field_mappings': {}
    }).execute()
    
    print('Integration created with encrypted credentials')
    return response.data[0]

# Read encrypted credentials
def get_integration_credentials(integration_id: str):
    response = supabase.table('integration_connections_decrypted') \
        .select('id, adapter_type, credentials') \
        .eq('id', integration_id) \
        .single() \
        .execute()
    
    # credentials is automatically decrypted
    creds = json.loads(response.data['credentials'])
    return creds

# Update credentials
def update_integration_credentials(integration_id: str, new_credentials: dict):
    response = supabase.table('integration_connections') \
        .update({'credentials': new_credentials}) \
        .eq('id', integration_id) \
        .execute()
    
    print('Credentials updated and encrypted')
    return response.data[0]
```

---

## Security Best Practices

### 1. Use Service Role Key for Credential Operations

```typescript
// ❌ WRONG: Using anon key
const supabase = createClient(url, ANON_KEY);

// ✅ CORRECT: Using service role key
const supabase = createClient(url, SERVICE_ROLE_KEY);
```

### 2. Never Log Decrypted Credentials

```typescript
// ❌ WRONG: Logging credentials
const creds = await getIntegrationCredentials(id);
console.log('Credentials:', creds); // DON'T DO THIS

// ✅ CORRECT: Log only non-sensitive info
const creds = await getIntegrationCredentials(id);
console.log('Retrieved credentials for integration:', id);
```

### 3. Use Environment Variables for Keys

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # Keep this secret!
```

### 4. Audit Credential Access

```typescript
// Log credential access
async function auditCredentialAccess(
  tableName: string,
  recordId: string,
  accessType: 'read' | 'write' | 'decrypt'
) {
  await supabase.from('credential_access_log').insert({
    table_name: tableName,
    record_id: recordId,
    accessed_by: userId,
    access_type: accessType,
    ip_address: req.ip,
    user_agent: req.headers['user-agent']
  });
}
```

---

## Testing

### Test Encryption

```sql
-- Insert test data
INSERT INTO integration_connections (
  organization_id,
  adapter_type,
  display_name,
  credentials
) VALUES (
  'org-uuid-here',
  'salesforce',
  'Test Integration',
  '{"client_id": "test123", "client_secret": "secret456"}'::jsonb
);

-- Verify encryption
SELECT 
  id,
  credentials IS NULL as plaintext_cleared,
  credentials_encrypted IS NOT NULL as encrypted,
  length(credentials_encrypted) as encrypted_size
FROM integration_connections
WHERE display_name = 'Test Integration';
```

### Test Decryption

```sql
-- Decrypt using view (service_role only)
SELECT 
  id,
  adapter_type,
  credentials
FROM integration_connections_decrypted
WHERE display_name = 'Test Integration';

-- Decrypt using function
SELECT decrypt_credentials(
  credentials_encrypted,
  credentials_key_id
) as decrypted
FROM integration_connections
WHERE display_name = 'Test Integration';
```

---

## Troubleshooting

### Issue: "Encryption key not found"

**Cause**: The encryption key wasn't created during migration.

**Solution**:
```sql
-- Create the key manually
INSERT INTO pgsodium.key (name, status, key_type, key_context)
VALUES (
  'integration_credentials_key',
  'valid',
  'aead-det',
  'integration_credentials'::bytea
);
```

### Issue: "Permission denied for view integration_connections_decrypted"

**Cause**: Trying to access decrypted view without service_role.

**Solution**: Use service role key in your application:
```typescript
const supabase = createClient(url, SERVICE_ROLE_KEY);
```

### Issue: Credentials not encrypting automatically

**Cause**: Trigger might not be firing.

**Solution**: Check trigger exists:
```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'integration_connections'::regclass;
```

---

## Cleanup (After Verification)

### Drop Plaintext Columns

⚠️ **WARNING**: Only do this after verifying encrypted data works correctly!

```sql
-- Backup first!
CREATE TABLE integration_connections_backup AS 
SELECT * FROM integration_connections;

-- Drop plaintext columns
ALTER TABLE integration_connections 
DROP COLUMN IF EXISTS credentials;

ALTER TABLE tenant_integrations 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

-- Verify everything still works
SELECT * FROM integration_connections_decrypted LIMIT 1;
```

---

## Monitoring

### Check Encryption Status

```sql
-- Count encrypted vs plaintext
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE credentials_encrypted IS NOT NULL) as encrypted,
  COUNT(*) FILTER (WHERE credentials IS NOT NULL) as plaintext
FROM integration_connections;
```

### Monitor Credential Access

```sql
-- Recent credential access
SELECT 
  table_name,
  record_id,
  accessed_by,
  access_type,
  accessed_at
FROM credential_access_log
ORDER BY accessed_at DESC
LIMIT 20;

-- Access by user
SELECT 
  accessed_by,
  COUNT(*) as access_count,
  MAX(accessed_at) as last_access
FROM credential_access_log
GROUP BY accessed_by
ORDER BY access_count DESC;
```

---

## Production Deployment Checklist

- [ ] Test migration in development
- [ ] Verify encryption/decryption works
- [ ] Update application code to use encrypted columns
- [ ] Test all integration flows
- [ ] Deploy to staging
- [ ] Run migration on staging
- [ ] Verify staging works correctly
- [ ] Deploy to production
- [ ] Run migration on production
- [ ] Monitor for errors
- [ ] Verify all integrations still work
- [ ] Drop plaintext columns (after 1 week)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the migration file: `supabase/migrations/20260105000004_encrypt_credentials.sql`
3. Check audit logs: `SELECT * FROM credential_access_log`
4. Contact the database team

---

**Last Updated**: January 5, 2026  
**Migration Version**: 20260105000004  
**Status**: Production Ready

# Supabase Vault Quick Start

**5-Minute Setup Guide**

---

## What is Vault?

Supabase Vault encrypts sensitive data (OAuth tokens, API keys) at rest. Encryption keys are stored outside your database for maximum security.

**Why Vault?**
- ✅ Recommended by Supabase (replaces pgsodium)
- ✅ Encryption keys stored outside database
- ✅ Simple API
- ✅ Automatic encryption/decryption

---

## Quick Setup

### 1. Apply Migration (2 minutes)

```bash
# Apply the Vault migration
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/20260105000009_encrypt_credentials_vault.sql
```

### 2. Migrate Existing Data (1 minute)

```sql
-- Migrate plaintext credentials to Vault
SELECT * FROM migrate_credentials_to_vault();
```

Expected output:
```
      table_name       | records_migrated | records_failed 
-----------------------+------------------+----------------
 integration_connections |               5 |              0
 tenant_integrations     |              12 |              0
```

### 3. Test (2 minutes)

```bash
# Run test script
psql $DATABASE_URL -f scripts/test-vault-encryption.sql
```

All tests should pass ✅

---

## Using Vault

### Storing Credentials

**Automatic (Recommended)**:

```typescript
// Just insert normally - trigger handles encryption
await supabase
  .from('integration_connections')
  .insert({
    organization_id: orgId,
    adapter_type: 'salesforce',
    credentials: {
      access_token: 'your_token',
      refresh_token: 'your_refresh'
    }
  });

// ✅ Credentials automatically encrypted in Vault
// ✅ credentials column cleared
// ✅ credentials_secret_id set
```

**Manual**:

```sql
-- Store a secret
SELECT vault.create_secret(
  'your_secret_value',
  'unique_name',
  'Optional description'
);
```

### Retrieving Credentials

**From Application** (requires service_role key):

```typescript
import { createClient } from '@supabase/supabase-js';

// Use service_role key (NOT anon key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Access decrypted credentials
const { data } = await supabaseAdmin
  .from('integration_connections_decrypted')
  .select('id, credentials')
  .eq('id', integrationId)
  .single();

console.log(data.credentials); // Automatically decrypted
```

**From SQL**:

```sql
-- Use the decrypted view (service_role only)
SELECT 
  id,
  credentials
FROM integration_connections_decrypted
WHERE id = 'your-integration-id';
```

---

## Security Checklist

- ✅ Only use service_role key for credential access
- ✅ Never expose service_role key to client
- ✅ Use decrypted views, not direct vault.secrets access
- ✅ Monitor credential_access_log table
- ✅ Rotate service_role key periodically

---

## Common Mistakes

### ❌ Using anon key

```typescript
// WRONG - anon key cannot access decrypted views
const supabase = createClient(url, ANON_KEY);
const { data } = await supabase
  .from('integration_connections_decrypted')
  .select('*'); // ❌ Permission denied
```

### ✅ Using service_role key

```typescript
// CORRECT - service_role key can access decrypted views
const supabase = createClient(url, SERVICE_ROLE_KEY);
const { data } = await supabase
  .from('integration_connections_decrypted')
  .select('*'); // ✅ Works
```

### ❌ Accessing vault.secrets directly

```sql
-- WRONG - encrypted data
SELECT secret FROM vault.secrets WHERE id = 'some-id';
-- Returns: \x9f2d60954ba5eb566445736e0760b0e3... (encrypted)
```

### ✅ Using vault.decrypted_secrets

```sql
-- CORRECT - decrypted data
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = 'some-id';
-- Returns: your_actual_secret (decrypted)
```

---

## Troubleshooting

### "extension vault does not exist"

```sql
CREATE EXTENSION IF NOT EXISTS vault CASCADE;
```

### "permission denied for view"

Use service_role key, not anon key.

### "trigger not found"

Re-run migration:
```bash
psql $DATABASE_URL -f supabase/migrations/20260105000009_encrypt_credentials_vault.sql
```

---

## Next Steps

1. ✅ **Read Full Guide**: [VAULT_ENCRYPTION_GUIDE.md](./VAULT_ENCRYPTION_GUIDE.md)
2. ✅ **Update Application**: Use service_role for credential access
3. ✅ **Test Thoroughly**: Run test script in staging
4. ✅ **Monitor**: Check credential_access_log regularly

---

## Resources

- [Full Vault Guide](./VAULT_ENCRYPTION_GUIDE.md)
- [Supabase Vault Docs](https://supabase.com/docs/guides/database/vault)
- [Migration Script](../../supabase/migrations/20260105000009_encrypt_credentials_vault.sql)
- [Test Script](../../scripts/test-vault-encryption.sql)

---

## Support

**Questions?**
1. Check [VAULT_ENCRYPTION_GUIDE.md](./VAULT_ENCRYPTION_GUIDE.md)
2. Run test script: `scripts/test-vault-encryption.sql`
3. Review Supabase Vault documentation
4. Ask in Supabase Discord

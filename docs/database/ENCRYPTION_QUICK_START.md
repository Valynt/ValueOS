# Credential Encryption - Quick Start

**Status**: ✅ Ready to Deploy  
**Priority**: CRITICAL  
**Time to Deploy**: 30 minutes

---

## What This Fixes

🔴 **CRITICAL**: OAuth tokens and API keys are currently stored in plaintext JSONB columns. This migration encrypts them using `pgsodium`.

**Affected Tables**:
- `integration_connections.credentials` → encrypted
- `tenant_integrations.access_token` → encrypted
- `tenant_integrations.refresh_token` → encrypted

---

## Quick Deploy (Development)

### 1. Apply Migration (2 minutes)

```bash
# Apply the encryption migration
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/20260105000004_encrypt_credentials.sql
```

### 2. Test Encryption (5 minutes)

```bash
# Run test suite
psql $DATABASE_URL -f scripts/test-credential-encryption.sql
```

Expected output: All tests should show ✅

### 3. Migrate Existing Data (1 minute)

```sql
-- Connect to database
psql $DATABASE_URL

-- Run migration function
SELECT * FROM migrate_credentials_to_encrypted();
```

Expected output:
```
 table_name              | records_migrated | records_failed
-------------------------+------------------+----------------
 integration_connections |               X  |              0
 tenant_integrations     |               Y  |              0
```

### 4. Verify (2 minutes)

```sql
-- Check encryption status
SELECT * FROM credential_encryption_status;
```

Expected: `encryption_percentage` should be 100.00 for both tables.

---

## Application Code Changes

### Before (Plaintext)

```typescript
// ❌ OLD: Storing plaintext
const { data } = await supabase
  .from('integration_connections')
  .insert({
    credentials: { client_id: 'abc', client_secret: 'xyz' }
  });
```

### After (Encrypted)

```typescript
// ✅ NEW: Auto-encrypted by trigger
const { data } = await supabase
  .from('integration_connections')
  .insert({
    credentials: { client_id: 'abc', client_secret: 'xyz' }
  });
// Trigger automatically encrypts and clears plaintext

// ✅ NEW: Reading encrypted data (service_role only)
const { data } = await supabase
  .from('integration_connections_decrypted')
  .select('credentials')
  .eq('id', integrationId)
  .single();
// credentials is automatically decrypted
```

**Key Changes**:
1. Use `integration_connections_decrypted` view to read credentials
2. Use service role key (not anon key)
3. Triggers handle encryption automatically

---

## Production Deployment

### Phase 1: Deploy Encryption (Week 1)

**Day 1-2**: Development
```bash
# 1. Apply migration
supabase db push

# 2. Test thoroughly
psql $DATABASE_URL -f scripts/test-credential-encryption.sql

# 3. Migrate data
psql $DATABASE_URL -c "SELECT * FROM migrate_credentials_to_encrypted();"

# 4. Verify
psql $DATABASE_URL -c "SELECT * FROM credential_encryption_status;"
```

**Day 3-4**: Staging
```bash
# Same steps as development
# Test all integration flows
# Verify no errors
```

**Day 5**: Production
```bash
# Apply during low-traffic window
# Monitor closely
# Be ready to rollback
```

### Phase 2: Cleanup Plaintext (Week 2)

⚠️ **Only after 1 week of verification!**

```bash
# Apply cleanup migration
psql $DATABASE_URL -f supabase/migrations/20260105000005_cleanup_plaintext_credentials.sql

# Verify application still works
# Monitor for 1 week
# Delete backup tables
```

---

## Rollback Plan

### If Issues Occur

```sql
-- 1. Check what went wrong
SELECT * FROM credential_encryption_status;

-- 2. Restore from backup (if cleanup was run)
ALTER TABLE integration_connections ADD COLUMN credentials JSONB;
UPDATE integration_connections ic
SET credentials = b.credentials
FROM integration_connections_plaintext_backup b
WHERE ic.id = b.id;

-- 3. Revert migration
-- (Contact database team)
```

---

## Monitoring

### Check Encryption Status

```sql
-- Overall status
SELECT * FROM credential_encryption_status;

-- Recent credential access
SELECT * FROM credential_access_log 
ORDER BY accessed_at DESC 
LIMIT 20;
```

### Performance Impact

```sql
-- Check encryption/decryption performance
EXPLAIN ANALYZE
SELECT decrypt_credentials(credentials_encrypted, credentials_key_id)
FROM integration_connections
LIMIT 100;
```

Expected: < 1ms per operation

---

## Troubleshooting

### "Encryption key not found"

```sql
-- Check if key exists
SELECT * FROM pgsodium.key 
WHERE name = 'integration_credentials_key';

-- If missing, create it
INSERT INTO pgsodium.key (name, status, key_type, key_context)
VALUES ('integration_credentials_key', 'valid', 'aead-det', 'integration_credentials'::bytea);
```

### "Permission denied for view"

```typescript
// Use service role key, not anon key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Not ANON_KEY
);
```

### Credentials not encrypting

```sql
-- Check trigger exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'integration_connections'::regclass;

-- Should show: encrypt_credentials_before_insert | O (enabled)
```

---

## Files Created

1. **Migration**: `supabase/migrations/20260105000004_encrypt_credentials.sql`
2. **Cleanup**: `supabase/migrations/20260105000005_cleanup_plaintext_credentials.sql`
3. **Tests**: `scripts/test-credential-encryption.sql`
4. **Guide**: `docs/database/CREDENTIAL_ENCRYPTION_GUIDE.md` (detailed)
5. **Quick Start**: `docs/database/ENCRYPTION_QUICK_START.md` (this file)

---

## Checklist

### Development
- [ ] Apply migration
- [ ] Run tests (all pass)
- [ ] Migrate existing data
- [ ] Verify encryption status
- [ ] Update application code
- [ ] Test all integration flows

### Staging
- [ ] Apply migration
- [ ] Migrate existing data
- [ ] Test thoroughly
- [ ] Monitor for 2-3 days
- [ ] No errors detected

### Production
- [ ] Schedule deployment window
- [ ] Apply migration
- [ ] Migrate existing data
- [ ] Verify immediately
- [ ] Monitor closely for 1 week
- [ ] Apply cleanup migration (after 1 week)
- [ ] Delete backup tables (after 2 weeks)

---

## Support

- **Detailed Guide**: `docs/database/CREDENTIAL_ENCRYPTION_GUIDE.md`
- **Test Script**: `scripts/test-credential-encryption.sql`
- **Migration File**: `supabase/migrations/20260105000004_encrypt_credentials.sql`

---

**Last Updated**: January 5, 2026  
**Status**: Production Ready  
**Estimated Time**: 30 minutes (dev), 2-3 weeks (full production rollout)

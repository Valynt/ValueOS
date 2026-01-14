# Database Migrations - Quick Reference

**TL;DR**: Migrations are self-contained. Just run them. No config needed.

---

## ⚡ Quick Deploy

```bash
# 1. Backup
pg_dump $DATABASE_URL > backup.sql

# 2. Deploy all migrations
for f in supabase/migrations/202601050000{1,2,3,9,6,7,8}.sql; do
  psql $DATABASE_URL -f $f
done

# 3. Migrate credentials to Vault
psql $DATABASE_URL -c "SELECT * FROM migrate_credentials_to_vault();"

# 4. Test
psql $DATABASE_URL -f scripts/test-vault-encryption.sql
```

**Time**: 15 minutes  
**Risk**: Low (migrations are additive)

---

## 📋 Prerequisites

### Required ✅
- PostgreSQL 15+
- Supabase Vault extension (included with Supabase)

### Check
```bash
psql $DATABASE_URL -c "SELECT version();"
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vault CASCADE;"
```

### Vault Extension

**Supabase**: Already installed ✅

**Self-hosted Supabase**:
```sql
CREATE EXTENSION IF NOT EXISTS vault CASCADE;
```

**Note**: Vault is a Supabase extension. For non-Supabase deployments, consider application-level encryption.

---

## 🎯 What Gets Fixed

- ✅ Credentials encrypted (Supabase Vault)
- ✅ All tables have RLS
- ✅ No JWT vulnerabilities
- ✅ Audit logs immutable
- ✅ Foreign keys have actions
- ✅ Performance indexes added

---

## 📚 Documentation

| Topic | File |
|-------|------|
| **Quick Deploy** | `FINAL_DEPLOYMENT_GUIDE.md` |
| **Environment Setup** | `ENVIRONMENT_CONFIG_GUIDE.md` |
| **Full Status** | `COMPLETE_STATUS_UPDATE.md` |
| **Encryption** | `VAULT_ENCRYPTION_GUIDE.md` |
| **Old (Deprecated)** | `CREDENTIAL_ENCRYPTION_GUIDE.md` |

---

## 🆘 Troubleshooting

**Vault extension not found?**
```sql
-- Enable Vault extension
CREATE EXTENSION IF NOT EXISTS vault CASCADE;
```

**Permission denied?**
```sql
ALTER USER your_user WITH SUPERUSER;
```

**Slow queries?**
```sql
-- Already fixed by migrations!
-- Verify indexes:
\di+ idx_user_tenants_user_tenant_active
```

---

## ✅ Verification

```bash
# All tests should pass
psql $DATABASE_URL -f scripts/test-vault-encryption.sql
psql $DATABASE_URL -f scripts/test-jwt-rls-fix.sql
psql $DATABASE_URL -f scripts/test-archive-tables-rls.sql
psql $DATABASE_URL -f scripts/test-foreign-key-actions.sql
```

---

## 🚀 Ready?

See `FINAL_DEPLOYMENT_GUIDE.md` for detailed steps.

**Status**: 🟢 Production Ready

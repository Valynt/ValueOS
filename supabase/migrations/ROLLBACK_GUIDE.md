# Database Migration Rollback Guide

## Overview

This guide documents rollback procedures for all database migrations.  
**CRITICAL:** Always backup before applying OR rolling back migrations.

---

## Rollback Procedure

### 1. Create Backup (REQUIRED)

```bash
# Full database backup
supabase db dump > backup_$(date +%Y%m%d_%H%M%S).sql

# Specific tables only
supabase db dump --exclude-table-data 'audit_logs' > backup_schema.sql
```

### 2. Test Rollback in Staging

```bash
# Never rollback in production first!
SUPABASE_URL=https://staging.supabase.co psql < rollback_script.sql
```

### 3. Execute Rollback

```bash
# Apply rollback migration
supabase db push --file migrations/rollback/YYYYMMDD_migration_name_rollback.sql
```

---

## Migration Rollbacks

### 20241129_strict_rls_policies.sql

**Created:** 2024-11-29  
**Purpose:** Comprehensive RLS policies for tenant isolation

**Rollback Script:** `rollback/20241129_strict_rls_policies_rollback.sql`

**Rollback Steps:**
1. Drop all new RLS policies
2. Drop security_audit_log table
3. Drop audit trigger function
4. Drop performance indexes
5. Disable RLS on affected tables (if previously disabled)

**Data Impact:**
- ⚠️ security_audit_log will be permanently deleted
- ✅ No data loss in main tables
- ⚠️ Tables become accessible without RLS (security risk!)

**Verification:**
```sql
-- Check RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show FALSE for RLS after rollback
```

---

## Rollback Safety Checklist

Before rolling back ANY migration:

- [ ] Full database backup created
- [ ] Rollback tested in staging environment
- [ ] All dependent services/features identified
- [ ] Downtime window scheduled (if needed)
- [ ] Team notified
- [ ] Rollback script reviewed by 2+ people
- [ ] Monitoring alerts configured
- [ ] Rollforward plan documented (if rollback fails)

---

## Emergency Rollback

If production is broken and you need to rollback immediately:

### Quick Rollback (Last Migration)

```bash
# 1. BACKUP FIRST!
supabase db dump > emergency_backup.sql

# 2. Revert last migration
supabase db reset --version <previous_version>

# 3. Verify
supabase db remote commit
```

### Point-in-Time Recovery (Supabase Pro)

```bash
# Restore to timestamp before bad migration
supabase db restore --timestamp "2024-11-29T10:00:00Z"
```

---

## Common Rollback Scenarios

### Scenario 1: RLS Policy Breaks Application

**Symptoms:**
- Users can't access their data
- "permission denied" errors
- Empty query results

**Quick Fix:**
```sql
-- Temporarily disable RLS (EMERGENCY ONLY)
ALTER TABLE <table_name> DISABLE ROW LEVEL SECURITY;

-- Then rollback properly
```

### Scenario 2: Performance Degradation

**Symptoms:**
- Slow queries after adding indexes
- Timeout errors
- High CPU usage

**Quick Fix:**
```sql
-- Drop problematic indexes
DROP INDEX CONCURRENTLY idx_name;

-- Then rollback properly
```

### Scenario 3: Data Corruption

**Symptoms:**
- NULL values where they shouldn't be
- Foreign key violations
- Type mismatches

**Fix:**
```bash
# Restore from backup immediately
psql < backup_YYYYMMDD_HHMMSS.sql
```

---

## Rollback Testing

### Pre-Deployment Test

```bash
# 1. Create test database
createdb test_rollback

# 2. Apply migration
psql test_rollback < migrations/20241129_strict_rls_policies.sql

# 3. Insert test data
psql test_rollback < test_data.sql

# 4. Apply rollback
psql test_rollback < rollback/20241129_strict_rls_policies_rollback.sql

# 5. Verify data integrity
psql test_rollback -c "SELECT COUNT(*) FROM user_tenants;"

# 6. Cleanup
dropdb test_rollback
```

---

## Monitoring After Rollback

### Key Metrics to Watch

1. **Error Rate**
   ```sql
   SELECT COUNT(*) FROM error_logs 
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

2. **Query Performance**
   ```sql
   SELECT query, calls, mean_exec_time 
   FROM pg_stat_statements 
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   ```

3. **RLS Policy Hits**
   ```sql
   SELECT * FROM security_audit_log 
   WHERE event_type = 'rls_violation' 
   AND created_at > NOW() - INTERVAL '1 hour';
   ```

---

## Best Practices

### DO:
✅ Always backup before rollback  
✅ Test rollback in staging first  
✅ Document rollback steps  
✅ Monitor after rollback  
✅ Keep rollback scripts in version control  
✅ Practice rollbacks in dev environment  

### DON'T:
❌ Rollback in production without backup  
❌ Skip staging testing  
❌ Rollback during peak hours (if avoidable)  
❌ Delete rollback scripts after migration  
❌ Assume rollback will work without testing  
❌ Forget to notify team  

---

## Rollback Decision Matrix

| Severity | Impact | Action |
|----------|--------|--------|
| **Critical** | Data loss/corruption | Immediate rollback + restore from backup |
| **High** | Application broken | Rollback within 15 minutes |
| **Medium** | Degraded performance | Scheduled rollback within 1 hour |
| **Low** | Minor issues | Fix forward or schedule rollback |

---

## Support

### If Rollback Fails:

1. **Stop all writes**
   ```sql
   REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM public;
   ```

2. **Restore from backup**
   ```bash
   psql < backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Contact Supabase Support**
   - Include: Migration file, error logs, backup timestamp
   - Slack: #database-emergencies
   - Email: support@supabase.io

### Escalation Path:

1. Database Admin (immediate)
2. Engineering Lead (< 15 min)
3. CTO (if data loss)
4. Supabase Support (if platform issue)

---

## Appendix: SQL Templates

### Template: Drop All Policies for Table

```sql
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = '<table_name>'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 
                      pol.policyname, '<table_name>');
    END LOOP;
END $$;
```

### Template: Disable RLS on All Tables

```sql
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', 
                      tbl.tablename);
    END LOOP;
END $$;
```

---

**Last Updated:** 2024-11-29  
**Maintainer:** Database Team  
**Review Schedule:** Monthly

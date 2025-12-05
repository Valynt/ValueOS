# Migration Strategies - Complete Guide

**Database:** PostgreSQL + Supabase  
**Tool:** Supabase CLI  
**Last Updated:** December 1, 2025

---

## 🎯 **Overview**

This guide covers safe, production-ready migration strategies for ValueCanvas database changes, including zero-downtime deployments, rollback procedures, and testing strategies.

---

## 📊 **Migration Types**

### **1. Schema Migrations**
- Adding/removing tables
- Modifying columns
- Creating indexes
- Adding constraints

**Risk Level:** 🟡 Medium to High  
**Requires:** Careful planning, testing

---

### **2. Data Migrations**
- Backfilling data
- Transforming existing data
- Moving data between tables

**Risk Level:** 🔴 High  
**Requires:** Rollback plan, chunking strategy

---

### **3. RLS Policy Changes**
- Adding/modifying policies
- Changing permissions
- Security hardening

**Risk Level:** 🟡 Medium  
**Requires:** Permission testing, service role verification

---

### **4. Function/Trigger Changes**
- Creating/updating functions
- Modifying triggers
- Stored procedure changes

**Risk Level:** 🟡 Medium  
**Requires:** Logic verification, rollback SQL

---

## 🛡️ **Core Principles**

### **1. Always Backwards Compatible**
```sql
-- ❌ BAD: Breaking change
ALTER TABLE users DROP COLUMN email;

-- ✅ GOOD: Backwards compatible
-- Phase 1: Add new column
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Phase 2 (later): Application uses new column

-- Phase 3 (much later): Remove old column if needed
```

---

### **2. Multi-Phase Migrations**

**Example: Renaming a Column**

**Phase 1:** Add new column
```sql
-- Migration: 20251201_000001_add_new_column.sql
ALTER TABLE users ADD COLUMN full_name TEXT;
```

**Phase 2:** Backfill data
```sql
-- Migration: 20251201_000002_backfill_names.sql
UPDATE users 
SET full_name = first_name || ' ' || last_name 
WHERE full_name IS NULL;
```

**Phase 3:** Application deployment (uses both columns)

**Phase 4:** Make required + drop old
```sql
-- Migration: 20251201_000003_finalize_rename.sql
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
-- Wait for confirmation all is good
-- ALTER TABLE users DROP COLUMN first_name;
-- ALTER TABLE users DROP COLUMN last_name;
```

---

### **3. Zero-Downtime Strategy**

**Principle:** Old code works during migration, new code works after.

**Technique: Expand-Contract Pattern**
1. **Expand:** Add new schema elements (compatible with old code)
2. **Migrate:** Deploy new application code
3. **Contract:** Remove old schema elements (after verification)

**Example: Adding NOT NULL Constraint**
```sql
-- ❌ BAD: Instant failure for old code
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- ✅ GOOD: Gradual migration
-- Phase 1: Add constraint as NOT VALID (no downtime)
ALTER TABLE users ADD CONSTRAINT users_email_not_null 
  CHECK (email IS NOT NULL) NOT VALID;

-- Phase 2: Backfill nulls
UPDATE users SET email = 'unknown@example.com' WHERE email IS NULL;

-- Phase 3: Validate constraint (can be done online)
ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;

-- Phase 4: Convert to proper NOT NULL (fast, uses constraint)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
DROP CONSTRAINT users_email_not_null;
```

---

## 📋 **Migration Workflow**

### **Standard Migration Process**

```
1. Design
   ↓
2. Write Migration SQL
   ↓
3. Write Rollback SQL
   ↓
4. Test Locally
   ↓
5. Test on Staging
   ↓
6. Backup Production
   ↓
7. Apply to Production
   ↓
8. Verify
   ↓
9. Monitor (24-48 hours)
   ↓
10. Mark Complete
```

---

### **Step-by-Step Guide**

#### **Step 1: Design (30 min - 2 hours)**

**Questions to answer:**
- What problem are we solving?
- Can this be done in phases?
- What's the rollback strategy?
- Will this cause downtime?
- What's the impact on existing queries?
- Are indexes needed?

**Design checklist:**
- [ ] Breaking changes identified
- [ ] Multi-phase plan created (if needed)
- [ ] Rollback strategy defined
- [ ] Performance impact assessed
- [ ] RLS policies updated (if table changes)

---

#### **Step 2: Write Migration SQL (30 min - 1 hour)**

**Template:**
```sql
-- ============================================================================
-- Migration: [Description]
-- ============================================================================
-- Date: YYYY-MM-DD
-- Author: Your Name
-- Type: [Schema/Data/RLS/Function]
-- Risk: [Low/Medium/High]
-- Rollback: See rollbacks/YYYYMMDD_HHMMSS_rollback.sql
-- 
-- Changes:
-- - List all changes
-- - Be specific
--
-- Dependencies:
-- - Previous migrations required
-- - Application version compatibility
--
-- Testing:
-- - Test scenarios covered
-- - Edge cases verified
-- ============================================================================

-- Safety checks
DO $$
BEGIN
  -- Example: Check if table exists before creating
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'new_table') THEN
    RAISE EXCEPTION 'Table new_table already exists';
  END IF;
END $$;

-- Main migration
BEGIN;

-- Your changes here
CREATE TABLE new_table (...);

-- Verify
SELECT COUNT(*) FROM new_table;

COMMIT;

-- Post-migration verification
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM new_table;
  RAISE NOTICE 'Migration complete. Rows in new_table: %', row_count;
END $$;
```

---

#### **Step 3: Write Rollback SQL (15-30 min)**

**Always create a rollback file!**

```sql
-- ============================================================================
-- Rollback: [Original Migration Description]
-- ============================================================================
-- Date: YYYY-MM-DD
-- Rollback for: migrations/YYYYMMDD_HHMMSS_migration_name.sql
-- 
-- Steps to rollback:
-- 1. Backup current state
-- 2. Run this script
-- 3. Verify application still works
-- 4. Monitor for issues
-- ============================================================================

BEGIN;

-- Reverse changes in reverse order
DROP TABLE IF EXISTS new_table;

-- Restore previous state if needed
-- (Include backfill data if dropped columns)

COMMIT;

-- Verification
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'new_table') THEN
    RAISE EXCEPTION 'Rollback failed: new_table still exists';
  END IF;
  RAISE NOTICE 'Rollback successful';
END $$;
```

**Rollback file location:**
```
supabase/
  migrations/
    20251201_000001_add_feature.sql
  rollbacks/
    20251201_000001_rollback.sql  ← Same timestamp
```

---

#### **Step 4: Test Locally (30 min)**

**Setup test database:**
```bash
# Start local Supabase
supabase start

# Reset to clean state
supabase db reset

# Apply migrations
supabase db push

# Verify
supabase db diff
```

**Testing checklist:**
- [ ] Migration runs without errors
- [ ] All tables/columns created correctly
- [ ] RLS policies work as expected
- [ ] Indexes created successfully
- [ ] Data integrity maintained
- [ ] Application code still works
- [ ] Rollback works correctly

**Test queries:**
```sql
-- Verify table structure
\d table_name

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Test with different users
SET LOCAL "request.jwt.claims" TO '{"sub": "user-uuid"}';
SELECT * FROM table_name;  -- Should respect RLS

-- Performance check
EXPLAIN ANALYZE SELECT * FROM table_name WHERE user_id = 'uuid';
```

---

#### **Step 5: Test on Staging (1-2 hours)**

**Staging environment checklist:**
- [ ] Backup staging database
- [ ] Apply migration
- [ ] Run automated tests
- [ ] Manual smoke testing
- [ ] Performance testing
- [ ] Monitor for 30 minutes
- [ ] Test rollback
- [ ] Restore from backup

**Commands:**
```bash
# Backup staging
supabase db dump -f staging-backup-$(date +%Y%m%d).sql --db-url $STAGING_DATABASE_URL

# Apply migration
supabase db push --db-url $STAGING_DATABASE_URL

# Run tests
npm test

# Monitor
watch -n 5 'psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM table_name"'

# Rollback test
psql $STAGING_DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql
```

---

#### **Step 6: Backup Production (15 min)**

**Critical: Always backup before production changes!**

```bash
# Automated backup
supabase db dump -f production-backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh production-backup-*.sql
wc -l production-backup-*.sql  # Should have content

# Test restore (on local)
createdb test_restore
psql test_restore < production-backup-*.sql
# Verify tables exist
psql test_restore -c "\dt"
```

**Backup storage:**
- Store in multiple locations (S3, local, team drive)
- Keep for at least 30 days
- Encrypt sensitive backups

---

#### **Step 7: Apply to Production (5-30 min)**

**Pre-flight checklist:**
- [ ] Backup completed and verified
- [ ] Staging tests passed
- [ ] Team notified
- [ ] Rollback plan ready
- [ ] Monitoring dashboard open
- [ ] Off-hours deployment (if high-risk)

**Deployment:**
```bash
# 1. Final verification
supabase db diff --db-url $PRODUCTION_DATABASE_URL

# 2. Apply migration
supabase db push --db-url $PRODUCTION_DATABASE_URL

# 3. Immediate verification
psql $PRODUCTION_DATABASE_URL -c "
  SELECT tablename, schemaname 
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY tablename;
"
```

---

#### **Step 8: Verify (15 min)**

**Post-deployment checks:**

```sql
-- 1. Schema verification
\d+ table_name

-- 2. RLS policy verification
SELECT * FROM pg_policies 
WHERE tablename = 'table_name';

-- 3. Data integrity
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM table_name;

-- 4. Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'table_name';

-- 5. Performance check
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM table_name 
WHERE user_id = 'test-uuid' 
LIMIT 10;
```

**Application verification:**
- [ ] Health check endpoint responding
- [ ] Critical user flows working
- [ ] No error spikes in logs
- [ ] Response times normal

---

#### **Step 9: Monitor (24-48 hours)**

**What to monitor:**

1. **Error rates**
```sql
-- Check for new errors
SELECT 
  COUNT(*) as error_count,
  error_message,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM error_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_message
ORDER BY error_count DESC;
```

2. **Query performance**
```sql
-- Slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- >1 second
ORDER BY mean_exec_time DESC
LIMIT 10;
```

3. **RLS policy violations**
```sql
-- Check for permission errors
SELECT COUNT(*) 
FROM logs 
WHERE message LIKE '%insufficient_privilege%'
  AND created_at > NOW() - INTERVAL '1 hour';
```

4. **Database metrics**
- Connection count
- CPU usage
- Memory usage
- Disk I/O
- Replication lag (if applicable)

---

#### **Step 10: Mark Complete**

**Documentation:**
```markdown
## Migration: [Name]
**Date Applied:** 2025-12-01  
**Status:** ✅ Complete  
**Issues:** None  
**Rollback:** Not needed  

### Post-Migration Notes:
- All tests passed
- No performance degradation
- Monitored for 48 hours
- No issues reported

### Metrics:
- Rows affected: 1,234,567
- Migration time: 5 minutes
- Downtime: 0 seconds
- Rollback time (if needed): ~2 minutes
```

---

## ⚠️ **High-Risk Migrations**

### **Strategy 1: Blue-Green Deployment**

**Use when:** Major schema changes, high-traffic tables

**Process:**
1. Create new "green" table with new schema
2. Dual-write to both tables (application change)
3. Backfill green table from blue
4. Switch reads to green (application change)
5. Stop writes to blue
6. Verify green is working
7. Drop blue table

**Example:**
```sql
-- Phase 1: Create green table
CREATE TABLE users_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,  -- New schema
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 2: Dual write (application code)
-- INSERT INTO users (...);
-- INSERT INTO users_v2 (...);

-- Phase 3: Backfill
INSERT INTO users_v2 (id, email, full_name, created_at)
SELECT 
  id, 
  email, 
  first_name || ' ' || last_name,
  created_at
FROM users
WHERE id NOT IN (SELECT id FROM users_v2);

-- Phase 4: Switch reads (application code)
-- SELECT * FROM users_v2;

-- Phase 5: Rename (after verification)
BEGIN;
ALTER TABLE users RENAME TO users_old;
ALTER TABLE users_v2 RENAME TO users;
COMMIT;

-- Phase 6: Cleanup (days later)
-- DROP TABLE users_old;
```

---

### **Strategy 2: Shadow Deployment**

**Use when:** Complex logic changes, uncertain performance impact

**Process:**
1. Deploy new code that runs in "shadow mode"
2. Execute both old and new logic
3. Log discrepancies
4. Compare results
5. Fix issues in new logic
6. Switch to new logic
7. Remove old logic

---

### **Strategy 3: Feature Flags**

**Use when:** Want to enable/disable migration effects

```sql
-- Add feature flag
INSERT INTO feature_flags (flag_key, flag_value, description)
VALUES (
  'use_new_schema',
  'false',
  'Enable new users table schema'
);

-- Application code checks flag
-- if (isFeatureEnabled('use_new_schema')) {
--   useNewTable();
-- } else {
--   useOldTable();
-- }
```

---

## 🔄 **Data Migration Patterns**

### **Pattern 1: Chunked Migration**

**Use when:** Large tables (millions of rows)

```sql
-- Backfill in chunks to avoid lock timeouts
DO $$
DECLARE
  batch_size INTEGER := 1000;
  offset_val INTEGER := 0;
  rows_updated INTEGER;
BEGIN
  LOOP
    -- Update in small batches
    WITH batch AS (
      SELECT id 
      FROM users 
      WHERE full_name IS NULL
      LIMIT batch_size
      OFFSET offset_val
    )
    UPDATE users u
    SET full_name = u.first_name || ' ' || u.last_name
    FROM batch b
    WHERE u.id = b.id;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    EXIT WHEN rows_updated = 0;
    
    offset_val := offset_val + batch_size;
    
    -- Progress logging
    RAISE NOTICE 'Updated % rows (offset: %)', rows_updated, offset_val;
    
    -- Brief pause to avoid overwhelming database
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE NOTICE 'Migration complete! Total processed: %', offset_val;
END $$;
```

---

### **Pattern 2: Background Migration**

**Use when:** Migration can take hours/days

```sql
-- Create migration tracking table
CREATE TABLE migration_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  last_processed_id UUID,
  rows_processed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Migration function (called periodically)
CREATE OR REPLACE FUNCTION migrate_users_batch()
RETURNS INTEGER AS $$
DECLARE
  batch_size INTEGER := 1000;
  rows_updated INTEGER;
  last_id UUID;
BEGIN
  -- Get last processed ID
  SELECT last_processed_id INTO last_id
  FROM migration_progress
  WHERE migration_name = 'backfill_full_names'
  FOR UPDATE;
  
  -- Process batch
  WITH batch AS (
    SELECT id
    FROM users
    WHERE (last_id IS NULL OR id > last_id)
      AND full_name IS NULL
    ORDER BY id
    LIMIT batch_size
  )
  UPDATE users u
  SET full_name = u.first_name || ' ' || u.last_name
  FROM batch b
  WHERE u.id = b.id
  RETURNING u.id INTO last_id;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Update progress
  UPDATE migration_progress
  SET 
    last_processed_id = last_id,
    rows_processed = rows_processed + rows_updated,
    status = CASE WHEN rows_updated = 0 THEN 'completed' ELSE 'running' END,
    completed_at = CASE WHEN rows_updated = 0 THEN NOW() ELSE NULL END
  WHERE migration_name = 'backfill_full_names';
  
  RETURN rows_updated;
END;
$$ LANGUAGE plpgsql;

-- Run periodically (cron job or pg_cron)
-- SELECT migrate_users_batch();
```

---

## 🚨 **Emergency Procedures**

### **When to Rollback**

**Immediate rollback if:**
- Error rate > 5%
- Critical functionality broken
- Data corruption detected
- Performance degradation > 50%
- Security vulnerability introduced

**Rollback procedure:**
```bash
# 1. Announce incident
# Notify team immediately

# 2. Execute rollback
psql $PRODUCTION_DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql

# 3. Verify rollback
psql $PRODUCTION_DATABASE_URL -c "
  -- Check tables are back to original state
  \d table_name
"

# 4. Restart application (if needed)
# Force reload of schema

# 5. Verify application working
# Check health endpoints, run smoke tests

# 6. Monitor recovery
# Watch error rates return to normal
```

---

### **Partial Failure Recovery**

**If migration partially completes:**

```sql
-- Check migration state
SELECT 
  schemaname,
  tablename,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables
WHERE tablename = 'partially_created_table';

-- Determine what completed
-- Option 1: Complete the migration
-- Re-run migration (with IF NOT EXISTS checks)

-- Option 2: Rollback what completed
BEGIN;
-- Reverse completed steps
DROP TABLE IF EXISTS partially_created_table;
COMMIT;
```

---

## 📝 **Migration Naming Convention**

```
YYYYMMDD_HHMMSS_description.sql

Examples:
20251201_140000_add_user_preferences.sql
20251201_140001_create_rls_helper_functions.sql
20251201_140002_backfill_user_names.sql
```

**Description guidelines:**
- Use underscores, not spaces
- Be specific and descriptive
- Include action (add, create, update, remove)
- Limit to 50 characters

---

## ✅ **Best Practices Checklist**

### **Before Every Migration:**
- [ ] Migration tested locally
- [ ] Migration tested on staging
- [ ] Rollback script created and tested
- [ ] Database backed up
- [ ] Team notified (if high-risk)
- [ ] Monitoring dashboard ready
- [ ] Off-hours deployment (if high-risk)

### **Migration Content:**
- [ ] Idempotent (can run multiple times safely)
- [ ] Uses transactions where appropriate
- [ ] Includes IF EXISTS/IF NOT EXISTS checks
- [ ] Has progress logging
- [ ] Validates completion
- [ ] Well-commented

### **After Migration:**
- [ ] Immediate verification completed
- [ ] Application still functioning
- [ ] No error spikes
- [ ] Performance within normal range
- [ ] Monitoring for 24-48 hours
- [ ] Documentation updated

---

## 📚 **Quick Reference**

### **Safe Migration Commands**
```bash
# Local testing
supabase db reset
supabase db push

# Staging deployment
supabase db push --db-url $STAGING_DATABASE_URL

# Production deployment
supabase db dump -f backup.sql
supabase db push --db-url $PRODUCTION_DATABASE_URL

# Rollback
psql $DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql
```

### **Verification Queries**
```sql
-- Check table structure
\d+ table_name

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';

-- Check indexes
\di+ index_name

-- Check constraints
\d+ table_name  -- Shows constraints
```

---

**Last Updated:** December 1, 2025  
**Next Review:** Quarterly

# Migration Guide

**Last Updated**: 2026-02-08

**Consolidated from 2 source documents**

---

## Table of Contents

1. [Legacy Business Cases Deprecation Plan](#legacy-business-cases-deprecation-plan)
2. [Migration Quick Reference](#migration-quick-reference)

---

## Legacy Business Cases Deprecation Plan

_Source: `engineering/migration/DEPRECATION_PLAN.md`_

## Context

The `business_cases` table is a legacy artifact that has been superseded by the `value_cases` table and its associated `ValueCaseService`. To maintain a clean architecture and prevent logic divergence, we are deprecating the `business_cases` table and the `PersistenceService` methods that rely on it.

## Deprecation Strategy

### Phase 1: Soft Deprecation (Current)

- **Flag:** `DISABLE_LEGACY_BUSINESS_CASES = false` (default)
- **Behavior:**
  - `ValueCaseService` prefers `value_cases` but falls back to `business_cases` for reads.
  - `CanvasSchemaService` prefers `value_cases` but falls back to `business_cases` for reads.
  - Usage of legacy paths logs a warning: `DEPRECATION: ...`.
  - New writes (create/update) via legacy paths are still allowed but logged.

### Phase 2: Write Block (Next Step)

- **Flag:** `DISABLE_LEGACY_BUSINESS_CASES = true`
- **Behavior:**
  - `PersistenceService` throws errors on write operations (`createBusinessCase`, `updateBusinessCase`).
  - `ValueCaseService` throws errors if legacy paths are attempted for writes.
  - Reads may still work via direct SQL fallbacks in some places if not fully guarded, but services should return `null` or empty arrays.

### Phase 3: Data Migration

- Run a migration script to move all valid `business_cases` records to `value_cases`.
- Map metadata fields:
  - `business_cases.client` -> `value_cases.company_profiles(company_name)` (may require creating profiles)
  - `business_cases.metadata.stage` -> `value_cases.metadata.stage`
  - `business_cases.status` -> `value_cases.status` (map 'presented' -> 'completed')

### Phase 4: Code Removal

- Remove `business_cases` table from `database.types.ts`.
- Remove `PersistenceService.ts` methods related to business cases.
- Remove fallback logic from `ValueCaseService.ts` and `CanvasSchemaService.ts`.
- Remove `DISABLE_LEGACY_BUSINESS_CASES` feature flag.

## Key Changes

- **Feature Flag:** Added `DISABLE_LEGACY_BUSINESS_CASES` to `src/config/featureFlags.ts`.
- **ValueCaseService:** Updated to check flag and warn on fallback.
- **CanvasSchemaService:** Updated to prioritize `value_cases` and warn/block legacy fallback.
- **PersistenceService:** Marked legacy methods as deprecated with logging and flag checks.

## Monitoring

- Monitor logs for `DEPRECATION:` warnings to identify remaining legacy usage.
- Track errors related to `Updates to legacy business cases are disabled` to identify blocked workflows.

---

## Migration Quick Reference

_Source: `engineering/migrations/MIGRATION_QUICK_REFERENCE.md`_

**Keep this handy!** 📌

---

## 🚀 **Essential Commands**

### **Local Development**

```bash
# Reset database (DESTRUCTIVE)
supabase db reset

# Apply all migrations
supabase db push

# Check what would change
supabase db diff

# Generate types
supabase gen types typescript --local > src/lib/database.types.ts

# Create new migration
supabase migration new my_migration_name
```

---

### **Staging/Production**

```bash
# Backup database (DO THIS FIRST!)
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql --db-url $DB_URL

# Check pending migrations
supabase db diff --db-url $DB_URL

# Apply migrations
supabase db push --db-url $DB_URL

# Rollback (manual)
psql $DB_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql
```

---

## 📝 **Quick Workflow**

### **1. Create Migration (2 min)**

```bash
# Create file
supabase migration new add_user_preferences

# Copy template
cp supabase/migrations/TEMPLATE_migration.sql \
   supabase/migrations/$(date +%Y%m%d_%H%M%S)_add_user_preferences.sql

# Edit the file
```

---

### **2. Test Locally (5 min)**

```bash
# Reset and apply
supabase db reset
supabase db push

# Verify
psql postgresql://postgres:postgres@localhost:54322/postgres -c "\d+ new_table"

# Test app
pnpm run dev
pnpm run test
```

---

### **3. Deploy to Production (10 min)**

```bash
# BACKUP FIRST!
supabase db dump -f backup.sql

# Deploy
supabase db push

# Verify immediately
psql $DATABASE_URL -c "SELECT COUNT(*) FROM new_table;"
```

---

## 🔄 **Common Patterns**

### **Add Table**

```sql
CREATE TABLE IF NOT EXISTS table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_table_user ON table_name(user_id);

-- RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Service role bypass (ALWAYS!)
CREATE POLICY "service_role_bypass" ON table_name FOR ALL TO service_role USING (true);

-- User policy
CREATE POLICY "users_own_data" ON table_name FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

### **Add Column**

```sql
-- Add column (backwards compatible)
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Add index
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING gin(preferences);

-- Backfill (optional)
UPDATE users SET preferences = '{"theme": "light"}' WHERE preferences = '{}';
```

---

### **Add Index (No Downtime)**

```sql
-- Create index concurrently (doesn't block writes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
```

---

### **Add NOT NULL (Safe)**

```sql
-- Phase 1: Add CHECK constraint (NOT VALID = no table scan)
ALTER TABLE users ADD CONSTRAINT users_email_not_null
  CHECK (email IS NOT NULL) NOT VALID;

-- Phase 2: Backfill
UPDATE users SET email = 'unknown@example.com' WHERE email IS NULL;

-- Phase 3: Validate (can be done online)
ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;

-- Phase 4: Convert to NOT NULL (fast)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
DROP CONSTRAINT users_email_not_null;
```

---

### **Rename Column (Multi-Phase)**

```sql
-- Phase 1: Add new column
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Phase 2: Dual write (application code)
-- INSERT INTO users (name, full_name) VALUES (..., ...);

-- Phase 3: Backfill
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Phase 4 (later): Drop old column
-- ALTER TABLE users DROP COLUMN name;
```

---

### **Data Migration (Chunked)**

```sql
DO $$
DECLARE
  batch_size INTEGER := 1000;
  rows_updated INTEGER;
BEGIN
  LOOP
    UPDATE users
    SET full_name = first_name || ' ' || last_name
    WHERE full_name IS NULL
    LIMIT batch_size;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;

    RAISE NOTICE 'Updated % rows', rows_updated;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

---

## 🔍 **Verification Queries**

### **Check Table**

```sql
\d+ table_name
```

### **Check RLS Policies**

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'table_name';
```

### **Check Indexes**

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'table_name';
```

### **Test RLS**

```sql
-- Simulate user
SET LOCAL "request.jwt.claims" TO '{"sub": "user-uuid"}';
SELECT * FROM table_name;
RESET "request.jwt.claims";
```

### **Check Performance**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM table_name WHERE user_id = 'uuid';
```

---

## 🚨 **Emergency Rollback**

### **Quick Rollback**

```bash
# 1. Run rollback SQL
psql $DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql

# 2. Verify
psql $DATABASE_URL -c "\d+ table_name"

# 3. Restart app (if needed)
# Force schema reload
```

---

### **Restore from Backup**

```bash
# 1. Create new database
createdb restored_db

# 2. Restore backup
psql restored_db < backup.sql

# 3. Verify data
psql restored_db -c "SELECT COUNT(*) FROM users;"

# 4. Switch connection string (if satisfied)
# Update DATABASE_URL to point to restored_db
```

---

## ⚠️ **Common Mistakes**

### **❌ Don't Do This**

```sql
-- Breaking change (downtime)
ALTER TABLE users DROP COLUMN email;

-- Slow (locks table)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- No rollback
-- (always create rollback file!)

-- No service role bypass
-- (backend can't access data!)
```

---

### **✅ Do This Instead**

```sql
-- Gradual removal
ALTER TABLE users ADD COLUMN email_v2 TEXT;
-- ... dual write, backfill, switch ...
-- DROP COLUMN email (much later)

-- Fast NOT NULL
ALTER TABLE users ADD CONSTRAINT check_not_null CHECK (email IS NOT NULL) NOT VALID;
-- ... backfill, validate, convert ...

-- Always create rollback
-- See supabase/rollbacks/TEMPLATE_rollback.sql

-- Always add service role bypass
CREATE POLICY "service_role_bypass" ON table_name FOR ALL TO service_role USING (true);
```

---

## 📊 **Risk Assessment**

| Change         | Risk      | Backup Required? | Test on Staging? |
| -------------- | --------- | ---------------- | ---------------- |
| Add table      | 🟢 Low    | Recommended      | Optional         |
| Add column     | 🟢 Low    | Recommended      | Optional         |
| Add index      | 🟢 Low    | Optional         | Optional         |
| Add RLS policy | 🟡 Medium | Required         | Required         |
| Modify column  | 🟡 Medium | Required         | Required         |
| Remove column  | 🔴 High   | Required         | Required         |
| Data migration | 🔴 High   | Required         | Required         |
| Remove table   | 🔴 High   | Required         | Required         |

---

## 🎯 Decision Tree

```text
Need to change schema?
  │
  ├─ Adding something? → Low risk, just do it
  │
  ├─ Modifying existing? → Can it be done in phases?
  │    ├─ Yes → Multi-phase migration
  │    └─ No → High risk, need backup + testing
  │
  └─ Removing something? → Always high risk
       └─ Create replacement first, migrate, then remove
```

---

## 📞 **Quick Help**

**Issue:** Migration fails
**Fix:** Check error message, verify syntax, ensure prerequisites met

**Issue:** Rollback needed
**Fix:** Run rollback SQL, verify with queries

**Issue:** Performance slow
**Fix:** Check indexes, use EXPLAIN ANALYZE, add WHERE clauses

**Issue:** RLS blocking access
**Fix:** Check policies, ensure service role bypass exists

**Issue:** Can't undo change
**Fix:** Restore from backup (always backup first!)

---

## 📚 **Full Documentation**

- **Complete Guide:** `docs/MIGRATION_STRATEGIES.md`
- **Checklist:** `docs/MIGRATION_CHECKLIST.md`
- **Templates:** `supabase/migrations/TEMPLATE_migration.sql`
- **RLS Guide:** `docs/RLS_QUICK_REFERENCE.md`

---

**Last Updated:** March 2026

---

## Migration Squash Strategy

_Added per audit recommendation #6 (comprehensive repo audit, March 2026)._

### Problem

The repository contains **208 SQL migration files**. Long migration chains increase:

- Schema application time for fresh environments.
- Risk of migration chain breakage (dependency ordering issues).
- Cognitive load when debugging schema-related bugs.

### Strategy: Quarterly Epoch Baselines

1. **Quarterly baseline snapshot:** At the start of each quarter, create a single consolidated migration file that represents the full schema state as of that date. Name it `YYYYMMDD000000_epoch_baseline_QN.sql` (e.g., `20260401000000_epoch_baseline_Q2_2026.sql`).

2. **Generate the baseline:**

   ```bash
   # Dump the current schema (no data) from the test database
   pg_dump --schema-only --no-owner --no-privileges \
     -d valueos_test > supabase/migrations/YYYYMMDD000000_epoch_baseline_QN.sql
   ```

3. **Move superseded migrations:** After creating the baseline, move all migration files older than the previous baseline into a `supabase/migrations/_consolidated/` directory. These are retained for audit trail but are not applied to fresh environments.

4. **Update the migration chain integrity test:** The CI check at `.github/workflows/migration-chain-integrity.yml` must be updated to start from the latest epoch baseline rather than the first migration.

5. **Rollback files:** Epoch baselines do not have rollback files. Rollbacks for the consolidated period are handled by restoring from the most recent pre-baseline database backup.

### Schedule

| Quarter | Baseline File                               | Consolidates Migrations Before |
| ------- | ------------------------------------------- | ------------------------------ |
| Q2 2026 | `20260401000000_epoch_baseline_Q2_2026.sql` | All files before 2026-04-01    |
| Q3 2026 | `20260701000000_epoch_baseline_Q3_2026.sql` | All files before 2026-07-01    |
| Q4 2026 | `20261001000000_epoch_baseline_Q4_2026.sql` | All files before 2026-10-01    |

### Validation

After creating a baseline:

1. Apply the baseline to a clean database.
2. Run `pnpm run test:rls` to verify RLS policies are intact.
3. Run the full test suite to verify schema correctness.
4. Commit the baseline and the `_consolidated/` move in a single PR.

---

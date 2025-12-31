# Migration Quick Reference

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
npm run dev
npm test
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

| Change | Risk | Backup Required? | Test on Staging? |
|--------|------|------------------|------------------|
| Add table | 🟢 Low | Recommended | Optional |
| Add column | 🟢 Low | Recommended | Optional |
| Add index | 🟢 Low | Optional | Optional |
| Add RLS policy | 🟡 Medium | Required | Required |
| Modify column | 🟡 Medium | Required | Required |
| Remove column | 🔴 High | Required | Required |
| Data migration | 🔴 High | Required | Required |
| Remove table | 🔴 High | Required | Required |

---

## 🎯 **Decision Tree**

```
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

**Last Updated:** December 1, 2025  
**Print this page and keep it visible!** 🖨️

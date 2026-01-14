# Database Migration Patterns: Expand-Migrate-Contract

## Overview

Zero-downtime database migrations using the expand-migrate-contract pattern.

## Problem

Traditional migrations cause downtime:
```sql
-- ❌ Breaking change
ALTER TABLE users DROP COLUMN old_email;
-- Old code breaks immediately!
```

## Solution: Expand-Migrate-Contract

### Three-Phase Pattern

```
Phase 1: EXPAND    - Add new schema (backward compatible)
Phase 2: MIGRATE   - Dual-write old + new, backfill data
Phase 3: CONTRACT  - Remove old schema (after verification)
```

## Example: Renaming a Column

### Traditional Approach (❌ Causes Downtime)

```sql
-- Single migration
ALTER TABLE users RENAME COLUMN email TO email_address;
```

**Problem:** Old code expects `email`, breaks immediately.

### Expand-Migrate-Contract Approach (✅ Zero Downtime)

#### Phase 1: EXPAND (Deploy 1)

**Migration:**
```sql
-- Add new column (nullable, backward compatible)
ALTER TABLE users ADD COLUMN email_address VARCHAR(255);

-- Create trigger to sync old → new
CREATE OR REPLACE FUNCTION sync_email_to_email_address()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_address = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_email_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_email_to_email_address();
```

**Code (dual-write):**
```typescript
// Write to both columns
await db.users.update({
  where: { id },
  data: {
    email: newEmail,        // Old column
    email_address: newEmail // New column
  }
});

// Read from old column (backward compatible)
const user = await db.users.findUnique({
  where: { id },
  select: { email: true }
});
```

**Deploy:** ✅ Old code still works, new column added

---

#### Phase 2: MIGRATE (Deploy 2)

**Backfill data:**
```sql
-- Backfill existing rows
UPDATE users 
SET email_address = email 
WHERE email_address IS NULL;

-- Make new column NOT NULL
ALTER TABLE users ALTER COLUMN email_address SET NOT NULL;

-- Add index
CREATE INDEX idx_users_email_address ON users(email_address);
```

**Code (switch reads to new column):**
```typescript
// Still dual-write
await db.users.update({
  where: { id },
  data: {
    email: newEmail,        // Old column (for old deployments)
    email_address: newEmail // New column
  }
});

// Read from NEW column
const user = await db.users.findUnique({
  where: { id },
  select: { email_address: true }
});
```

**Deploy:** ✅ All code uses new column, old column still exists

---

#### Phase 3: CONTRACT (Deploy 3)

**Migration:**
```sql
-- Drop trigger
DROP TRIGGER IF EXISTS sync_email_trigger ON users;
DROP FUNCTION IF EXISTS sync_email_to_email_address();

-- Drop old column
ALTER TABLE users DROP COLUMN email;
```

**Code (remove dual-write):**
```typescript
// Write only to new column
await db.users.update({
  where: { id },
  data: {
    email_address: newEmail // Only new column
  }
});

// Read from new column
const user = await db.users.findUnique({
  where: { id },
  select: { email_address: true }
});
```

**Deploy:** ✅ Old column removed, migration complete

---

## Migration Templates

### Template 1: Add Column

```sql
-- EXPAND
ALTER TABLE table_name ADD COLUMN new_column TYPE;

-- MIGRATE
UPDATE table_name SET new_column = old_column WHERE new_column IS NULL;
ALTER TABLE table_name ALTER COLUMN new_column SET NOT NULL;

-- CONTRACT
-- (No cleanup needed)
```

### Template 2: Remove Column

```sql
-- EXPAND
-- (No schema changes)

-- MIGRATE
-- Stop writing to column in code

-- CONTRACT
ALTER TABLE table_name DROP COLUMN old_column;
```

### Template 3: Change Column Type

```sql
-- EXPAND
ALTER TABLE table_name ADD COLUMN new_column NEW_TYPE;

-- MIGRATE
UPDATE table_name SET new_column = old_column::NEW_TYPE WHERE new_column IS NULL;
ALTER TABLE table_name ALTER COLUMN new_column SET NOT NULL;

-- CONTRACT
ALTER TABLE table_name DROP COLUMN old_column;
ALTER TABLE table_name RENAME COLUMN new_column TO old_column;
```

### Template 4: Add Foreign Key

```sql
-- EXPAND
ALTER TABLE table_name ADD COLUMN fk_column_id INTEGER;

-- MIGRATE
UPDATE table_name SET fk_column_id = (SELECT id FROM other_table WHERE ...);
ALTER TABLE table_name ALTER COLUMN fk_column_id SET NOT NULL;

-- CONTRACT
ALTER TABLE table_name ADD CONSTRAINT fk_name 
  FOREIGN KEY (fk_column_id) REFERENCES other_table(id);
```

---

## Supabase Migration Files

### File Naming Convention

```
supabase/migrations/
  20250102000001_expand_users_email_address.sql
  20250102000002_migrate_users_email_address.sql
  20250102000003_contract_users_email_address.sql
```

### Example Migration Files

**`20250102000001_expand_users_email_address.sql`:**
```sql
-- EXPAND: Add new column with backward compatibility

BEGIN;

-- Add new column (nullable)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_address VARCHAR(255);

-- Create sync trigger
CREATE OR REPLACE FUNCTION sync_email_to_email_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email_address = NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_email_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION sync_email_to_email_address();

COMMIT;
```

**`20250102000002_migrate_users_email_address.sql`:**
```sql
-- MIGRATE: Backfill data and enforce constraints

BEGIN;

-- Backfill existing rows
UPDATE users 
SET email_address = email 
WHERE email_address IS NULL AND email IS NOT NULL;

-- Make NOT NULL
ALTER TABLE users ALTER COLUMN email_address SET NOT NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_users_email_address ON users(email_address);

-- Add unique constraint (if needed)
ALTER TABLE users ADD CONSTRAINT users_email_address_unique UNIQUE (email_address);

COMMIT;
```

**`20250102000003_contract_users_email_address.sql`:**
```sql
-- CONTRACT: Remove old column

BEGIN;

-- Drop trigger
DROP TRIGGER IF EXISTS sync_email_trigger ON users;
DROP FUNCTION IF EXISTS sync_email_to_email_address();

-- Drop old column
ALTER TABLE users DROP COLUMN IF EXISTS email;

COMMIT;
```

---

## Deployment Timeline

| Deploy | Phase | Code Changes | Migration | Downtime |
|--------|-------|--------------|-----------|----------|
| 1 | EXPAND | Dual-write | Add new column | ✅ None |
| 2 | MIGRATE | Switch reads | Backfill data | ✅ None |
| 3 | CONTRACT | Remove dual-write | Drop old column | ✅ None |

**Wait time between deploys:** 24-48 hours (verify no errors)

---

## Validation Checklist

### After EXPAND
- [ ] New column exists
- [ ] Trigger syncs old → new
- [ ] Old code still works
- [ ] New writes populate both columns

### After MIGRATE
- [ ] All rows backfilled
- [ ] New column is NOT NULL
- [ ] Indexes created
- [ ] Code reads from new column
- [ ] No errors in logs (24-48 hours)

### After CONTRACT
- [ ] Old column dropped
- [ ] Trigger removed
- [ ] Code only uses new column
- [ ] No references to old column

---

## Rollback Strategy

### Rollback from EXPAND
```sql
-- Drop new column
ALTER TABLE users DROP COLUMN email_address;
DROP TRIGGER IF EXISTS sync_email_trigger ON users;
DROP FUNCTION IF EXISTS sync_email_to_email_address();
```

### Rollback from MIGRATE
```sql
-- Revert to dual-write in code
-- Keep both columns until next deploy
```

### Rollback from CONTRACT
```sql
-- Re-add old column
ALTER TABLE users ADD COLUMN email VARCHAR(255);

-- Backfill from new column
UPDATE users SET email = email_address;

-- Re-enable dual-write in code
```

---

## Automated Migration Workflow

### GitHub Actions Integration

```yaml
# .github/workflows/database-migrations.yml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  validate-migration:
    runs-on: ubuntu-latest
    steps:
      - name: Check migration pattern
        run: |
          # Ensure migrations follow expand-migrate-contract
          MIGRATION_FILE=$(git diff --name-only HEAD~1 HEAD | grep 'supabase/migrations')
          
          if echo "$MIGRATION_FILE" | grep -E '(expand|migrate|contract)'; then
            echo "✅ Migration follows expand-migrate-contract pattern"
          else
            echo "❌ Migration must include expand/migrate/contract in filename"
            exit 1
          fi

      - name: Validate backward compatibility
        run: |
          # Check for breaking changes
          if grep -E '(DROP COLUMN|DROP TABLE|ALTER COLUMN.*DROP)' supabase/migrations/*.sql; then
            echo "⚠️ Potentially breaking change detected"
            echo "Ensure this is in CONTRACT phase"
          fi
```

---

## Best Practices

### 1. Always Use Transactions
```sql
BEGIN;
-- Your migration
COMMIT;
```

### 2. Add IF EXISTS/IF NOT EXISTS
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_address VARCHAR(255);
DROP TRIGGER IF EXISTS sync_email_trigger ON users;
```

### 3. Test Migrations Locally
```bash
# Start local Supabase
npx supabase start

# Apply migration
npx supabase db push

# Verify
npx supabase db diff
```

### 4. Monitor After Each Phase
```sql
-- Check for errors
SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';

-- Check column usage
SELECT 
  COUNT(*) as total,
  COUNT(email) as old_column,
  COUNT(email_address) as new_column
FROM users;
```

### 5. Document Migration Intent
```sql
-- EXPAND: Add email_address column
-- Reason: Standardize column naming across tables
-- Backward compatible: Yes (dual-write via trigger)
-- Rollback: DROP COLUMN email_address
```

---

## Common Pitfalls

### ❌ Don't: Drop columns immediately
```sql
ALTER TABLE users DROP COLUMN email; -- Breaks old code!
```

### ✅ Do: Use expand-migrate-contract
```sql
-- Phase 1: Add new column
-- Phase 2: Backfill and switch
-- Phase 3: Drop old column
```

### ❌ Don't: Change column types directly
```sql
ALTER TABLE users ALTER COLUMN age TYPE VARCHAR; -- Breaks!
```

### ✅ Do: Add new column, migrate, drop old
```sql
-- Phase 1: ADD COLUMN age_str VARCHAR
-- Phase 2: UPDATE age_str = age::VARCHAR
-- Phase 3: DROP COLUMN age; RENAME age_str TO age
```

---

## References

- [Supabase Migrations](https://supabase.com/docs/guides/database/migrations)
- [Zero-Downtime Deployments](https://www.braintreepayments.com/blog/safe-operations-for-high-volume-postgresql/)
- [Expand-Contract Pattern](https://martinfowler.com/bliki/ParallelChange.html)

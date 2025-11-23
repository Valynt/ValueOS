# Database Migration Best Practices

## Overview

This guide provides best practices for creating, testing, and deploying database migrations in the ValueCanvas project using Supabase.

---

## Why Database Guard?

### Problem Without Validation

**Scenario**: Developer commits invalid SQL migration

```sql
-- migration.sql
CREATE TABLE users (
    id UUID PRIMARY KEY
    name TEXT NOT NULL  -- ❌ Missing comma
);
```

**What happens**:
1. PR merged without validation
2. Deployment pipeline runs
3. Migration fails during `terraform apply`
4. 💥 **Production deployment blocked**
5. 🔥 **Incident created**
6. ⏰ **Hours wasted debugging**

### Solution: Database Guard Workflow

**With validation**:
1. Developer creates PR with migration
2. Database Guard workflow runs automatically
3. ❌ **Syntax error caught immediately**
4. Developer fixes before merge
5. ✅ **Clean deployment**

---

## Migration Naming Convention

### Format

```
YYYYMMDDHHmmss_description.sql
```

### Examples

✅ **Good**:
```
20241123120000_add_user_preferences.sql
20241123120100_create_audit_log_table.sql
20241123120200_add_email_index.sql
```

❌ **Bad**:
```
migration.sql                    # No timestamp
add_users.sql                    # No timestamp
2024-11-23_add_users.sql        # Wrong format (dashes)
20241123_add_users.sql          # Missing time component
```

### Why Timestamps Matter

1. **Ordering**: Migrations run in chronological order
2. **Uniqueness**: Prevents conflicts between developers
3. **Traceability**: Easy to find when migration was created
4. **Rollback**: Clear order for rollback scripts

### Generating Timestamps

```bash
# Generate timestamp
date +%Y%m%d%H%M%S

# Create migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_add_user_preferences.sql
```

---

## Safe Migration Patterns

### 1. Adding Columns

✅ **Safe** - Use `IF NOT EXISTS`:
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email TEXT;
```

❌ **Unsafe** - Will fail if column exists:
```sql
ALTER TABLE users 
ADD COLUMN email TEXT;
```

### 2. Dropping Tables

✅ **Safe** - Use `IF EXISTS`:
```sql
DROP TABLE IF EXISTS old_table;
```

❌ **Unsafe** - Will fail if table doesn't exist:
```sql
DROP TABLE old_table;
```

### 3. Creating Indexes

✅ **Safe** - Use `IF NOT EXISTS` and `CONCURRENTLY`:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);
```

❌ **Unsafe** - Locks table during creation:
```sql
CREATE INDEX idx_users_email ON users(email);
```

### 4. Renaming Columns

✅ **Safe** - Multi-step approach:
```sql
-- Step 1: Add new column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Step 2: Copy data
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Step 3: Drop old column (in separate migration)
-- ALTER TABLE users DROP COLUMN name;
```

❌ **Unsafe** - Direct rename breaks existing code:
```sql
ALTER TABLE users RENAME COLUMN name TO full_name;
```

### 5. Changing Column Types

✅ **Safe** - With explicit casting:
```sql
ALTER TABLE users 
ALTER COLUMN age TYPE INTEGER 
USING age::INTEGER;
```

❌ **Unsafe** - May fail if data incompatible:
```sql
ALTER TABLE users 
ALTER COLUMN age TYPE INTEGER;
```

---

## Transaction Blocks

### When to Use Transactions

Use transactions for:
- Multiple related changes
- Data migrations
- Schema changes that must be atomic
- Migrations > 100 lines

### Pattern

```sql
BEGIN;

-- All your changes here
CREATE TABLE new_table (...);
ALTER TABLE existing_table ADD COLUMN ...;
INSERT INTO new_table SELECT ...;

COMMIT;
```

### Rollback on Error

```sql
BEGIN;

-- Changes
CREATE TABLE users (...);

-- If anything fails, everything rolls back
COMMIT;
```

### Example

```sql
BEGIN;

-- Create new table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY user_preferences_select_own 
ON user_preferences FOR SELECT 
USING (auth.uid() = user_id);

COMMIT;
```

---

## Row Level Security (RLS)

### Always Enable RLS

✅ **Secure**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY users_select_own 
ON users FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY users_update_own 
ON users FOR UPDATE 
USING (auth.uid() = id);
```

❌ **Insecure** - No RLS:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT NOT NULL
);
-- ❌ Missing RLS - anyone can access all data!
```

### RLS Policy Patterns

**Select own data**:
```sql
CREATE POLICY table_select_own 
ON table_name FOR SELECT 
USING (auth.uid() = user_id);
```

**Insert own data**:
```sql
CREATE POLICY table_insert_own 
ON table_name FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

**Update own data**:
```sql
CREATE POLICY table_update_own 
ON table_name FOR UPDATE 
USING (auth.uid() = user_id);
```

**Delete own data**:
```sql
CREATE POLICY table_delete_own 
ON table_name FOR DELETE 
USING (auth.uid() = user_id);
```

**Admin access**:
```sql
CREATE POLICY table_admin_all 
ON table_name FOR ALL 
USING (
    auth.jwt() ->> 'role' = 'admin'
);
```

---

## Indexes

### When to Add Indexes

Add indexes for:
- Foreign keys
- Columns used in WHERE clauses
- Columns used in JOIN conditions
- Columns used in ORDER BY
- Columns used in GROUP BY

### Index Patterns

**Single column**:
```sql
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);
```

**Multiple columns** (composite):
```sql
CREATE INDEX IF NOT EXISTS idx_orders_user_status 
ON orders(user_id, status);
```

**Partial index** (filtered):
```sql
CREATE INDEX IF NOT EXISTS idx_orders_pending 
ON orders(created_at) 
WHERE status = 'pending';
```

**JSONB index**:
```sql
CREATE INDEX IF NOT EXISTS idx_metadata_type 
ON items((metadata->>'type'));
```

**Full-text search**:
```sql
CREATE INDEX IF NOT EXISTS idx_posts_search 
ON posts USING GIN(to_tsvector('english', title || ' ' || content));
```

### Concurrent Index Creation

Always use `CONCURRENTLY` in production:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);
```

**Why**: Prevents table locking during index creation.

---

## Dangerous Operations

### Operations to Avoid

❌ **DROP DATABASE**:
```sql
DROP DATABASE production;  -- Never do this!
```

❌ **TRUNCATE** (without backup):
```sql
TRUNCATE TABLE users;  -- Deletes all data!
```

❌ **DROP COLUMN** (without migration path):
```sql
ALTER TABLE users DROP COLUMN email;  -- Breaks existing code!
```

❌ **ALTER TABLE** (changing types without casting):
```sql
ALTER TABLE users ALTER COLUMN age TYPE TEXT;  -- May fail!
```

### Safe Alternatives

✅ **Instead of DROP COLUMN** - Deprecate first:
```sql
-- Step 1: Mark as deprecated (in code comments)
-- Step 2: Remove usage from code
-- Step 3: Deploy code changes
-- Step 4: Drop column in separate migration
ALTER TABLE users DROP COLUMN IF EXISTS deprecated_field;
```

✅ **Instead of TRUNCATE** - Use DELETE with WHERE:
```sql
DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Testing Migrations

### Local Testing

```bash
# 1. Start Supabase locally
supabase start

# 2. Apply migrations
supabase db reset

# 3. Verify schema
supabase db diff

# 4. Test with sample data
psql $DATABASE_URL -c "INSERT INTO users ..."
```

### Automated Testing

The Database Guard workflow automatically:
1. ✅ Starts local Supabase instance
2. ✅ Applies all migrations
3. ✅ Checks for errors
4. ✅ Validates SQL syntax
5. ✅ Checks for dangerous operations

### Manual Verification

```bash
# Run linting script
./scripts/lint-migrations.sh

# Check specific migration
psql $DATABASE_URL -f supabase/migrations/20241123120000_add_users.sql
```

---

## Rollback Strategies

### Creating Rollback Scripts

For every migration, consider creating a rollback:

**Migration**: `20241123120000_add_user_preferences.sql`
```sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    preferences JSONB
);
```

**Rollback**: `rollbacks/20241123120000_rollback_user_preferences.sql`
```sql
DROP TABLE IF EXISTS user_preferences;
```

### Rollback Directory Structure

```
supabase/
  migrations/
    20241123120000_add_user_preferences.sql
    20241123120100_add_audit_log.sql
  rollbacks/
    20241123120000_rollback_user_preferences.sql
    20241123120100_rollback_audit_log.sql
```

### When Rollback Isn't Possible

Some changes can't be rolled back:
- ❌ Dropping columns (data lost)
- ❌ Changing column types (data may be incompatible)
- ❌ Deleting data

**Solution**: Always backup before destructive operations.

---

## Common Mistakes

### 1. Missing Semicolons

❌ **Wrong**:
```sql
CREATE TABLE users (id UUID PRIMARY KEY)
CREATE TABLE posts (id UUID PRIMARY KEY)
```

✅ **Correct**:
```sql
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE posts (id UUID PRIMARY KEY);
```

### 2. Unmatched Parentheses

❌ **Wrong**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
;
```

✅ **Correct**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
);
```

### 3. Missing Commas

❌ **Wrong**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY
    name TEXT NOT NULL
);
```

✅ **Correct**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
);
```

### 4. Forgetting IF NOT EXISTS

❌ **Wrong**:
```sql
ALTER TABLE users ADD COLUMN email TEXT;
```

✅ **Correct**:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
```

### 5. No RLS Policies

❌ **Wrong**:
```sql
CREATE TABLE sensitive_data (
    id UUID PRIMARY KEY,
    secret TEXT
);
-- ❌ No RLS - anyone can read!
```

✅ **Correct**:
```sql
CREATE TABLE sensitive_data (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    secret TEXT
);

ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY sensitive_data_select_own 
ON sensitive_data FOR SELECT 
USING (auth.uid() = user_id);
```

---

## Migration Checklist

Before committing a migration:

- [ ] ✅ Follows naming convention (YYYYMMDDHHmmss_description.sql)
- [ ] ✅ Uses `IF NOT EXISTS` / `IF EXISTS` where appropriate
- [ ] ✅ Includes transaction block if > 100 lines
- [ ] ✅ Has RLS policies for new tables
- [ ] ✅ Includes indexes for foreign keys
- [ ] ✅ No dangerous operations (DROP DATABASE, TRUNCATE)
- [ ] ✅ Tested locally with `supabase db reset`
- [ ] ✅ Linting passed (`./scripts/lint-migrations.sh`)
- [ ] ✅ Rollback script created (if needed)
- [ ] ✅ Documentation updated (if schema changes)

---

## Example: Complete Migration

```sql
-- ============================================================================
-- Migration: Add User Preferences
-- ============================================================================
-- Adds user_preferences table for storing user settings
-- ============================================================================

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es', 'fr')),
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    preferences JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_theme 
ON user_preferences(theme);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_id_unique 
ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY user_preferences_select_own 
ON user_preferences FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY user_preferences_insert_own 
ON user_preferences FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_update_own 
ON user_preferences FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY user_preferences_delete_own 
ON user_preferences FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE user_preferences IS 
'Stores user preferences and settings';

COMMIT;
```

---

## Resources

- **Supabase Docs**: https://supabase.com/docs/guides/database/migrations
- **PostgreSQL Docs**: https://www.postgresql.org/docs/current/sql-commands.html
- **Database Guard Workflow**: `.github/workflows/database-guard.yml`
- **Migration Linter**: `scripts/lint-migrations.sh`

---

**Last Updated**: November 23, 2024  
**Version**: 1.0  
**Author**: ValueCanvas DevOps Team

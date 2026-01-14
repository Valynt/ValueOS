# Fix 3: Database Migration Instructions

**Status**: ⚠️ Manual Step Required  
**File**: `supabase/migrations/20260105000001_add_settings_defaults.sql`

---

## What This Migration Does

1. Adds `user_preferences` column to `auth.users` with default `{}`
2. Adds `team_settings` column to `public.teams` with default `{}`
3. Renames `settings` to `organization_settings` in `public.organizations`
4. Sets all columns to `NOT NULL` with default `{}`
5. Cleans up existing redundant nesting (e.g., `{ "user": { "theme": ... } }`)
6. Adds GIN indexes for performance

---

## How to Run

### Option 1: Using Supabase CLI (Recommended)
```bash
cd /workspaces/ValueOS
supabase db push
```

### Option 2: Manual SQL Execution
```bash
# Connect to your database
psql $DATABASE_URL -f supabase/migrations/20260105000001_add_settings_defaults.sql
```

### Option 3: Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/20260105000001_add_settings_defaults.sql`
4. Paste and execute

---

## Verification

After running the migration, verify:

```sql
-- Check no NULL values exist
SELECT COUNT(*) FROM auth.users WHERE user_preferences IS NULL;
-- Should return 0

-- Check no redundant nesting
SELECT COUNT(*) FROM auth.users WHERE user_preferences ? 'user';
-- Should return 0

-- Check structure
SELECT 
  id,
  user_preferences->'theme' as theme,
  user_preferences->'notifications' as notifications
FROM auth.users
LIMIT 5;
-- Should show direct keys, not nested under "user"
```

---

## Status

- [x] Migration file created
- [ ] Migration executed (manual step required)
- [ ] Verification completed

---

**Note**: This migration is safe to run multiple times (idempotent).

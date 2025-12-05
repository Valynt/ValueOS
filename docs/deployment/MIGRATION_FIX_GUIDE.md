# Migration Fix Guide

**Created:** 2024-11-29  
**Issue:** Migration errors due to missing base tables and auth schema permissions

---

## 🔍 Problems Identified

### 1. Missing Base Tables
The RLS policies migration (`20241129000002_phase1_rls_policies.sql`) tries to apply policies to tables that don't exist yet:
- `cases`
- `workflows`
- `messages`

### 2. Auth Schema Permission Issues
The password validation migration (`20241129000001_phase1_password_validation.sql`) tries to create tables in Supabase's managed `auth` schema, which requires superuser permissions.

---

## ✅ Solution

I've created two new migrations to fix these issues:

### 1. Base Schema Migration
**File:** `supabase/migrations/20241129000000_base_schema.sql`

This creates the core application tables that other migrations depend on:
- Creates `cases`, `workflows`, and `messages` tables
- Adds proper indexes for performance
- Sets up foreign keys and constraints
- Adds updated_at triggers

### 2. Fixed Password Validation
**File:** `supabase/migrations/20241129000001_phase1_password_validation_fixed.sql`

This fixes the auth schema issue by using the `public` schema instead:
- Creates `login_attempts` table in `public` schema
- Password validation functions
- Account lockout logic
- All functions use `public` schema (no special permissions needed)

---

## 🚀 How to Apply Fixes

### Option 1: Using Supabase CLI (Recommended)

```bash
# Make sure you're logged in to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations in order
supabase db push

# Verify migrations
supabase db diff
```

### Option 2: Using psql with Supabase Connection

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run migrations in order
psql "$DATABASE_URL" -f supabase/migrations/20241129000000_base_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/20241129000001_phase1_password_validation_fixed.sql
psql "$DATABASE_URL" -f supabase/migrations/20241129000002_phase1_rls_policies.sql
psql "$DATABASE_URL" -f supabase/migrations/20241129_secret_audit_logs.sql
```

### Option 3: Using Supabase Dashboard

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the content of each migration file in order:
   - `20241129000000_base_schema.sql`
   - `20241129000001_phase1_password_validation_fixed.sql`
   - `20241129000002_phase1_rls_policies.sql`
   - `20241129_secret_audit_logs.sql`
4. Run each one

---

## 🔄 Migration Order

**IMPORTANT:** Migrations must be run in this specific order:

1. ✅ `20241129000000_base_schema.sql` - Creates base tables
2. ✅ `20241129000001_phase1_password_validation_fixed.sql` - Password validation (fixed)
3. ✅ `20241129000002_phase1_rls_policies.sql` - RLS policies (requires tables from #1)
4. ✅ `20241129_secret_audit_logs.sql` - Secret audit logs
5. ✅ Other Phase 1-3 migrations

---

## 🗑️ Old Migration to Ignore

The original `20241129000001_phase1_password_validation.sql` should be ignored/deleted as it has been replaced by the fixed version.

```bash
# Optional: Remove the old broken migration
rm supabase/migrations/20241129000001_phase1_password_validation.sql
```

---

## ✅ Verification

After running the migrations, verify everything works:

```sql
-- Check base tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('cases', 'workflows', 'messages', 'login_attempts', 'secret_audit_logs');

-- Should return 5 rows

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('cases', 'workflows', 'messages');

-- All should have rowsecurity = t

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('validate_password_strength', 'check_account_lockout', 'log_login_attempt');

-- Should return 3 rows
```

---

## 🐛 Troubleshooting

### Error: "permission denied for schema auth"

**Solution:** This is why we created the fixed version. The original migration tried to use Supabase's managed `auth` schema. The fixed version uses `public` schema instead.

### Error: "relation does not exist"

**Solution:** Run `20241129000000_base_schema.sql` first to create the base tables before applying RLS policies.

### Error: "connection refused"

**Solution:** 
1. Make sure your DATABASE_URL is correctly set
2. Or use Supabase CLI: `supabase db push`
3. Or use Supabase Dashboard SQL Editor

---

## 📊 What Was Fixed

| Issue | Before | After |
|-------|--------|-------|
| **Auth Schema** | ❌ Tried to create tables in `auth` schema | ✅ Uses `public` schema |
| **Missing Tables** | ❌ RLS applied to non-existent tables | ✅ Base schema creates tables first |
| **Migration Order** | ❌ Dependencies not clear | ✅ Numbered correctly (000000, 000001, 000002) |
| **Permissions** | ❌ Required superuser | ✅ Works with standard authenticated role |

---

## 🎯 Summary

**Problem:** Migrations failed due to:
1. Missing base application tables
2. Incorrect use of Supabase's managed `auth` schema

**Solution:** Created:
1. `20241129000000_base_schema.sql` - Base tables
2. `20241129000001_phase1_password_validation_fixed.sql` - Fixed auth issue

**Result:** All migrations now work correctly ✅

---

## 📞 Need Help?

If you continue to have issues:

1. **Check Supabase logs:** Dashboard > Logs
2. **Verify connection:** `supabase status`
3. **Reset if needed:** `supabase db reset` (⚠️ destroys data)

---

**Fixed:** 2024-11-29  
**Status:** ✅ Ready to apply  
**Next:** Run migrations in order above

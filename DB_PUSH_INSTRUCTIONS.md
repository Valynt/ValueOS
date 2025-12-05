# Database Migration Instructions

## 🚀 Push Migrations to Supabase Cloud

### Option 1: Via Supabase Studio SQL Editor (Recommended)

1. **Open Supabase Studio**:
   - Go to https://supabase.com/dashboard/project/bxaiabnqalurloblfwua/sql/new

2. **Execute migrations in order**:

   **Migration 1 - Baseline Schema** (648 lines):
   ```bash
   cat supabase/migrations/20250101000000_baseline_schema.sql
   ```
   - Copy the entire output
   - Paste into SQL Editor
   - Click "Run"

   **Migration 2 - Initial Schema** (433 lines):
   ```bash
   cat supabase/migrations/20251201120000_initial_schema.sql
   ```
   - Copy the entire output
   - Paste into SQL Editor
   - Click "Run"

   **Migration 3 - Target Agent Tables** (130 lines):
   ```bash
   cat supabase/migrations/20251201130000_align_target_agent_tables.sql
   ```
   - Copy the entire output
   - Paste into SQL Editor
   - Click "Run"

### Option 2: Via Supabase CLI (If installed)

```bash
# Link to your project
supabase link --project-ref bxaiabnqalurloblfwua

# Push all migrations
supabase db push
```

### Option 3: Combined Single File

Run this command to create a combined migration file:

```bash
cat supabase/migrations/20250101000000_baseline_schema.sql \
    supabase/migrations/20251201120000_initial_schema.sql \
    supabase/migrations/20251201130000_align_target_agent_tables.sql \
    > combined_migration.sql
```

Then execute `combined_migration.sql` in Supabase Studio.

---

## ✅ Verify Migrations

After running migrations, verify in Supabase Studio:

1. **Table Editor** → Check that tables exist:
   - `users`
   - `organizations`
   - `value_cases`
   - `business_objectives`
   - `value_trees`
   - `roi_models`
   - etc.

2. **SQL Editor** → Run:
   ```sql
   SELECT tablename FROM pg_tables 
   WHERE schemaname = 'public' 
   ORDER BY tablename;
   ```

3. **Authentication** → Settings → Enable Email Auth if not already enabled

---

## 🔧 Troubleshooting

### Error: "relation already exists"
- Some tables may already exist. This is OK.
- The migrations use `CREATE TABLE IF NOT EXISTS`

### Error: "permission denied"
- Make sure you're using the service role key in SQL Editor
- Or run as the postgres user

### Error: "function already exists"
- Functions may exist from previous attempts
- Use `DROP FUNCTION IF EXISTS function_name CASCADE;` before recreating

---

## 📋 Post-Migration Steps

1. **Disable Email Confirmation** (for testing):
   - Authentication → Settings
   - Uncheck "Enable email confirmations"
   - Save

2. **Test Signup**:
   - Go to http://localhost:5173
   - Try creating an account
   - Should succeed without email confirmation

3. **Check RLS Policies**:
   ```sql
   SELECT tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

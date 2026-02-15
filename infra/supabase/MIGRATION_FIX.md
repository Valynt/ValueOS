# Supabase Setup - Permanent Fix Documentation

## Problem Identified

The `user_tenants` table was referenced by multiple migrations but was never created, causing migration failures.

## Solution Implemented

Created migration `20241120000000_create_user_tenants.sql` which:

- Creates the `tenants` table
- Creates the `user_tenants` table (user-to-tenant mapping)
- Creates the `roles` and `user_roles` tables
- Enables RLS on all tables
- Adds proper indexes for performance
- Inserts default system roles

## Migration Status

✅ Applied: 20241120000000_create_user_tenants.sql

⏳ Pending (11 migrations):

- 20251125000000_advanced_security_schema.sql
- 20251213000000_fix_rls_tenant_isolation.sql
- 20251213_fix_tenant_columns_and_rls.sql
- 20251214000000_add_confidence_calibration.sql
- 20251216000000_add_tenant_seat_allocation_rpc.sql
- 20251226000000_fix_agent_performance_summary_security.sql
- 20260111000000_add_memory_gc_and_provenance.sql
- 20260111000000_add_tenant_isolation_to_match_memory.sql
- 20260112000000_add_org_filter_to_search_semantic_memory.sql
- 20260113000000_create_memory_provenance.sql
- 20260114000000_add_org_to_semantic_memory.sql

## How to Apply Remaining Migrations

### Option 1: Automated (Recommended)

```bash
export SUPABASE_ACCESS_TOKEN="your-token-here"
cd ${WORKSPACE_FOLDER:-/workspaces/ValueOS}
./infra/supabase/apply-pending-migrations.sh
```

### Option 2: Manual

```bash
export SUPABASE_ACCESS_TOKEN="your-token-here"
export PATH="$HOME/.local/bin:$PATH"
cd ${WORKSPACE_FOLDER:-/workspaces/ValueOS}
supabase db push --include-all
# When prompted, type 'Y' and press Enter
```

## Preventing Future Issues

### 1. Migration Naming Convention

All migrations must follow: `YYYYMMDDHHMMSS_description.sql`

### 2. Dependency Documentation

Each migration that depends on tables from other migrations should include a comment:

```sql
-- DEPENDENCIES:
-- - tenants (from 20241120000000)
-- - user_tenants (from 20241120000000)
```

### 3. Pre-Migration Validation

Before creating a new migration, check if referenced tables exist:

```bash
supabase db diff --schema public
```

### 4. Testing Migrations

Test migrations locally before pushing:

```bash
supabase db reset  # Reset local database
supabase db push   # Apply all migrations
```

## Files Created/Modified

1. `${WORKSPACE_FOLDER:-/workspaces/ValueOS}/supabase/migrations/20241120000000_create_user_tenants.sql` - NEW
   - Core tenant and user-tenant relationship tables
2. `${WORKSPACE_FOLDER:-/workspaces/ValueOS}/infra/supabase/setup-fixed.sh` - NEW
   - Automated setup script with error handling
3. `${WORKSPACE_FOLDER:-/workspaces/ValueOS}/infra/supabase/MIGRATION_FIX.md` - NEW (this file)
   - Documentation of the fix

## Verification

After applying all migrations, verify:

```bash
# Check all migrations are applied
supabase migration list

# Generate TypeScript types
supabase gen types typescript --linked > src/types/supabase-generated.ts

# Test connection
supabase db lint
```

## Support

If you encounter issues:

1. Check Supabase dashboard: https://app.supabase.com/project/bxaiabnqalurloblfwua
2. Review migration logs
3. Run with debug flag: `supabase db push --debug`

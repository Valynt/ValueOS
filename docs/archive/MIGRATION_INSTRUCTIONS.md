# Configuration Matrix Migration Instructions

## Migration File

**Location**: `supabase/migrations/20251230013534_organization_configurations.sql`

**Created**: December 30, 2024

## Prerequisites

- Supabase CLI installed
- Database connection configured
- Backup of current database (recommended)

## Migration Steps

### 1. Verify Migration File

```bash
# Check migration file exists
ls -la supabase/migrations/20251230013534_organization_configurations.sql

# Review migration contents
cat supabase/migrations/20251230013534_organization_configurations.sql
```

### 2. Apply Migration

#### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /workspaces/ValueOS

# Apply migration
supabase db push

# Verify migration applied
supabase db diff
```

#### Option B: Using Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20251230013534_organization_configurations.sql`
3. Paste into SQL Editor
4. Execute query
5. Verify no errors

#### Option C: Using psql

```bash
# Connect to database
psql $DATABASE_URL

# Run migration
\i supabase/migrations/20251230013534_organization_configurations.sql

# Verify table created
\dt organization_configurations
```

### 3. Verify Migration

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'organization_configurations';

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organization_configurations';

-- Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'organization_configurations';

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'organization_configurations';

-- Check default configurations created
SELECT organization_id, 
       tenant_provisioning->>'status' as status,
       subscription_plan->>'tier' as tier
FROM organization_configurations;
```

### 4. Test Configuration Access

```sql
-- Test configuration retrieval function
SELECT get_organization_config('your-org-id');

-- Test configuration update function
SELECT update_config_setting(
  'your-org-id',
  'tenant_provisioning',
  '{"status": "active", "maxUsers": 100, "maxStorageGB": 200}'::jsonb
);
```

## What the Migration Does

### Creates Table

- `organization_configurations` table with 30+ JSONB configuration columns
- Organized into 6 categories (Organization, IAM, AI, Operational, Security, Billing)
- Includes metadata columns (created_at, updated_at)

### Sets Up Security

- Row-level security (RLS) enabled
- Tenant isolation policy (users can only access their org)
- Vendor admin policy (vendor admins can access all orgs)

### Creates Indexes

- Primary key on `id`
- Unique constraint on `organization_id`
- Index on `updated_at` for sorting
- GIN indexes on frequently queried JSONB fields:
  - `tenant_provisioning->>'status'`
  - `subscription_plan->>'tier'`

### Adds Helper Functions

- `get_organization_config(organization_id)` - Retrieve full config
- `update_config_setting(organization_id, setting, value)` - Update specific setting
- `update_updated_at_column()` - Trigger function for timestamp updates

### Creates Views

- `configuration_change_audit` - Audit trail of configuration changes

### Backfills Data

- Creates default configurations for all existing organizations
- Sets sensible defaults for all configuration types

## Rollback Instructions

If you need to rollback the migration:

```sql
-- Drop view
DROP VIEW IF EXISTS configuration_change_audit;

-- Drop functions
DROP FUNCTION IF EXISTS get_organization_config(UUID);
DROP FUNCTION IF EXISTS update_config_setting(UUID, TEXT, JSONB);

-- Drop table (CASCADE removes all dependencies)
DROP TABLE IF EXISTS organization_configurations CASCADE;
```

## Post-Migration Tasks

### 1. Verify Application Integration

```bash
# Run configuration tests
npm test lib/configuration

# Check API endpoints
curl -X GET "http://localhost:3000/api/admin/configurations?organizationId=test-org"
```

### 2. Update Existing Organizations

If you have specific configuration requirements for existing organizations:

```sql
-- Update specific organization
UPDATE organization_configurations
SET 
  tenant_provisioning = jsonb_set(
    tenant_provisioning,
    '{maxUsers}',
    '100'
  ),
  subscription_plan = jsonb_set(
    subscription_plan,
    '{tier}',
    '"professional"'
  )
WHERE organization_id = 'your-org-id';
```

### 3. Set Up Monitoring

- Monitor configuration change frequency
- Alert on unauthorized access attempts
- Track configuration cache hit rates
- Monitor RLS policy performance

## Troubleshooting

### Issue: Migration Fails with "relation already exists"

**Solution**: Table already exists. Either:
- Drop existing table: `DROP TABLE organization_configurations CASCADE;`
- Or skip migration if structure is identical

### Issue: RLS Policies Not Working

**Solution**: Verify RLS is enabled:
```sql
ALTER TABLE organization_configurations ENABLE ROW LEVEL SECURITY;
```

### Issue: Default Configurations Not Created

**Solution**: Manually insert defaults:
```sql
INSERT INTO organization_configurations (organization_id)
SELECT id FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM organization_configurations 
  WHERE organization_id = organizations.id
);
```

### Issue: Performance Issues with JSONB Queries

**Solution**: Add more GIN indexes:
```sql
CREATE INDEX idx_custom ON organization_configurations 
USING GIN ((column_name->'field'));
```

## Support

For migration issues:
1. Check migration file syntax
2. Review Supabase logs
3. Verify database permissions
4. Check RLS policy configuration
5. Contact platform team

## Related Documentation

- [Configuration Matrix Implementation](./CONFIGURATION_MATRIX_IMPLEMENTATION.md)
- [Configuration & Settings Matrix Specification](./CONFIGURATION_MATRIX_SPEC.md)
- [Multi-tenant Architecture](./MULTI_TENANT_ARCHITECTURE.md)

---

**Migration File**: `20251230013534_organization_configurations.sql`

**Status**: Ready to apply

**Last Updated**: December 30, 2024

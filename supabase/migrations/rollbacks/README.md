# Database Rollback Migrations

⚠️ **WARNING: These migrations are destructive and will delete data!**

## Purpose

This directory contains rollback migrations that reverse changes made by forward migrations. These should only be used in development environments or with confirmed backups.

## Available Rollbacks

### 20251117221500_rollback_vos_value_fabric_schema.sql
Rolls back the VOS Value Fabric schema created in migration `20251117180000_create_vos_value_fabric_schema.sql`.

**Drops:**
- All VOS tables (business objectives, capabilities, use cases, value trees, ROI models, etc.)
- Helper functions
- Indexes and policies

**Data Loss:**
- All business objectives, capabilities, and use cases
- All value trees and ROI models
- All value commits and telemetry events
- All realization reports and expansion models

### 20251118095000_rollback_extended_schema.sql
Rolls back extended workflow, provenance, and performance schema.

**Drops:**
- Workflow audit logs
- Performance metrics
- Lifecycle artifact links
- Provenance audit log
- Extended columns on existing tables

**Data Loss:**
- All workflow audit history
- All performance metrics
- All provenance tracking data

## Usage

⚠️ **NEVER run these in production without a verified backup!**

### Development Environment

```bash
# Connect to local Supabase
supabase db reset

# Or run specific rollback
psql -h localhost -U postgres -d postgres -f supabase/migrations/rollbacks/20251117221500_rollback_vos_value_fabric_schema.sql
```

### Production Environment

**DO NOT RUN DIRECTLY!**

If you must rollback in production:

1. **Create a full database backup:**
   ```bash
   pg_dump -h your-host -U postgres -d your-db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Verify backup integrity:**
   ```bash
   # Test restore on a separate instance
   psql -h test-host -U postgres -d test-db < backup_*.sql
   ```

3. **Run rollback with transaction:**
   ```sql
   BEGIN;
   \i supabase/migrations/rollbacks/20251117221500_rollback_vos_value_fabric_schema.sql
   -- Verify results
   SELECT * FROM information_schema.tables WHERE table_schema = 'public';
   -- If everything looks good:
   COMMIT;
   -- If something went wrong:
   -- ROLLBACK;
   ```

4. **Verify application functionality:**
   - Test all critical paths
   - Check for broken references
   - Monitor error logs

## Re-applying Migrations

After rolling back, you can re-apply the original migrations:

```bash
# For VOS schema
supabase db push supabase/migrations/20251117180000_create_vos_value_fabric_schema.sql

# For extended schema
supabase db push supabase/migrations/20251118000000_add_provenance_tracking.sql
supabase db push supabase/migrations/20251118010000_extend_workflow_orchestrator.sql
supabase db push supabase/migrations/20251118090000_performance_optimizations.sql
```

## Best Practices

1. **Always backup before rollback**
2. **Test rollback in development first**
3. **Use transactions for safety**
4. **Document why rollback was necessary**
5. **Communicate with team before production rollback**
6. **Monitor application after rollback**

## Emergency Contacts

If you need to perform an emergency rollback in production:

1. Notify the team immediately
2. Create a backup first
3. Document the incident
4. Follow the production rollback procedure above
5. Create a post-mortem after resolution

## Notes

- Rollback migrations are kept separate to prevent accidental execution
- They are not run automatically by `supabase db reset`
- Always review the rollback SQL before executing
- Consider creating a new forward migration instead of rolling back in production

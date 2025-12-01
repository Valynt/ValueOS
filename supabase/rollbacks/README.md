# Rollback Strategy (Simplified)

## Single Baseline Migration

Since ValueCanvas uses a single baseline migration (`20250101000000_baseline_schema.sql`), the rollback strategy is straightforward:

### Local Development

```bash
# Drop and recreate from baseline
supabase db reset
```

This will:
1. Drop the entire database
2. Reapply the baseline migration
3. Run seed.sql

### Production (Future)

When you deploy to production and start creating incremental migrations:

1. **For new migrations**, create a corresponding rollback file:
   ```sql
   -- migrations/20250115120000_add_feature.sql
   CREATE TABLE new_feature (...);
   
   -- rollbacks/20250115120000_rollback_add_feature.sql
   DROP TABLE new_feature;
   ```

2. **To rollback**, apply the rollback script:
   ```bash
   psql $DATABASE_URL -f supabase/rollbacks/20250115120000_rollback_add_feature.sql
   ```

3. **Remove from tracking**:
   ```bash
   psql $DATABASE_URL -c "DELETE FROM supabase_migrations.schema_migrations WHERE version = '20250115120000';"
   ```

## Archived Rollbacks

Old rollback scripts from the 52-migration era are in `_archived/` for historical reference only.

## Best Practice

For production deployments:
- Always backup before migration: `pg_dump $DB > backup_$(date +%Y%m%d).sql`
- Test rollback in staging first
- Keep incremental migrations small and focused
- Document breaking changes

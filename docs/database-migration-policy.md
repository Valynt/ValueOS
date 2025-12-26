# Database Migration Policy

## 1. Principles

- **No Downtime**: All migrations must be designed for zero-downtime deployments.
- **Rollback first**: Every migration must have a tested rollback strategy.
- **Backward Compatibility**: Migrations must not break the current running version of the application.
- **Data Preservation**: Destructive operations (DROP, DELETE) are strictly prohibited in the forward migration. They must be done in a separate "Cleanup" phase after successful deployment.

## 2. Migration Phases

1. **Pre-Deployment (Expand)**: Add new columns, tables, or indexes.
2. **Deployment**: Update application code to use both old and new schema.
3. **Data Sync**: Background job to migrate data from old to new structures.
4. **Post-Deployment (Contract)**: Update application to use only new schema.
5. **Cleanup**: Remove old columns or tables.

## 3. Mandatory Checkpoints

- [ ] Migration script is idempotent.
- [ ] SQL linting passes.
- [ ] Rollback script verified on staging data.
- [ ] Performance impact assessed (no long-running locks).
- [ ] `tenant_id` and RLS policies applied to all new tables.

## 4. Emergency Rollback Procedure

1. Verify database health.
2. Run `./scripts/rollback-migration.sh <migration_id>`.
3. Verify data integrity after rollback.
4. Log failure for post-mortem analysis.

## 5. Dangerous Operations

- **RENAME COLUMN**: Prohibited. Add new column, sync data, then drop old.
- **ALTER COLUMN TYPE**: Prohibited. Add new column with new type, sync data.
- **NOT NULL on existing large table**: Prohibited. Add as nullable, backfill, then add constraint.

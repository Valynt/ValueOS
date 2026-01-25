# Zero-Downtime Database Migrations (Alembic + Prisma)

This guide documents a repeatable, automated approach to **zero-downtime** schema changes using Alembic (Python) and Prisma (Node). It follows an **expand → migrate → contract** strategy that keeps old and new application versions running concurrently.

## Goals

- Keep production traffic online during schema changes.
- Prevent blocking locks and long-running migrations from taking down the service.
- Automate migration execution in CI/CD with clear, phase-based controls.

## Core Strategy: Expand → Migrate → Contract

1. **Expand (backward compatible)**
   - Add new tables/columns as nullable.
   - Add new indexes concurrently.
   - Duplicate writes (if needed) using app logic or triggers.
2. **Migrate (data backfill)**
   - Run backfill scripts in batches.
   - Validate parity and metrics.
3. **Contract (cleanup)**
   - Remove old columns, constraints, or triggers only after rollout.

## Prisma Automation

### Required migration hygiene

- Prefer `prisma migrate deploy` in CI/CD (never `migrate dev` in production).
- Use `prisma migrate diff --create-only` to edit migrations for safety.
- For indexes, use raw SQL with `CREATE INDEX CONCURRENTLY`.

### Pipeline usage

The `scripts/migrations/zero-downtime/prisma-migrate.sh` helper is designed to run inside deployment workflows:

```bash
ZERO_DOWNTIME_PHASE=expand \
DATABASE_URL=postgresql://... \
ZERO_DOWNTIME_BACKFILL_SQL=prisma/sql/backfill_users.sql \
./scripts/migrations/zero-downtime/prisma-migrate.sh
```

```bash
ZERO_DOWNTIME_PHASE=contract \
DATABASE_URL=postgresql://... \
ZERO_DOWNTIME_CLEANUP_SQL=prisma/sql/cleanup_legacy.sql \
./scripts/migrations/zero-downtime/prisma-migrate.sh
```

**Recommended workflow**

1. **Expand phase** during a pre-deploy or canary step.
2. Deploy app versions that **read/write** both old and new schema.
3. Run backfill SQL to migrate data.
4. **Contract phase** after rollout to drop legacy columns.

## Alembic Automation

### Required migration hygiene

- Separate **expand** and **contract** migrations.
- Keep migrations short-running; use online operations where possible.
- Prefer `batch_alter_table` only for SQLite; for Postgres use native DDL.

### Pipeline usage

The `scripts/migrations/zero-downtime/alembic-migrate.sh` helper is designed to run inside deployment workflows:

```bash
ZERO_DOWNTIME_PHASE=expand \
DATABASE_URL=postgresql://... \
ALEMBIC_CONFIG=alembic.ini \
ZERO_DOWNTIME_BACKFILL_SQL=supabase/migrations/backfill_users.sql \
./scripts/migrations/zero-downtime/alembic-migrate.sh
```

```bash
ZERO_DOWNTIME_PHASE=contract \
DATABASE_URL=postgresql://... \
ALEMBIC_CONFIG=alembic.ini \
ZERO_DOWNTIME_CLEANUP_SQL=supabase/migrations/cleanup_legacy.sql \
./scripts/migrations/zero-downtime/alembic-migrate.sh
```

## CI/CD Integration Checklist

- ✅ Add a **pre-deploy** migration job for the expand phase.
- ✅ Ship application changes that are backward compatible.
- ✅ Run **post-deploy** migration job for the contract phase.
- ✅ Gate destructive operations behind explicit approvals.

## Operational Safeguards

- Run data backfills in small batches to avoid long locks.
- Use `statement_timeout` and `lock_timeout` for safety.
- Monitor slow query logs during migrations.
- Always keep a rollback or compensating migration plan.

## Reference Workflow Hooks

- Prisma workflow: `.github/workflows/database-migrations.yml`
- Alembic workflow: use the same pattern with `alembic-migrate.sh`.

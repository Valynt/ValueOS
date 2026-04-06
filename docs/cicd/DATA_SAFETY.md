# Data Safety — Migration and Backup Strategy

---

## Migration governance

### Every migration must have

1. **A forward `.sql` file** in `infra/supabase/supabase/migrations/` named `<timestamp>_<description>.sql`
2. **A rollback `.sql` file** named `<timestamp>_<description>.rollback.sql` in the same directory
3. **An RLS classification comment** at the top of any `CREATE TABLE` statement:
   ```sql
   -- rls-classification: tenant_scoped
   ```
   Valid values: `tenant_scoped`, `service_only`, `own_row`, `public_read`, `partition_child`
4. **An RLS policy** matching the classification, or a `-- rls-exempt: <reason>` annotation

The CI gate `scripts/ci/check-migration-rls-required.sh` rejects migrations that create tables without either.

### Migration CI gates (all run on every PR touching `migrations/**`)

| Check | Script | What it catches |
|---|---|---|
| Clean apply from zero | `migration-chain-integrity.yml` | Missing dependencies, syntax errors, broken chain |
| RLS required | `check-migration-rls-required.sh` | Tables without RLS policy or exempt annotation |
| Rollback files exist | `check-migration-rollbacks.mjs` | Forward migrations without a rollback counterpart |
| Schema consistency | `check-migration-schema-consistency.mjs` | Drift between migration files and TypeScript types |
| Migration hygiene | `check-migration-hygiene.mjs` | Naming conventions, timestamp ordering |
| Governance | `check-migration-governance.mjs` | Classification comments, policy completeness |
| Critical architecture | `verify-critical-architecture-migrations.mjs` | Load-bearing tables and security functions present |

### Pre-deploy migration procedure

Run by `deploy.yml` before any slot swap:

```bash
# 1. Snapshot (Supabase PITR point or manual pg_dump)
SNAPSHOT_ID=$(scripts/db/snapshot-pre-deploy.sh)
echo "snapshot_id=${SNAPSHOT_ID}" >> deploy-audit.json

# 2. Apply forward migrations
bash scripts/db/apply-migrations.sh

# 3. Verify integrity post-apply
node scripts/ci/check-migration-chain-integrity.mjs --post-apply
node scripts/ci/check-migration-schema-consistency.mjs

# 4. Record checkpoint
echo "migration_checkpoint=$(git rev-parse HEAD)" >> deploy-audit.json
```

If any step fails, the deploy is aborted before the slot swap. No traffic is affected.

---

## Rollback strategy

### Schema rollback decision tree

```
Deploy fails at smoke tests
        │
        ├─ Schema change in this deploy?
        │       │
        │       ├─ YES → run migration rollback
        │       │         apply-and-rollback-migrations.sh (reverse order)
        │       │         verify tables match pre-deploy snapshot
        │       │
        │       └─ NO  → traffic swap only (instant)
        │
        └─ Rollback complete → verify /health/ready on old slot
```

### Migration rollback execution

```bash
# Identify which migrations were applied in this deploy
CHECKPOINT=$(cat deploy-audit.json | jq -r .migration_checkpoint)
PREV_CHECKPOINT=$(git log --format="%H" "${CHECKPOINT}^..HEAD" -- \
  infra/supabase/supabase/migrations/ | tail -1)

# Apply rollback files in reverse timestamp order
for f in $(ls infra/supabase/supabase/migrations/*.rollback.sql | sort -r); do
  # Only roll back migrations applied after PREV_CHECKPOINT
  MIGRATION_SHA=$(git log --format="%H" -- "$f" | head -1)
  if git merge-base --is-ancestor "$PREV_CHECKPOINT" "$MIGRATION_SHA"; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  fi
done
```

### Point-in-time restore (last resort)

If rollback SQL fails (e.g., data was mutated in a way that makes the rollback non-idempotent):

1. Identify the pre-deploy PITR snapshot ID from `deploy-audit.json`
2. Restore via Supabase dashboard or `supabase db restore --snapshot-id <id>`
3. Verify restored schema matches expected state
4. Re-apply any non-schema data changes that occurred after the snapshot (from audit logs)

**RPO target:** < 5 minutes (Supabase PITR granularity)  
**RTO target:** < 15 minutes for PITR restore

---

## Backup validation

### Automated backup verification (nightly, `dr-validation.yml`)

```
1. Trigger Supabase PITR snapshot
2. Restore snapshot to ephemeral test database
3. Run migration chain integrity check against restored DB
4. Run RLS policy verification against restored DB
5. Run load-bearing table existence check
6. Emit backup-validation-report.json artifact
7. Alert on-call if any step fails
```

### Manual backup drill (monthly, `oncall-drill-scorecard.yml`)

The `oncall-drill-scorecard.yml` workflow tracks drill completion. Required drills:

- Full PITR restore to staging (verify data integrity)
- Migration rollback from last 3 production deploys
- Blue/green rollback under simulated smoke test failure
- Secret rotation (verify ExternalSecrets refresh)

Drill results are recorded in `artifacts/dr/drill-scorecard.json` and reviewed in the monthly reliability review.

---

## Tenant data isolation guarantees

All backup and restore operations preserve tenant isolation:

- Backups are full-database (not per-tenant) — no cross-tenant data is exposed during restore
- Restore targets are always isolated environments (never a shared tenant database)
- RLS policies are verified post-restore before any traffic is routed
- The `test:rls` suite (`pnpm run test:rls`) must pass against the restored database before it is promoted

No migration may drop or alter an RLS policy without a corresponding `-- rls-classification` update and a passing `rls-gate` run.

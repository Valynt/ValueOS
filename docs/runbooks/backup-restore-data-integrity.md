# Backup, Restore, and Data Integrity Runbook (Postgres)

## Scope
This runbook defines backup/restore procedures, recovery objectives, and integrity checks for the Postgres-backed SaaS across dev, staging, and production. It is intended for on-call engineers and release captains.

## RPO/RTO assumptions by environment
| Environment | RPO target | RTO target | Notes |
| --- | --- | --- | --- |
| Dev | 24 hours | 8 hours | Best-effort; restore from nightly full or latest snapshot. |
| Staging | 4 hours | 4 hours | Restore drill environment; mirrors prod config where possible. |
| Production | 15 minutes | 2 hours | Requires WAL archiving for PITR + automated restore automation. |

## Backup strategy
### Automated schedule
- **Nightly full backups**: `pg_basebackup` or `pg_dump` full logical dump executed nightly during low-traffic window.
- **WAL archiving for PITR**: Continuous WAL archiving for production and staging, enabled for PITR (15-minute RPO).
- **Incremental strategy**:
  - **Physical backups**: Nightly full physical base backup + continuous WAL archiving.
  - **Logical exports** (tenant scoped): On-demand `pg_dump` for specific tenants or schemas.

### Encryption
- **At rest**: Encrypt backups using KMS-managed keys (e.g., AWS KMS or GCP CMEK) and enforce bucket encryption policies.
- **In transit**: Use TLS for database connections and backup uploads (e.g., `sslmode=require` or `verify-full`).
- **Optional envelope encryption** for sensitive exports prior to storage.

### Retention and immutability
- **Retention**:
  - Dev: 7 days
  - Staging: 14 days
  - Production: 30–90 days (per compliance requirements)
- **Immutability**:
  - Enable object lock or WORM retention for production backups (e.g., S3 Object Lock in compliance mode).
  - Block public access and enforce versioning on backup buckets.
- **Deletion protection**: Require approvals for deletion of production backups; audit deletions in security logs.

## Restore strategy (PITR and full restore)
### Point-in-time recovery (PITR)
1. **Identify incident window**: Determine the target recovery timestamp (UTC).
2. **Locate base backup**: Select the most recent base backup prior to the incident.
3. **Restore base backup** to a recovery instance.
4. **Replay WAL** up to the target timestamp using recovery settings.
5. **Validate data**: Run integrity and application health checks.
6. **Cutover**: Swap traffic to the restored instance per incident commander approval.

### Full restore (latest backup)
1. **Select backup**: Choose the latest successful full backup.
2. **Restore to staging** for validation (optional for P1 incidents).
3. **Restore to production** after validation.
4. **Run post-restore checks**: migrations, smoke tests, and checksum verification.

## Restore runbook steps
1. **Confirm incident severity** and assign incident commander.
2. **Freeze writes** (if possible) to reduce data divergence.
3. **Pull backup artifact** from immutable storage.
4. **Restore** to a new Postgres instance or dedicated recovery host.
5. **Replay WAL** to target time (PITR) if required.
6. **Re-run migrations** if schema drift exists.
7. **Validate** data correctness, constraints, and application health.
8. **Cutover** and monitor for errors.
9. **Document** the restoration timestamp, RPO/RTO achieved, and lessons learned.

## Example commands
### Logical backup and restore
```bash
# Full logical backup (nightly full)
pg_dump --format=custom --file=backup_$(date +%Y%m%d_%H%M%S).dump \
  --dbname="$DATABASE_URL"

# Restore logical backup
pg_restore --clean --if-exists --dbname="$DATABASE_URL" \
  backup_20240115_020000.dump
```

### Physical base backup with WAL archiving (example)
```bash
# Base backup (physical)
pg_basebackup -D /backups/base_$(date +%Y%m%d) -Fp -Xs -P \
  -R -d "host=$DB_HOST port=5432 user=$DB_USER sslmode=verify-full"

# Example wal archiving configuration (postgresql.conf)
# archive_mode = on
# archive_command = 'aws s3 cp %p s3://my-backup-bucket/wal/%f'
```

### PITR recovery configuration (postgresql.conf / recovery.conf)
```conf
restore_command = 'aws s3 cp s3://my-backup-bucket/wal/%f %p'
recovery_target_time = '2025-01-15 02:45:00+00'
recovery_target_action = 'promote'
```

### Tenant-scoped export (GDPR request)
```bash
# Example: export a single tenant schema or filtered data
pg_dump --format=custom --file=tenant_123.dump \
  --dbname="$DATABASE_URL" \
  --table='public.tenant_data' \
  --where="tenant_id = 'tenant_123'"
```

## Restore drills
- **Frequency**:
  - Production: quarterly full restore drill (PITR)
  - Staging: monthly restore drill
  - Dev: optional
- **Drill checklist**:
  - Validate RPO/RTO against targets.
  - Confirm runbook steps and automation.
  - Capture metrics and update monitoring dashboards.

## Data integrity checks
### Constraints validation
- Run `ALTER TABLE ... VALIDATE CONSTRAINT` for any newly created `NOT VALID` constraints.
- Periodically run `pg_dump --schema-only` and compare against expected schema migrations.

### Checksum/consistency checks
- Enable `data_checksums` at cluster init (production and staging).
- Run `pg_checksums --check` during maintenance windows.
- Use `pg_dump --data-only --column-inserts` for targeted table sampling audits.

### Bloat, replication lag, and health
- Monitor `pg_stat_user_tables` for bloat (dead tuples and vacuum effectiveness).
- Track `pg_stat_replication` for replica lag and WAL receiver health.
- Alert on:
  - Replica lag > 5 minutes (prod)
  - Autovacuum disabled or lagging
  - WAL archive failures

## Multi-tenant considerations
### Tenant-scoped export/delete (GDPR)
- Provide tenant-specific export paths and retention windows.
- Ensure delete workflows remove tenant data from primary DB and backups after retention windows, unless legal hold applies.

### Data retention and legal hold
- Maintain tenant retention policies aligned with contracts.
- Implement legal hold flag to prevent backup lifecycle deletion and data pruning for specified tenants.

## Monitoring checklist
- [ ] Last successful full backup age (per environment)
- [ ] WAL archive success rate and lag
- [ ] Restore success rate (drills) and RPO/RTO metrics
- [ ] Backup integrity checks (checksums) status
- [ ] Replica lag (P95/P99) and WAL receiver health
- [ ] Autovacuum activity and bloat thresholds
- [ ] S3/object store immutability and retention policy compliance
- [ ] Backup encryption policy compliance (at-rest + in-transit)
- [ ] Tenant export/delete pipeline success rates

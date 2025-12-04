# Backup and disaster recovery playbook

## Objectives
- **RPO**: 24 hours for production databases and audit archives.
- **RTO**: 4 hours to restore core services (database + object storage) and validate health probes.

## Backup cadence
- **Database**: `scripts/backup-database.sh` runs daily (recommended cron) to dump PostgreSQL, compress, checksum, and push to S3 with 90-day retention metadata.【F:scripts/backup-database.sh†L3-L154】
- **Audit rotation**: `kubernetes/security-audit-retention-cronjob.yaml` calls `rotate_security_audit_logs(180)` every night to shift older audit rows into the archive table while keeping the primary log lean.【F:kubernetes/security-audit-retention-cronjob.yaml†L1-L22】【F:supabase/migrations/20250601110000_audit_request_retention.sql†L6-L83】
- **Object storage**: enable S3 lifecycle policies on the `database-backups` prefix to expire backups after 90 days, matching the backup script defaults.【F:scripts/backup-database.sh†L11-L118】

## Restore runbook
1. Identify target backup via `scripts/restore-database.sh --list` and select the desired file or `--latest`.【F:scripts/restore-database.sh†L3-L100】
2. Set `DATABASE_URL` and run `scripts/restore-database.sh --file <backup>`; confirm the destructive warning and wait for completion.【F:scripts/restore-database.sh†L62-L119】
3. Re-run `rotate_security_audit_logs(180)` after restores to ensure audit partitions align with retention policies.【F:supabase/migrations/20250601110000_audit_request_retention.sql†L46-L83】
4. Validate app health (`/health`), run smoke tests, and verify S3 checksum matches the restored dump.

## Periodic testing
- Schedule quarterly restore tests in a staging environment using the restore script to confirm RTO targets.
- Include verification of DSR tooling (`scripts/data-subject-request.js --action locate --email test@example.com`) to prove subject-rights workflows still function post-restore.【F:scripts/data-subject-request.js†L9-L111】

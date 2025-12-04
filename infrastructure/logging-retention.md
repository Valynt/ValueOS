# Logging retention and rotation

## Database archival
- `supabase/migrations/20250601110000_audit_request_retention.sql` adds request metadata columns to `security_audit_log`, an immutable archive table, and the `rotate_security_audit_logs(retention_days)` helper so we can prune primary tables while keeping long-term history.
- Rotation uses the `app.allow_audit_gc` flag to allow controlled deletes during maintenance windows and keeps copies in `security_audit_log_archive` for auditability.

## Kubernetes CronJob
- `kubernetes/security-audit-retention-cronjob.yaml` runs daily at 02:30 UTC using a Postgres client container to call `SELECT public.rotate_security_audit_logs(180);` with database credentials pulled from the `valuecanvas-database` secret.
- The CronJob uses the `audit-ops` service account and restarts on failure to keep the retention lane isolated from application pods.

## Object storage lifecycle
- Database backups already ship to S3 with server-side encryption via `scripts/backup-database.sh`; ensure the S3 bucket lifecycle rules expire backups older than 90 days to align with the rotation window.
- For log exports, mirror the same lifecycle policy on the `database-backups` prefix so archive growth is bounded and retained according to compliance requirements.

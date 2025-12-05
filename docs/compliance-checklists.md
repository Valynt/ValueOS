# Compliance checklists

## SOC 2/GDPR control mapping
- **Auditability (CC7.x / Art.30)**: Immutable audit logs in `public.audit_logs` and `public.security_audit_log` track actor, action, and IP/user agent metadata; new request-level audit middleware ensures every API call is captured with a request ID.【F:supabase/migrations/20250101000000_baseline_schema.sql†L258-L293】【F:src/middleware/requestAuditMiddleware.ts†L11-L63】
- **Data minimization & retention (Art.5.1e)**: Audit rotation function plus daily CronJob moves aging audit entries into an archive table and prunes primaries after 180 days; S3 lifecycle for backups enforces 90-day storage windows.【F:supabase/migrations/20250601110000_audit_request_retention.sql†L6-L83】【F:kubernetes/security-audit-retention-cronjob.yaml†L1-L22】【F:scripts/backup-database.sh†L11-L154】
- **Data subject rights (Art.15-17)**: DSR utility locates, exports, or anonymizes user data across key tables and logs each action for traceability.【F:scripts/data-subject-request.js†L9-L111】
- **Security monitoring (CC7.2)**: Security audit log captures event type/severity and is fed by request middleware plus existing audit hooks for agents and authorization changes.【F:supabase/migrations/20250101000000_baseline_schema.sql†L272-L293】【F:src/backend/server.ts†L8-L31】

## Operational checklist
- [ ] Run `scripts/backup-database.sh` daily via cron or CI with S3 credentials; alert on failures and record upload/checksum metrics.
- [ ] Ensure `kubernetes/security-audit-retention-cronjob.yaml` is applied with the `valuecanvas-database` secret and `audit-ops` service account bound; verify 180-day primary/archived lifecycles are enforced.
- [ ] Perform quarterly restore dry-runs using `scripts/restore-database.sh` in staging and record RPO/RTO results and any manual steps in the incident log.
- [ ] Validate DSR automation monthly using a test account; export and anonymize flows should both write audit entries and the audit log should be reviewed for the expected request ID.
- [ ] Run `scripts/backup-database.sh` daily via cron or CI with S3 credentials and confirm successful uploads.
- [ ] Ensure `kubernetes/security-audit-retention-cronjob.yaml` is applied with the `valuecanvas-database` secret and `audit-ops` service account bound.
- [ ] Monitor the `security-audit-retention` CronJob for a recent `lastSuccessfulTime`, alert on `suspend: true`, and verify the `audit_request_events_archive` table keeps appending rows without unexpected deletes.
- [ ] Perform quarterly restore dry-runs using `scripts/restore-database.sh` in staging and record RPO/RTO results in the incident log.
- [ ] Validate DSR automation monthly using a test account; export and anonymize flows should both write audit entries.
- [ ] Keep onboarding training updated with locations of PII-bearing tables and the audit/retention flows documented in `docs/data-protection-overview.md`.

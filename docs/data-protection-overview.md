# Data protection inventory and flows

## Data inventory (PII and sensitive stores)
- **Users**: email, names, avatar, job title, preferences, and metadata live in `public.users` (Supabase).【F:supabase/migrations/20250101000000_baseline_schema.sql†L16-L29】
- **Organizations**: customer names, billing JSON, and metadata are in `public.organizations` with soft-deletion support via flags and timestamps.【F:supabase/migrations/20250101000000_baseline_schema.sql†L31-L44】
- **Cases and workflows**: user-linked ticket titles/descriptions and statuses in `public.cases` and `public.workflows`.【F:supabase/migrations/20250101000000_baseline_schema.sql†L99-L129】
- **Messages**: conversational content and role metadata in `public.messages` (often contains free-form PII).【F:supabase/migrations/20250101000000_baseline_schema.sql†L131-L140】
- **Audit trails**: immutable operational events with IP/user agent fields in `public.audit_logs` and `public.security_audit_log` (plus agent-focused entries).【F:supabase/migrations/20250101000000_baseline_schema.sql†L258-L293】
- **Internal app DB**: organization- and user-scoped tables (including emails, names, password hashes) in the primary migration under `migrations/001_initial_schema.sql`.【F:migrations/001_initial_schema.sql†L14-L125】

## Event and data flow sources
- **API request auditing**: every Express request (except health/metrics) now emits a structured security audit event with request ID, actor, action, resource path, status, IP, and timing metadata.【F:src/middleware/requestAuditMiddleware.ts†L6-L63】【F:src/backend/server.ts†L8-L31】
- **Security and agent actions**: existing audit tables capture authorization, agent, and data-export events; triggers enforce immutability for these stores.【F:supabase/migrations/20250101000000_baseline_schema.sql†L258-L318】
- **Backup/log lifecycle**: scheduled database backups push to S3 with checksums and retention pruning to protect long-lived data copies.【F:scripts/backup-database.sh†L3-L154】

## Controls aligned to data subject rights
- **DSR automation**: `scripts/data-subject-request.js` locates a user by email, summarizes related records across cases/messages/agent data, exports a JSON dossier, or anonymizes selected tables. Each action logs to `security_audit_log` with a dedicated request ID for traceability.【F:scripts/data-subject-request.js†L9-L111】
- **Request-level audit logging**: middleware writes append-only entries for API calls, enabling per-request investigations that link actors, request IDs, and resources back to the underlying PII-bearing tables.【F:src/middleware/requestAuditMiddleware.ts†L11-L63】
- **Retention hooks**: the Supabase migration adds request-correlation columns, an archive table, and a rotation function so audit data can be pruned or shipped while preserving immutability guarantees during normal operations.【F:supabase/migrations/20250601110000_audit_request_retention.sql†L6-L83】

## Operational lifecycle controls
- **Backups with success tracking**: `scripts/backup-database.sh` should run daily through cron/CI with cloud credentials injected via secrets; each run must publish a success/failure metric (or exit-code alert) so on-call can validate uploads and checksum verification.【F:scripts/backup-database.sh†L3-L154】
- **Restore dry-runs**: quarterly restores in staging validate RPO/RTO by loading the latest backup, replaying migrations, and confirming application health, with the drill outcome logged alongside timing and any manual steps.
- **Lifecycle enforcement**: S3 objects keep a 90-day retention window, while audit log rotation retains 180 days in primaries and archives older entries; scheduled jobs should emit metrics when pruning or moving data so drift is detectable.【F:kubernetes/security-audit-retention-cronjob.yaml†L1-L22】【F:scripts/backup-database.sh†L11-L154】【F:supabase/migrations/20250601110000_audit_request_retention.sql†L6-L83】
- **DSR drills with audit verification**: monthly dry-runs against a test account exercise both export and anonymization paths in `scripts/data-subject-request.js`; operators must confirm matching entries in `security_audit_log` to ensure traceability remains intact.【F:scripts/data-subject-request.js†L9-L111】

SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS audit_logs_append_only_update ON public.audit_logs;
DROP TRIGGER IF EXISTS security_audit_log_append_only_update ON public.security_audit_log;
DROP TRIGGER IF EXISTS audit_logs_archive_immutable ON public.audit_logs_archive;
DROP TRIGGER IF EXISTS security_audit_log_archive_immutable ON public.security_audit_log_archive;

DROP FUNCTION IF EXISTS public.prevent_append_only_audit_update();
DROP FUNCTION IF EXISTS public.prevent_historical_audit_mutation();

REVOKE SELECT, INSERT ON public.audit_logs_archive FROM service_role;
GRANT ALL ON public.audit_logs_archive TO service_role;
REVOKE SELECT, INSERT ON public.security_audit_log_archive FROM service_role;
GRANT ALL ON public.security_audit_log_archive TO service_role;

DROP POLICY IF EXISTS security_audit_log_archive_tenant_select ON public.security_audit_log_archive;
DROP POLICY IF EXISTS security_audit_log_archive_service_role ON public.security_audit_log_archive;
ALTER TABLE public.security_audit_log_archive DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_security_audit_log_archive_tenant;
DROP INDEX IF EXISTS idx_security_audit_log_archive_batch_id;
DROP INDEX IF EXISTS idx_audit_logs_archive_batch_id;

ALTER TABLE public.audit_logs_archive
  DROP COLUMN IF EXISTS archive_batch_id,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archive_checksum_sha256;

ALTER TABLE public.security_audit_log_archive
  DROP COLUMN IF EXISTS archive_batch_id,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archive_checksum_sha256;

DROP TABLE IF EXISTS public.audit_retention_batches;
DROP TABLE IF EXISTS public.security_audit_log_archive;

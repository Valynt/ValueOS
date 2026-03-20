SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS security_audit_log_archive_immutable ON public.security_audit_log_archive;
DROP TRIGGER IF EXISTS audit_logs_archive_immutable ON public.audit_logs_archive;
DROP FUNCTION IF EXISTS public.prevent_audit_archive_mutation();

DROP POLICY IF EXISTS security_audit_log_archive_service_role_insert ON public.security_audit_log_archive;
DROP POLICY IF EXISTS security_audit_log_archive_service_role_select ON public.security_audit_log_archive;
DROP POLICY IF EXISTS security_audit_log_archive_authorized_select ON public.security_audit_log_archive;
DROP POLICY IF EXISTS audit_logs_archive_service_role_insert ON public.audit_logs_archive;
DROP POLICY IF EXISTS audit_logs_archive_service_role_select ON public.audit_logs_archive;

REVOKE ALL ON public.audit_logs_archive FROM authenticated;
REVOKE ALL ON public.audit_logs_archive FROM service_role;
REVOKE ALL ON public.security_audit_log_archive FROM authenticated;
REVOKE ALL ON public.security_audit_log_archive FROM service_role;

GRANT SELECT ON public.audit_logs_archive TO authenticated;
GRANT ALL ON public.audit_logs_archive TO service_role;
GRANT SELECT ON public.security_audit_log_archive TO authenticated;
GRANT ALL ON public.security_audit_log_archive TO service_role;

DROP TABLE IF EXISTS public.security_audit_log_archive;

ALTER TABLE public.audit_logs_archive
  DROP COLUMN IF EXISTS source_table,
  DROP COLUMN IF EXISTS archive_batch_id,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archive_verified_at,
  DROP COLUMN IF EXISTS archive_verification;

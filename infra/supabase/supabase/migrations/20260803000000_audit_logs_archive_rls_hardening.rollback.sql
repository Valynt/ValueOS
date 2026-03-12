-- Rollback: 20260803000000_audit_logs_archive_rls_hardening
-- Restores prior state for public.audit_logs_archive.

SET search_path = public, pg_temp;

REVOKE SELECT ON public.audit_logs_archive FROM authenticated;

DROP POLICY IF EXISTS audit_logs_archive_tenant_select ON public.audit_logs_archive;
DROP POLICY IF EXISTS audit_logs_archive_service_role ON public.audit_logs_archive;

ALTER TABLE public.audit_logs_archive DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.audit_logs_archive TO authenticated;
GRANT ALL    ON public.audit_logs_archive TO service_role;

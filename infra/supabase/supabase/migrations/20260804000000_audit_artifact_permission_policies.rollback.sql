SET search_path = public, pg_temp;

DROP POLICY IF EXISTS audit_logs_archive_authorized_select ON public.audit_logs_archive;
CREATE POLICY audit_logs_archive_tenant_select ON public.audit_logs_archive
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  );

DROP POLICY IF EXISTS security_audit_log_authorized_select ON public.security_audit_log;
CREATE POLICY security_audit_log_tenant_select ON public.security_audit_log
  FOR SELECT USING (security.user_has_tenant_access(tenant_id));

DROP FUNCTION IF EXISTS security.jwt_has_scope(TEXT);

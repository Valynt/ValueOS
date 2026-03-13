-- Enforce explicit permission claims for audit artifact read access.

SET search_path = public, pg_temp;

CREATE SCHEMA IF NOT EXISTS security;

CREATE OR REPLACE FUNCTION security.jwt_has_scope(required_scope TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'permissions') ? required_scope
    OR (auth.jwt() -> 'permissions') ? required_scope,
    false
  );
$$;

REVOKE ALL ON FUNCTION security.jwt_has_scope(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.jwt_has_scope(TEXT) TO authenticated, service_role;

DROP POLICY IF EXISTS audit_logs_archive_tenant_select ON public.audit_logs_archive;
CREATE POLICY audit_logs_archive_authorized_select ON public.audit_logs_archive
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    (security.user_has_tenant_access(tenant_id) OR security.user_has_tenant_access(organization_id))
    AND (security.jwt_has_scope('audit.read') OR security.jwt_has_scope('compliance.read'))
  );

DROP POLICY IF EXISTS security_audit_log_tenant_select ON public.security_audit_log;
CREATE POLICY security_audit_log_authorized_select ON public.security_audit_log
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    security.user_has_tenant_access(tenant_id)
    AND (security.jwt_has_scope('audit.read') OR security.jwt_has_scope('compliance.read'))
  );

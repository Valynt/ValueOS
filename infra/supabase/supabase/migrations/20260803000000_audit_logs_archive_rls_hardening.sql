-- ============================================================================
-- Harden audit_logs_archive access controls
--
-- Mirrors the canonical audit_logs tenant policy pattern from
-- 20260213000010_canonical_identity_baseline.sql.
--
-- Changes:
-- 1) Enable RLS on public.audit_logs_archive
-- 2) Revoke broad SELECT grant from authenticated
-- 3) Add restrictive authenticated SELECT policy scoped by tenant/org access
-- 4) Add explicit service_role full-access policy only
-- 5) Re-grant SELECT to authenticated (policy-gated)
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.audit_logs_archive FROM authenticated;

DROP POLICY IF EXISTS audit_logs_archive_tenant_select ON public.audit_logs_archive;
CREATE POLICY audit_logs_archive_tenant_select ON public.audit_logs_archive
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    security.user_has_tenant_access(tenant_id)
    OR security.user_has_tenant_access(organization_id)
  );

DROP POLICY IF EXISTS audit_logs_archive_service_role ON public.audit_logs_archive;
CREATE POLICY audit_logs_archive_service_role ON public.audit_logs_archive
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.audit_logs_archive TO authenticated;

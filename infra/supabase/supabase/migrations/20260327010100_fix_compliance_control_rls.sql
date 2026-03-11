-- ============================================================================
-- Fix compliance_control_* RLS policies
--
-- 20260304020000_compliance_control_status.sql created policies using
-- current_setting('app.current_tenant_id', ...) — the deprecated pattern
-- that was replaced in 20260308000000_fix_jwt_claim_only_rls_policies.sql.
--
-- That pattern trusts a session variable that can be set by any caller and
-- does not verify active membership in user_tenants.
--
-- Replacement: security.user_has_tenant_access(tenant_id) — the canonical
-- SECURITY DEFINER function that validates auth.uid() membership in
-- user_tenants with status = 'active'.
--
-- Tables: compliance_control_status, compliance_control_evidence,
--         compliance_control_audit
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. compliance_control_status
-- ============================================================================

DROP POLICY IF EXISTS compliance_control_status_tenant_select ON public.compliance_control_status;
DROP POLICY IF EXISTS compliance_control_status_tenant_insert ON public.compliance_control_status;

CREATE POLICY compliance_control_status_tenant_select ON public.compliance_control_status
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY compliance_control_status_tenant_insert ON public.compliance_control_status
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- service_role bypass (background workers, cron jobs)
DROP POLICY IF EXISTS compliance_control_status_service_role ON public.compliance_control_status;
CREATE POLICY compliance_control_status_service_role ON public.compliance_control_status
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. compliance_control_evidence
-- ============================================================================

DROP POLICY IF EXISTS compliance_control_evidence_tenant_select ON public.compliance_control_evidence;
DROP POLICY IF EXISTS compliance_control_evidence_tenant_insert ON public.compliance_control_evidence;

CREATE POLICY compliance_control_evidence_tenant_select ON public.compliance_control_evidence
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY compliance_control_evidence_tenant_insert ON public.compliance_control_evidence
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS compliance_control_evidence_service_role ON public.compliance_control_evidence;
CREATE POLICY compliance_control_evidence_service_role ON public.compliance_control_evidence
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. compliance_control_audit
-- ============================================================================

DROP POLICY IF EXISTS compliance_control_audit_tenant_select ON public.compliance_control_audit;
DROP POLICY IF EXISTS compliance_control_audit_tenant_insert ON public.compliance_control_audit;

CREATE POLICY compliance_control_audit_tenant_select ON public.compliance_control_audit
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY compliance_control_audit_tenant_insert ON public.compliance_control_audit
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS compliance_control_audit_service_role ON public.compliance_control_audit;
CREATE POLICY compliance_control_audit_service_role ON public.compliance_control_audit
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

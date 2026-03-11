-- Rollback: 20260327010000_fix_compliance_control_rls
-- Restores the deprecated current_setting pattern from 20260304020000.

DROP POLICY IF EXISTS compliance_control_status_tenant_select ON public.compliance_control_status;
DROP POLICY IF EXISTS compliance_control_status_tenant_insert ON public.compliance_control_status;
DROP POLICY IF EXISTS compliance_control_status_service_role ON public.compliance_control_status;

CREATE POLICY compliance_control_status_tenant_select ON public.compliance_control_status
  FOR SELECT TO authenticated
  USING (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

CREATE POLICY compliance_control_status_tenant_insert ON public.compliance_control_status
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

DROP POLICY IF EXISTS compliance_control_evidence_tenant_select ON public.compliance_control_evidence;
DROP POLICY IF EXISTS compliance_control_evidence_tenant_insert ON public.compliance_control_evidence;
DROP POLICY IF EXISTS compliance_control_evidence_service_role ON public.compliance_control_evidence;

CREATE POLICY compliance_control_evidence_tenant_select ON public.compliance_control_evidence
  FOR SELECT TO authenticated
  USING (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

CREATE POLICY compliance_control_evidence_tenant_insert ON public.compliance_control_evidence
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

DROP POLICY IF EXISTS compliance_control_audit_tenant_select ON public.compliance_control_audit;
DROP POLICY IF EXISTS compliance_control_audit_tenant_insert ON public.compliance_control_audit;
DROP POLICY IF EXISTS compliance_control_audit_service_role ON public.compliance_control_audit;

CREATE POLICY compliance_control_audit_tenant_select ON public.compliance_control_audit
  FOR SELECT TO authenticated
  USING (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

CREATE POLICY compliance_control_audit_tenant_insert ON public.compliance_control_audit
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = COALESCE(current_setting('app.current_tenant_id', true), current_setting('request.jwt.claim.tenant_id', true), current_setting('request.jwt.claim.organization_id', true)));

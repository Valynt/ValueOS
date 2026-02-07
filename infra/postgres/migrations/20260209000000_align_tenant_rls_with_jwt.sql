-- ==========================================================================
-- Align tenant-scoped RLS policies with JWT tenant claim enforcement
-- ==========================================================================

-- Core tenant-scoped policies from release v1
DROP POLICY IF EXISTS automated_responses_tenant_isolation ON public.automated_responses;
CREATE POLICY automated_responses_tenant_isolation ON public.automated_responses
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS cases_tenant_isolation ON public.cases;
CREATE POLICY cases_tenant_isolation ON public.cases
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS compliance_evidence_tenant_isolation ON public.compliance_evidence;
CREATE POLICY compliance_evidence_tenant_isolation ON public.compliance_evidence
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS compliance_reports_tenant_isolation ON public.compliance_reports;
CREATE POLICY compliance_reports_tenant_isolation ON public.compliance_reports
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS device_trust_tenant_isolation ON public.device_trust_history;
CREATE POLICY device_trust_tenant_isolation ON public.device_trust_history
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS messages_tenant_isolation ON public.messages;
CREATE POLICY messages_tenant_isolation ON public.messages
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS security_events_tenant_isolation ON public.security_events;
CREATE POLICY security_events_tenant_isolation ON public.security_events
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS security_incidents_tenant_isolation ON public.security_incidents;
CREATE POLICY security_incidents_tenant_isolation ON public.security_incidents
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS security_policies_tenant_isolation ON public.security_policies;
CREATE POLICY security_policies_tenant_isolation ON public.security_policies
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS user_sessions_tenant_isolation ON public.user_sessions;
CREATE POLICY user_sessions_tenant_isolation ON public.user_sessions
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS workflows_tenant_isolation ON public.workflows;
CREATE POLICY workflows_tenant_isolation ON public.workflows
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- Agent sessions policies
DROP POLICY IF EXISTS tenant_isolation_delete ON public.agent_sessions;
CREATE POLICY tenant_isolation_delete ON public.agent_sessions
  FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_insert ON public.agent_sessions;
CREATE POLICY tenant_isolation_insert ON public.agent_sessions
  FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_select ON public.agent_sessions;
CREATE POLICY tenant_isolation_select ON public.agent_sessions
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_update ON public.agent_sessions;
CREATE POLICY tenant_isolation_update ON public.agent_sessions
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- Agent predictions policies
DROP POLICY IF EXISTS strict_tenant_isolation_insert ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_insert ON public.agent_predictions
  FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS strict_tenant_isolation_select ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_select ON public.agent_predictions
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS strict_tenant_isolation_update ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_update ON public.agent_predictions
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- Tenant membership derived policies
DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT
  USING (security.user_has_tenant_access(id));

DROP POLICY IF EXISTS "cv_tenant_isolation" ON public.confidence_violations;
CREATE POLICY "cv_tenant_isolation" ON public.confidence_violations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agent_predictions ap
      WHERE ap.id = confidence_violations.prediction_id
        AND security.user_has_tenant_access(ap.tenant_id)
    )
  );

DROP POLICY IF EXISTS "ap_tenant_isolation" ON public.agent_predictions;
CREATE POLICY "ap_tenant_isolation" ON public.agent_predictions
  FOR SELECT
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

-- Policies from tenant isolation backfill migration
DROP POLICY IF EXISTS tenant_isolation_cases ON public.cases;
CREATE POLICY tenant_isolation_cases ON public.cases
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_messages ON public.messages;
CREATE POLICY tenant_isolation_messages ON public.messages
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_agent_sessions ON public.agent_sessions;
CREATE POLICY tenant_isolation_agent_sessions ON public.agent_sessions
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_agent_predictions ON public.agent_predictions;
CREATE POLICY tenant_isolation_agent_predictions ON public.agent_predictions
  FOR ALL
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

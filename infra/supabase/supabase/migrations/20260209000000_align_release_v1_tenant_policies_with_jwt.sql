-- No new tables created; no RLS action required in this migration.
-- ============================================================================
-- Align release_v1 tenant-scoped policies with JWT tenant claim enforcement
-- ============================================================================

-- automated_responses
DROP POLICY IF EXISTS automated_responses_tenant_isolation ON public.automated_responses;
CREATE POLICY automated_responses_tenant_isolation
  ON public.automated_responses
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- cases
DROP POLICY IF EXISTS cases_tenant_isolation ON public.cases;
CREATE POLICY cases_tenant_isolation
  ON public.cases
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- compliance_evidence
DROP POLICY IF EXISTS compliance_evidence_tenant_isolation ON public.compliance_evidence;
CREATE POLICY compliance_evidence_tenant_isolation
  ON public.compliance_evidence
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- compliance_reports
DROP POLICY IF EXISTS compliance_reports_tenant_isolation ON public.compliance_reports;
CREATE POLICY compliance_reports_tenant_isolation
  ON public.compliance_reports
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- confidence_violations
DROP POLICY IF EXISTS cv_tenant_isolation ON public.confidence_violations;
CREATE POLICY cv_tenant_isolation
  ON public.confidence_violations
  FOR SELECT
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

-- device_trust_history
DROP POLICY IF EXISTS device_trust_tenant_isolation ON public.device_trust_history;
CREATE POLICY device_trust_tenant_isolation
  ON public.device_trust_history
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- messages
DROP POLICY IF EXISTS messages_tenant_isolation ON public.messages;
CREATE POLICY messages_tenant_isolation
  ON public.messages
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- security_events
DROP POLICY IF EXISTS security_events_tenant_isolation ON public.security_events;
CREATE POLICY security_events_tenant_isolation
  ON public.security_events
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- security_incidents
DROP POLICY IF EXISTS security_incidents_tenant_isolation ON public.security_incidents;
CREATE POLICY security_incidents_tenant_isolation
  ON public.security_incidents
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- security_policies
DROP POLICY IF EXISTS security_policies_tenant_isolation ON public.security_policies;
CREATE POLICY security_policies_tenant_isolation
  ON public.security_policies
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- agent_predictions
DROP POLICY IF EXISTS strict_tenant_isolation_insert ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_insert
  ON public.agent_predictions
  FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS strict_tenant_isolation_select ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_select
  ON public.agent_predictions
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS strict_tenant_isolation_update ON public.agent_predictions;
CREATE POLICY strict_tenant_isolation_update
  ON public.agent_predictions
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- agent_sessions
DROP POLICY IF EXISTS tenant_isolation_delete ON public.agent_sessions;
CREATE POLICY tenant_isolation_delete
  ON public.agent_sessions
  FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_insert ON public.agent_sessions;
CREATE POLICY tenant_isolation_insert
  ON public.agent_sessions
  FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_select ON public.agent_sessions;
CREATE POLICY tenant_isolation_select
  ON public.agent_sessions
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS tenant_isolation_update ON public.agent_sessions;
CREATE POLICY tenant_isolation_update
  ON public.agent_sessions
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- tenants
DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select
  ON public.tenants
  FOR SELECT
  USING (security.user_has_tenant_access(id));

-- user_sessions
DROP POLICY IF EXISTS user_sessions_tenant_isolation ON public.user_sessions;
CREATE POLICY user_sessions_tenant_isolation
  ON public.user_sessions
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- workflows
DROP POLICY IF EXISTS workflows_tenant_isolation ON public.workflows;
CREATE POLICY workflows_tenant_isolation
  ON public.workflows
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

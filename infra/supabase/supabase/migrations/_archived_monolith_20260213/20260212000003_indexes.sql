-- ============================================================================
-- 003_indexes.sql — Consolidated indexes for ValueOS
-- Merges indexes from 8+ deferred migration files. All use IF NOT EXISTS
-- to be idempotent with indexes already created in 001_schema.sql.
-- CONCURRENTLY removed since migrations run inside transactions.
-- ============================================================================

-- ============================================================================
-- Cursor pagination indexes (org-scoped)
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_id
  ON public.audit_logs (organization_id, created_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cases_org_status_updated_id
  ON public.cases (organization_id, status, updated_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflows_org_updated_id
  ON public.workflows (organization_id, updated_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_users_org_status_created_id
  ON public.users (organization_id, status, created_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_runs_org_status_created_id
  ON public.agent_runs (organization_id, status, created_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Full-text search indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cases_fts
  ON public.cases USING GIN (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_models_fts
  ON public.models USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Trigram indexes for fuzzy/ILIKE queries
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cases_title_trgm
  ON public.cases USING GIN (lower(title) gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_models_name_trgm
  ON public.models USING GIN (lower(name) gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflows_name_trgm
  ON public.workflows USING GIN (lower(name) gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- JSONB indexes for metadata/config filtering
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cases_metadata_gin
  ON public.cases USING GIN (metadata);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflows_definition_gin
  ON public.workflows USING GIN (definition);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agents_config_gin
  ON public.agents USING GIN (config);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_shared_artifacts_content_gin
  ON public.shared_artifacts USING GIN (content);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Tenant hot-path indexes (tenant_id leading)
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_endpoint_created_at
  ON public.llm_usage (tenant_id, endpoint, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_created
  ON public.llm_usage (tenant_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action_created_at
  ON public.audit_logs (organization_id, action, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_created_at
  ON public.audit_logs (tenant_id, action, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_id
  ON public.audit_logs (tenant_id, created_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_org
  ON public.audit_logs (resource_id, organization_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_trace_id
  ON public.audit_logs (trace_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id
  ON public.audit_logs (request_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_messages_tenant_case_created_at
  ON public.messages (tenant_id, case_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_messages_tenant_workflow_created_at
  ON public.messages (tenant_id, workflow_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_messages_case_tenant
  ON public.messages (case_id, tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_messages_workflow_tenant
  ON public.messages (workflow_id, tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Opportunities indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_opportunities_value_case_tenant
  ON public.opportunities (value_case_id, tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_value_case
  ON public.opportunities (tenant_id, value_case_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_status_created_at
  ON public.opportunities (tenant_id, status, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_created_at_amount
  ON public.opportunities (tenant_id, created_at DESC, amount DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_status_value_case
  ON public.opportunities (tenant_id, status, value_case_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_amount_created_at
  ON public.opportunities (tenant_id, amount DESC, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Value cases indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_cases_tenant_status_updated_at
  ON public.value_cases (tenant_id, status, updated_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_cases_tenant_session_created_at
  ON public.value_cases (tenant_id, session_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Cases tenant indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cases_tenant_status_updated_at
  ON public.cases (tenant_id, status, updated_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cases_tenant_status_updated_id
  ON public.cases (tenant_id, status, updated_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cases_user_org
  ON public.cases (user_id, organization_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Agent runs tenant indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_status_created_id
  ON public.agent_runs (tenant_id, status, created_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_type_created_at
  ON public.agent_runs (tenant_id, agent_type, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_org
  ON public.agent_runs (agent_id, organization_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_runs_user_org
  ON public.agent_runs (user_id, organization_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Agent metrics tenant indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_metrics_tenant_type_created_at
  ON public.agent_metrics (tenant_id, metric_type, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_metrics_tenant_session_created_at
  ON public.agent_metrics (tenant_id, session_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_metrics_tenant_agent_created_at
  ON public.agent_metrics (tenant_id, agent_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_agent_metrics_tenant_value_created_at
  ON public.agent_metrics (tenant_id, metric_value DESC, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Workflow indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflow_states_tenant_status_started_id
  ON public.workflow_states (tenant_id, status, started_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflow_states_org_status_started_id
  ON public.workflow_states (organization_id, status, started_at DESC, id DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflow_states_case_org
  ON public.workflow_states (case_id, organization_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflow_states_workflow_org
  ON public.workflow_states (workflow_id, organization_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_status_created_at
  ON public.workflow_executions (tenant_id, status, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Shared artifacts indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_shared_artifacts_tenant_case_created_at
  ON public.shared_artifacts (tenant_id, case_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_shared_artifacts_org_case_created_at
  ON public.shared_artifacts (organization_id, case_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_shared_artifacts_case_org
  ON public.shared_artifacts (case_id, organization_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Usage and billing indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_usage_aggregates_tenant_period_start_metric
  ON public.usage_aggregates (tenant_id, period_start DESC, metric);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_usage_alerts_tenant_created_at_metric_alert_type
  ON public.usage_alerts (tenant_id, created_at DESC, metric, alert_type);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_events_tenant_action_timestamp
  ON public.security_audit_events (tenant_id, action, "timestamp" DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_user
  ON public.user_sessions (tenant_id, user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Invoice uniqueness
-- ============================================================================

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_invoice_number_unique
  ON public.invoices (tenant_id, invoice_number)
  WHERE invoice_number IS NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Tenants indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants (status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_tenants_tier ON public.tenants (tier);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Auth multi-tenant indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_memberships_tenant_user ON public.memberships(tenant_id, user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON public.user_tenants (tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON public.user_tenants (user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_user_tenants_status ON public.user_tenants (status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Value commitment tracking indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_tenant ON public.value_commitments(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_user ON public.value_commitments(user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_session ON public.value_commitments(session_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_status ON public.value_commitments(status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_priority ON public.value_commitments(priority);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_target_date ON public.value_commitments(target_completion_date);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_tags ON public.value_commitments USING GIN (tags);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_value_commitments_ground_truth ON public.value_commitments USING GIN (ground_truth_references);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_tenant ON public.commitment_stakeholders(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_commitment ON public.commitment_stakeholders(commitment_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_user ON public.commitment_stakeholders(user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_stakeholders_active ON public.commitment_stakeholders(commitment_id, is_active);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_milestones_tenant ON public.commitment_milestones(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_milestones_commitment ON public.commitment_milestones(commitment_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_milestones_status ON public.commitment_milestones(status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_milestones_target_date ON public.commitment_milestones(target_date);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_milestones_assigned_to ON public.commitment_milestones(assigned_to);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_metrics_tenant ON public.commitment_metrics(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_metrics_commitment ON public.commitment_metrics(commitment_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_metrics_type ON public.commitment_metrics(metric_type);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_metrics_active ON public.commitment_metrics(commitment_id, is_active);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_metrics_next_measurement ON public.commitment_metrics(next_measurement_date);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_audits_tenant ON public.commitment_audits(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_audits_commitment ON public.commitment_audits(commitment_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_audits_user ON public.commitment_audits(user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_audits_action ON public.commitment_audits(action);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_audits_created_at ON public.commitment_audits(created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_risks_tenant ON public.commitment_risks(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_risks_commitment ON public.commitment_risks(commitment_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_risks_owner ON public.commitment_risks(owner_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_risks_status ON public.commitment_risks(status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_risks_score ON public.commitment_risks(risk_score);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commitment_risks_review_date ON public.commitment_risks(review_date);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Initiatives indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_initiatives_tenant ON public.initiatives(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_initiatives_status ON public.initiatives(tenant_id, status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_initiatives_category ON public.initiatives(tenant_id, category);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_initiatives_priority ON public.initiatives(tenant_id, priority);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_initiatives_created_at ON public.initiatives(tenant_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Invitations indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON public.invitations(tenant_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Referral indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON public.referrals(referee_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON public.referral_rewards(user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON public.referral_rewards(status);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Security audit log indexes
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_log_ext_timestamp ON public.security_audit_log_extended(timestamp DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_log_ext_tenant_timestamp ON public.security_audit_log_extended(tenant_id, timestamp DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_log_ext_event_type ON public.security_audit_log_extended(event_type);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_log_ext_actor_id ON public.security_audit_log_extended(actor_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_log_ext_correlation_id ON public.security_audit_log_extended(correlation_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_log_ext_risk_score ON public.security_audit_log_extended(risk_score) WHERE risk_score >= 0.7;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_security_audit_log_ext_compliance_flags ON public.security_audit_log_extended USING GIN(compliance_flags);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Docs embeddings index
-- ============================================================================

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_docs_embeddings_path ON public.docs_embeddings(path);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Dynamic: add tenant_id index on any table that has tenant_id but no index
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND NOT EXISTS (
        SELECT 1 FROM pg_indexes pi
        WHERE pi.schemaname = 'public'
          AND pi.tablename = c.table_name
          AND pi.indexdef LIKE '%tenant_id%'
      )
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON public.%I (tenant_id);',
      r.table_name, r.table_name
    );
  END LOOP;
END $$;

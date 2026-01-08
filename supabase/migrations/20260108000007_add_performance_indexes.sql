-- Add performance indexes for newly added foreign key columns and frequently queried fields
-- This improves query performance and reduces database load

BEGIN;

-- Indexes for value_cases table (recently added tenant_id)
CREATE INDEX IF NOT EXISTS idx_value_cases_tenant_id_session_id ON public.value_cases USING btree (tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_value_cases_created_at ON public.value_cases USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_cases_status ON public.value_cases USING btree (status);

-- Composite indexes for workflow_executions foreign keys
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_user_org ON public.workflow_executions USING btree (tenant_id, user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_session_status ON public.workflow_executions USING btree (session_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at_status ON public.workflow_executions USING btree (created_at DESC, status);

-- Indexes for agent_memory performance
CREATE INDEX IF NOT EXISTS idx_agent_memory_tenant_type_importance ON public.agent_memory USING btree (tenant_id, memory_type, importance DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_created_at ON public.agent_memory USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_content_gin ON public.agent_memory USING gin (to_tsvector('english', content));

-- Indexes for agent_sessions performance
CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_status_created ON public.agent_sessions USING btree (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_created ON public.agent_sessions USING btree (user_id, created_at DESC);

-- Indexes for organizations performance
CREATE INDEX IF NOT EXISTS idx_organizations_tenant_active ON public.organizations USING btree (tenant_id, is_active) WHERE is_active = true;

-- Indexes for users performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_active ON public.users USING btree (tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_email_tenant ON public.users USING btree (email, tenant_id);

-- Indexes for agent_performance_summary performance
CREATE INDEX IF NOT EXISTS idx_agent_performance_tenant_created ON public.agent_performance_summary USING btree (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_success ON public.agent_performance_summary USING btree (agent_id, is_success, created_at DESC);

-- Indexes for llm_gating performance
CREATE INDEX IF NOT EXISTS idx_llm_gating_tenant_enabled ON public.llm_gating USING btree (tenant_id, is_enabled);

-- Indexes for progressive_rollouts performance
CREATE INDEX IF NOT EXISTS idx_progressive_rollouts_tenant_active ON public.progressive_rollouts USING btree (tenant_id, is_active);

-- Indexes for feature_flags performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_name_enabled ON public.feature_flags USING btree (name, is_enabled);

-- Indexes for integration_configs performance (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_configs' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant_type ON public.integration_configs USING btree (tenant_id, integration_type);
        CREATE INDEX IF NOT EXISTS idx_integration_configs_active ON public.integration_configs USING btree (is_active) WHERE is_active = true;
    END IF;
END $$;

-- Partial indexes for active records to improve query performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_active ON public.workflow_executions USING btree (created_at DESC) WHERE status NOT IN ('completed', 'failed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_agent_sessions_active ON public.agent_sessions USING btree (created_at DESC) WHERE is_active = true AND is_completed = false;

-- GIN indexes for full-text search on JSONB fields
CREATE INDEX IF NOT EXISTS idx_value_cases_business_case_gin ON public.value_cases USING gin (business_case);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_metadata_gin ON public.agent_sessions USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_input_gin ON public.workflow_executions USING gin (input_params) WHERE input_params IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_executions_output_gin ON public.workflow_executions USING gin (output_data) WHERE output_data IS NOT NULL;

COMMIT;
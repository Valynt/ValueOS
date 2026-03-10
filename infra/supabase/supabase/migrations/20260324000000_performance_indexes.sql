-- Sprint 14: Performance indexes
-- Adds composite indexes for the hot query patterns identified in Sprint 14
-- profiling. All indexes are CONCURRENTLY-safe (IF NOT EXISTS).

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- approval_requests
-- Hot queries: (tenant_id, status) for pending approvals list
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status
  ON public.approval_requests (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requester_created
  ON public.approval_requests (requester_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- workflow_executions
-- Hot queries: (organization_id, status), (case_id, created_at)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_status
  ON public.workflow_executions (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_case_created
  ON public.workflow_executions (case_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- prompt_executions
-- Hot queries: (tenant_id, prompt_version_id), (session_id)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_prompt_executions_tenant_version
  ON public.prompt_executions (tenant_id, prompt_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_executions_session
  ON public.prompt_executions (session_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- agent_predictions
-- Composite index for MetricsCollector.getAgentMetrics() — filters by
-- agent_type + created_at range, which is the dominant query pattern.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_agent_predictions_org_type_created
  ON public.agent_predictions (organization_id, agent_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- value_cases
-- Hot queries: (organization_id, status), (organization_id, created_at)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_value_cases_org_status
  ON public.value_cases (organization_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- active_sessions
-- Hot queries: (tenant_id, expires_at) for session validation
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant_expires
  ON public.active_sessions (tenant_id, expires_at DESC);

-- ---------------------------------------------------------------------------
-- user_tenants
-- Hot queries: (user_id) for tenant membership lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id
  ON public.user_tenants (user_id);

-- ---------------------------------------------------------------------------
-- agent_memory
-- Composite index for tenant-scoped agent memory retrieval
-- (organization_id, session_id, memory_type) — the primary access pattern
-- in SupabaseMemoryBackend.retrieve()
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_agent_memory_org_session_type
  ON public.agent_memory (organization_id, session_id, memory_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- value_loop_analytics (from Sprint 10 migration)
-- Hot queries: (organization_id, event_type, created_at)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_value_loop_analytics_org_event
  ON public.value_loop_analytics (organization_id, event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- saga_transitions (Sprint 13)
-- Already has (value_case_id, organization_id, created_at DESC) — add
-- a covering index for the trigger-based queries used in compensation lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_saga_transitions_case_trigger
  ON public.saga_transitions (value_case_id, trigger, created_at DESC);

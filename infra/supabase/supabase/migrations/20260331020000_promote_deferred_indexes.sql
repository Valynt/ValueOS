-- Promote deferred performance indexes now that their tables exist.
-- Source: _deferred/20260324000000_performance_indexes_deferred.sql
--
-- Indexes for workflow_executions, prompt_executions, agent_predictions,
-- and active_sessions are promoted here. The value_loop_analytics index
-- is intentionally omitted — that table does not exist and value_loop_events
-- (20260320000000) is the canonical analytics table with its own indexes.

SET search_path = public, pg_temp;

-- workflow_executions (created in 20260331010000)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_status
  ON public.workflow_executions (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_case_created
  ON public.workflow_executions (case_id, created_at DESC);

-- prompt_executions (created in 20260331010000)
CREATE INDEX IF NOT EXISTS idx_prompt_executions_tenant_version
  ON public.prompt_executions (tenant_id, prompt_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_executions_session
  ON public.prompt_executions (session_id, created_at DESC);

-- agent_predictions (created in 20260331010000)
CREATE INDEX IF NOT EXISTS idx_agent_predictions_org_type_created
  ON public.agent_predictions (organization_id, agent_type, created_at DESC);

-- active_sessions (created in 20260331010000)
CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant_expires
  ON public.active_sessions (tenant_id, expires_at DESC);

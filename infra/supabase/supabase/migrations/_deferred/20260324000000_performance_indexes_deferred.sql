-- Deferred Sprint 14 indexes — tables do not yet have active migrations.
--
-- Promote this file to the active migrations directory only after the
-- following tables have been created by active migrations:
--   - workflow_executions
--   - prompt_executions
--   - agent_predictions
--   - active_sessions
--   - value_loop_analytics
--
-- Each block notes which migration must precede it.

SET search_path = public, pg_temp;

-- Requires: migration creating workflow_executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_status
  ON public.workflow_executions (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_case_created
  ON public.workflow_executions (case_id, created_at DESC);

-- Requires: migration creating prompt_executions
CREATE INDEX IF NOT EXISTS idx_prompt_executions_tenant_version
  ON public.prompt_executions (tenant_id, prompt_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_executions_session
  ON public.prompt_executions (session_id, created_at DESC);

-- Requires: migration creating agent_predictions
CREATE INDEX IF NOT EXISTS idx_agent_predictions_org_type_created
  ON public.agent_predictions (organization_id, agent_type, created_at DESC);

-- Requires: migration creating active_sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant_expires
  ON public.active_sessions (tenant_id, expires_at DESC);

-- Requires: migration creating value_loop_analytics
-- Note: the active chain has value_loop_events (Sprint 10); this table is
-- distinct. Confirm whether value_loop_analytics is a planned replacement
-- or a separate table before promoting.
CREATE INDEX IF NOT EXISTS idx_value_loop_analytics_org_event
  ON public.value_loop_analytics (organization_id, event_type, created_at DESC);

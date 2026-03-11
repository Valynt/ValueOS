-- Deferred table migrations: workflow_executions, prompt_executions,
-- agent_predictions, active_sessions.
--
-- These tables were referenced by production code (HumanCheckpointService,
-- WorkflowCompensation, PromptVersionControl, ValuePredictionTracker,
-- MetricsCollector, PresenceService) but had no active migration.
-- The deferred performance indexes in _deferred/ can be promoted once
-- this migration is applied.
--
-- Note: value_loop_analytics is intentionally omitted. No backend code
-- references it; value_loop_events (20260320000000) is the canonical table.
-- The deferred index for value_loop_analytics should be removed.

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. workflow_executions
-- Tracks execution state for workflow DAG runs.
-- Used by HumanCheckpointService (pause/resume) and WorkflowCompensation
-- (rollback). Linked to workflow_checkpoints via execution_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL,
  case_id         uuid,
  workflow_id     text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending', 'in_progress', 'waiting_approval',
                                'completed', 'failed', 'rolled_back', 'cancelled'
                              )),
  context         jsonb       NOT NULL DEFAULT '{}',
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_status
  ON public.workflow_executions (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_case_created
  ON public.workflow_executions (case_id, created_at DESC);

ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_executions_tenant_select ON public.workflow_executions
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_executions_tenant_insert ON public.workflow_executions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_executions_tenant_update ON public.workflow_executions
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_executions_tenant_delete ON public.workflow_executions
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_executions TO authenticated;
GRANT ALL ON public.workflow_executions TO service_role;

-- ============================================================================
-- 2. workflow_execution_logs
-- Per-stage execution log entries. Referenced by WorkflowCompensation to
-- identify completed stages for rollback ordering.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workflow_execution_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id    uuid        NOT NULL REFERENCES public.workflow_executions (id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL,
  stage_id        text,
  event_type      text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  input_data      jsonb       NOT NULL DEFAULT '{}',
  output_data     jsonb       NOT NULL DEFAULT '{}',
  metadata        jsonb       NOT NULL DEFAULT '{}',
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_execution
  ON public.workflow_execution_logs (execution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_org
  ON public.workflow_execution_logs (organization_id, created_at DESC);

ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_execution_logs_tenant_select ON public.workflow_execution_logs
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_execution_logs_tenant_insert ON public.workflow_execution_logs
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY workflow_execution_logs_tenant_delete ON public.workflow_execution_logs
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, DELETE ON public.workflow_execution_logs TO authenticated;
GRANT ALL ON public.workflow_execution_logs TO service_role;

-- ============================================================================
-- 3. prompt_executions
-- Records each prompt render + LLM call for observability and A/B testing.
-- Used by PromptVersionControl to track latency, cost, tokens, and feedback.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prompt_executions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  prompt_version_id   uuid        NOT NULL,
  user_id             uuid,
  session_id          text,
  variables           jsonb       NOT NULL DEFAULT '{}',
  rendered_prompt     text        NOT NULL DEFAULT '',
  response            text,
  latency             integer,
  cost                numeric(10, 6),
  tokens              jsonb,
  success             boolean,
  error               text,
  feedback            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_executions_tenant_version
  ON public.prompt_executions (tenant_id, prompt_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_executions_session
  ON public.prompt_executions (session_id, created_at DESC);

ALTER TABLE public.prompt_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY prompt_executions_tenant_select ON public.prompt_executions
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY prompt_executions_tenant_insert ON public.prompt_executions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY prompt_executions_tenant_update ON public.prompt_executions
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

GRANT SELECT, INSERT, UPDATE ON public.prompt_executions TO authenticated;
GRANT ALL ON public.prompt_executions TO service_role;

-- ============================================================================
-- 4. agent_predictions
-- Stores per-agent prediction records with confidence scores and outcomes.
-- Used by ValuePredictionTracker, MetricsCollector, and ConfidenceMonitor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_predictions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL,
  session_id          text,
  agent_id            text,
  agent_type          text        NOT NULL,
  prediction          jsonb       NOT NULL DEFAULT '{}',
  confidence_score    numeric(4, 3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  actual_outcome      jsonb,
  outcome_recorded_at timestamptz,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_predictions_org_type_created
  ON public.agent_predictions (organization_id, agent_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_predictions_session
  ON public.agent_predictions (session_id, created_at DESC);

ALTER TABLE public.agent_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_predictions_tenant_select ON public.agent_predictions
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY agent_predictions_tenant_insert ON public.agent_predictions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY agent_predictions_tenant_update ON public.agent_predictions
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, UPDATE ON public.agent_predictions TO authenticated;
GRANT ALL ON public.agent_predictions TO service_role;

-- ============================================================================
-- 5. active_sessions
-- Real-time presence tracking per user/page. Used by PresenceService for
-- heartbeat, page-level user lists, and realtime subscriptions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.active_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  tenant_id       uuid        NOT NULL,
  page_path       text,
  action          text        NOT NULL DEFAULT 'viewing',
  metadata        jsonb       NOT NULL DEFAULT '{}',
  last_heartbeat  timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant_expires
  ON public.active_sessions (tenant_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_sessions_page_heartbeat
  ON public.active_sessions (page_path, last_heartbeat DESC);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_tenant
  ON public.active_sessions (user_id, tenant_id);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_sessions_tenant_select ON public.active_sessions
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY active_sessions_tenant_insert ON public.active_sessions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY active_sessions_tenant_update ON public.active_sessions
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY active_sessions_tenant_delete ON public.active_sessions
  FOR DELETE USING (security.user_has_tenant_access(tenant_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_sessions TO authenticated;
GRANT ALL ON public.active_sessions TO service_role;

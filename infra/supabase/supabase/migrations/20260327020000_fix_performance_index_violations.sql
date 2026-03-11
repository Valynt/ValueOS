-- Fix 8 migration chain integrity violations found in 20260324000000_performance_indexes.sql.
--
-- Violations by category:
--   A. Wrong table name: usage_records (phantom) → usage_events
--   B. Missing table: active_sessions has no CREATE TABLE; drop the index
--   C. Wrong table name: value_loop_analytics → value_loop_events
--   D. Missing columns: workflow_executions lacks created_at, case_id
--   E. Missing column: prompt_executions lacks session_id
--   F. Missing column: agent_predictions lacks organization_id

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- A. usage_records → usage_events (cleanup)
-- 20260302100000 originally created idx_usage_records_unaggregated on the
-- phantom table usage_records. Drop the orphaned index if it was applied.
-- The correct index (idx_usage_events_unaggregated) is now in 20260302100000.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_usage_records_unaggregated;

-- ---------------------------------------------------------------------------
-- B. active_sessions — table never created; drop the orphaned index
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_active_sessions_tenant_expires;

-- ---------------------------------------------------------------------------
-- C. value_loop_analytics → value_loop_events
-- The Sprint 10 migration created value_loop_events, not value_loop_analytics.
-- Drop the wrong index; the correct one already exists in 20260320000000.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_value_loop_analytics_org_event;

-- ---------------------------------------------------------------------------
-- D. workflow_executions — add missing columns, then fix indexes
-- ---------------------------------------------------------------------------

ALTER TABLE public.workflow_executions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.value_cases(id) ON DELETE SET NULL;

-- Drop the broken indexes from 20260324000000 and recreate correctly.
DROP INDEX IF EXISTS public.idx_workflow_executions_org_status;
DROP INDEX IF EXISTS public.idx_workflow_executions_case_created;

CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_status
  ON public.workflow_executions (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_case_created
  ON public.workflow_executions (case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- E. prompt_executions — add missing session_id column, then fix index
-- ---------------------------------------------------------------------------

ALTER TABLE public.prompt_executions
  ADD COLUMN IF NOT EXISTS session_id text;

DROP INDEX IF EXISTS public.idx_prompt_executions_session;

CREATE INDEX IF NOT EXISTS idx_prompt_executions_session
  ON public.prompt_executions (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- F. agent_predictions — add missing organization_id column, then fix index
-- ---------------------------------------------------------------------------

ALTER TABLE public.agent_predictions
  ADD COLUMN IF NOT EXISTS organization_id uuid;

DROP INDEX IF EXISTS public.idx_agent_predictions_org_type_created;

CREATE INDEX IF NOT EXISTS idx_agent_predictions_org_type_created
  ON public.agent_predictions (organization_id, agent_type, created_at DESC)
  WHERE organization_id IS NOT NULL;

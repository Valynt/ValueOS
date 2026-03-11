-- Rollback for 20260327020000_fix_performance_index_violations.sql

SET search_path = public, pg_temp;

-- Restore phantom indexes (will fail at runtime but preserve migration chain)
DROP INDEX IF EXISTS public.idx_usage_events_unprocessed;
DROP INDEX IF EXISTS public.idx_workflow_executions_org_status;
DROP INDEX IF EXISTS public.idx_workflow_executions_case_created;
DROP INDEX IF EXISTS public.idx_prompt_executions_session;
DROP INDEX IF EXISTS public.idx_agent_predictions_org_type_created;

-- Remove added columns
ALTER TABLE public.workflow_executions
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS case_id;

ALTER TABLE public.prompt_executions
  DROP COLUMN IF EXISTS session_id;

ALTER TABLE public.agent_predictions
  DROP COLUMN IF EXISTS organization_id;

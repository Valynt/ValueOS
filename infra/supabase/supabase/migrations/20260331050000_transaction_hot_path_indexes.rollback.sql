SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_workflow_execution_logs_org_execution_created;
DROP INDEX IF EXISTS public.idx_workflow_executions_org_active_created;
DROP INDEX IF EXISTS public.idx_usage_events_unprocessed_timestamp;

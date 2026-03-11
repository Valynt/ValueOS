-- Rollback: 20260331010000_deferred_tables.sql

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.active_sessions CASCADE;
DROP TABLE IF EXISTS public.agent_predictions CASCADE;
DROP TABLE IF EXISTS public.prompt_executions CASCADE;
DROP TABLE IF EXISTS public.workflow_execution_logs CASCADE;
DROP TABLE IF EXISTS public.workflow_executions CASCADE;

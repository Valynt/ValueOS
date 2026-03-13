-- Rollback: workflow_states
-- Reverses 20260806000000_workflow_states.sql

DROP TRIGGER IF EXISTS workflow_states_updated_at ON public.workflow_states;
DROP FUNCTION IF EXISTS public.set_workflow_states_updated_at();
DROP TABLE IF EXISTS public.workflow_states;

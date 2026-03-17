-- Rollback: 20260901000000_workflow_states
BEGIN;

DROP TRIGGER IF EXISTS workflow_states_updated_at ON public.workflow_states;
DROP FUNCTION IF EXISTS public.workflow_states_set_updated_at();
DROP TABLE IF EXISTS public.workflow_states;

COMMIT;

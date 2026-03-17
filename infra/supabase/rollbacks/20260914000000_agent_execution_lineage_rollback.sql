-- Rollback: agent_execution_lineage
-- Reverses 20260914000000_agent_execution_lineage.sql

SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "agent_execution_lineage_delete" ON public.agent_execution_lineage;
DROP POLICY IF EXISTS "agent_execution_lineage_update" ON public.agent_execution_lineage;
DROP POLICY IF EXISTS "agent_execution_lineage_insert" ON public.agent_execution_lineage;
DROP POLICY IF EXISTS "agent_execution_lineage_select" ON public.agent_execution_lineage;

DROP INDEX IF EXISTS public.idx_agent_execution_lineage_created_at;
DROP INDEX IF EXISTS public.idx_agent_execution_lineage_session_id;
DROP INDEX IF EXISTS public.idx_agent_execution_lineage_org_id;

DROP TABLE IF EXISTS public.agent_execution_lineage;

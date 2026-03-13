-- Rollback: 20260310000000_core_workflow_tables.sql
-- Drops hypothesis_outputs, value_tree_nodes, financial_model_snapshots,
-- and workflow_checkpoints tables created for the agentic value-case path.

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.workflow_checkpoints CASCADE;
DROP TABLE IF EXISTS public.financial_model_snapshots CASCADE;
DROP TABLE IF EXISTS public.value_tree_nodes CASCADE;
DROP TABLE IF EXISTS public.hypothesis_outputs CASCADE;

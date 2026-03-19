-- Rollback: 20260805000000_semantic_memory_filtered_read_rpc.sql

DROP FUNCTION IF EXISTS public.filter_semantic_memory(uuid, text, text, text, text, double precision, integer);

DROP INDEX IF EXISTS public.idx_semantic_memory_org_importance_created;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_memory_type;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_agent_type;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_session_created;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_type_created;

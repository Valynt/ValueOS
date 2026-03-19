SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.list_semantic_memory_filtered(
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  integer
);

DROP INDEX IF EXISTS public.idx_semantic_memory_org_type_importance_created;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_type_memory_created;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_type_agent_created;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_type_session_created;

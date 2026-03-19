SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_semantic_memory_org_tenant_context_created_at;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_artifact_id;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_type_created_at;
DROP INDEX IF EXISTS public.idx_semantic_memory_org_created_at;

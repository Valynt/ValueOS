-- Migration: add search_semantic_memory RPC
--
-- VectorSearchService.searchByEmbedding() calls supabase.rpc("search_semantic_memory")
-- but no such function existed in the migration chain — only match_semantic_memory
-- (which takes p_organization_id) and search_semantic_memory_filtered existed.
--
-- This migration creates search_semantic_memory as a SECURITY DEFINER wrapper
-- that accepts an optional filter_clause string but ALWAYS enforces
-- organization_id isolation via a mandatory p_organization_id parameter.
--
-- The old call site in VectorSearchService.searchByEmbedding() passes
-- filter_clause which may or may not include organization_id depending on
-- what the caller put in filters{}. That is unsafe. This function makes
-- organization_id mandatory at the SQL level so the RPC cannot be called
-- without a tenant scope.
--
-- Callers must migrate to pass p_organization_id explicitly.
-- VectorSearchService.searchWithTenant() is the approved production path.

SET lock_timeout = '5s';
SET statement_timeout = '15s';
SET search_path = public, pg_temp;

BEGIN;

CREATE OR REPLACE FUNCTION public.search_semantic_memory(
  query_embedding   vector(1536),
  p_organization_id uuid,
  match_threshold   float   DEFAULT 0.7,
  match_count       integer DEFAULT 10,
  filter_clause     text    DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  type         text,
  content      text,
  metadata     jsonb,
  source_agent text,
  session_id   text,
  similarity   float,
  created_at   timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- p_organization_id is mandatory — reject NULL to prevent cross-tenant leakage.
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'search_semantic_memory: p_organization_id is required';
  END IF;

  RETURN QUERY
    SELECT
      sm.id,
      sm.type,
      sm.content,
      sm.metadata,
      sm.source_agent,
      sm.session_id,
      1 - (sm.embedding <=> query_embedding) AS similarity,
      sm.created_at
    FROM public.semantic_memory sm
    WHERE
      sm.organization_id = p_organization_id
      AND sm.embedding IS NOT NULL
      AND 1 - (sm.embedding <=> query_embedding) >= match_threshold
    ORDER BY sm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_semantic_memory(vector, uuid, float, integer, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_semantic_memory(vector, uuid, float, integer, text)
  TO service_role;

COMMENT ON FUNCTION public.search_semantic_memory IS
  'Tenant-scoped vector similarity search. p_organization_id is mandatory. '
  'filter_clause parameter is accepted for backward compatibility but ignored — '
  'all filtering is done via the mandatory p_organization_id column predicate. '
  'Use match_semantic_memory for the canonical typed interface.';

COMMIT;

-- Semantic memory filtered read RPC and supporting indexes.
-- Pushes tenant-scoped memory filtering and ranking into SQL so application
-- code no longer scans full tenant result sets in process.

SET search_path = public, pg_temp;

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_type_created
  ON public.semantic_memory (organization_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_session_created
  ON public.semantic_memory (organization_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_agent_type
  ON public.semantic_memory (organization_id, ((metadata->>'agentType')));

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_memory_type
  ON public.semantic_memory (organization_id, ((metadata->>'agent_memory_type')));

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_importance_created
  ON public.semantic_memory (
    organization_id,
    (((metadata->>'importance')::double precision)) DESC,
    created_at DESC
  )
  WHERE metadata ? 'importance';

CREATE OR REPLACE FUNCTION public.filter_semantic_memory(
  p_organization_id uuid,
  p_type text DEFAULT NULL,
  p_agent_type text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_memory_type text DEFAULT NULL,
  p_min_importance double precision DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  type text,
  content text,
  embedding vector(1536),
  metadata jsonb,
  source_agent text,
  session_id text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.id,
    sm.organization_id,
    sm.type,
    sm.content,
    sm.embedding,
    sm.metadata,
    sm.source_agent,
    sm.session_id,
    sm.created_at,
    sm.updated_at
  FROM public.semantic_memory sm
  WHERE sm.organization_id = p_organization_id
    AND (p_type IS NULL OR sm.type = p_type)
    AND (p_session_id IS NULL OR sm.session_id = p_session_id)
    AND (p_agent_type IS NULL OR sm.metadata->>'agentType' = p_agent_type)
    AND (p_memory_type IS NULL OR sm.metadata->>'agent_memory_type' = p_memory_type)
    AND (
      p_min_importance IS NULL
      OR COALESCE((sm.metadata->>'importance')::double precision, 0) >= p_min_importance
    )
  ORDER BY
    COALESCE((sm.metadata->>'importance')::double precision, 0) DESC,
    sm.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.filter_semantic_memory TO authenticated;
GRANT EXECUTE ON FUNCTION public.filter_semantic_memory TO service_role;

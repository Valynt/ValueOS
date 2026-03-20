-- Agent-fabric semantic memory retrieval filters.
--
-- Moves agent/workspace/memory-type/importance filtering into SQL so
-- SupabaseMemoryBackend no longer loads a tenant's full semantic_memory set
-- and filters it in application code.

SET search_path = public, pg_temp;

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_type_session_created
  ON public.semantic_memory (organization_id, type, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_type_agent_created
  ON public.semantic_memory (
    organization_id,
    type,
    (metadata->>'agentType'),
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_type_memory_created
  ON public.semantic_memory (
    organization_id,
    type,
    (metadata->>'agent_memory_type'),
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_type_importance_created
  ON public.semantic_memory (
    organization_id,
    type,
    (((metadata->>'importance')::double precision)) DESC,
    created_at DESC
  );

CREATE OR REPLACE FUNCTION public.list_semantic_memory_filtered(
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
    AND (p_agent_type IS NULL OR sm.metadata->>'agentType' = p_agent_type)
    AND (p_session_id IS NULL OR sm.session_id = p_session_id)
    AND (p_memory_type IS NULL OR sm.metadata->>'agent_memory_type' = p_memory_type)
    AND (
      p_min_importance IS NULL
      OR COALESCE((sm.metadata->>'importance')::double precision, 0.0) >= p_min_importance
    )
  ORDER BY
    COALESCE((sm.metadata->>'importance')::double precision, 0.0) DESC,
    sm.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.list_semantic_memory_filtered(
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_semantic_memory_filtered(
  uuid,
  text,
  text,
  text,
  text,
  double precision,
  integer
) TO service_role;

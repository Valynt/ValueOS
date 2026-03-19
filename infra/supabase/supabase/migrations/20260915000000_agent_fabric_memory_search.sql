-- Agent-fabric memory retrieval should be filtered and ranked in SQL so the
-- backend does not pull large tenant result sets into Node just to filter,
-- sort, and slice them.

CREATE INDEX IF NOT EXISTS idx_semantic_memory_agent_fabric_lookup
  ON public.semantic_memory (
    organization_id,
    type,
    session_id,
    created_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_semantic_memory_agent_fabric_metadata
  ON public.semantic_memory (
    organization_id,
    ((metadata->>'agentType')),
    ((metadata->>'agent_memory_type')),
    created_at DESC
  );

CREATE OR REPLACE FUNCTION public.search_agent_fabric_memories(
  p_organization_id uuid,
  p_type text DEFAULT 'workflow_result',
  p_agent_type text DEFAULT NULL,
  p_agent_memory_type text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_include_cross_workspace boolean DEFAULT false,
  p_min_importance double precision DEFAULT NULL,
  p_limit integer DEFAULT 10
) RETURNS TABLE(
  id uuid,
  type text,
  content text,
  embedding public.vector,
  metadata jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  session_id text,
  importance double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH scoped AS (
    SELECT
      sm.id,
      sm.type,
      sm.content,
      sm.embedding,
      sm.metadata,
      sm.created_at,
      sm.updated_at,
      sm.session_id,
      CASE
        WHEN jsonb_typeof(sm.metadata->'importance') = 'number'
          THEN (sm.metadata->>'importance')::double precision
        ELSE 0.5
      END AS importance
    FROM public.semantic_memory sm
    WHERE sm.organization_id = p_organization_id
      AND (p_type IS NULL OR sm.type = p_type)
      AND (p_agent_type IS NULL OR sm.metadata->>'agentType' = p_agent_type)
      AND (
        p_agent_memory_type IS NULL
        OR sm.metadata->>'agent_memory_type' = p_agent_memory_type
      )
      AND (
        p_include_cross_workspace
        OR p_session_id IS NULL
        OR sm.session_id = p_session_id
      )
  )
  SELECT
    scoped.id,
    scoped.type,
    scoped.content,
    scoped.embedding,
    scoped.metadata,
    scoped.created_at,
    scoped.updated_at,
    scoped.session_id,
    scoped.importance
  FROM scoped
  WHERE p_min_importance IS NULL OR scoped.importance >= p_min_importance
  ORDER BY scoped.importance DESC, scoped.created_at DESC, scoped.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
$$;

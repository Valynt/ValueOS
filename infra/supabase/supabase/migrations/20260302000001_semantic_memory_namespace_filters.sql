-- Add first-class semantic memory namespace columns and typed RPC filters.

ALTER TABLE public.semantic_memory
  ADD COLUMN IF NOT EXISTS auth0_sub text,
  ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_auth0
  ON public.semantic_memory (organization_id, auth0_sub, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_session
  ON public.semantic_memory (organization_id, session_id, created_at DESC);

-- Backfill first-class namespace columns from legacy metadata keys.
WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN coalesce(metadata->>'organization_id', metadata->>'userId', metadata->>'tenantId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN coalesce(metadata->>'organization_id', metadata->>'userId', metadata->>'tenantId')::uuid
      ELSE NULL
    END AS derived_organization_id,
    NULLIF(coalesce(metadata->>'auth0_sub', metadata->>'auth0Sub', metadata->>'user_sub'), '') AS derived_auth0_sub,
    NULLIF(coalesce(metadata->>'session_id', metadata->>'workflowId', metadata->>'contextId'), '') AS derived_session_id
  FROM public.semantic_memory
)
UPDATE public.semantic_memory sm
SET
  organization_id = coalesce(sm.organization_id, n.derived_organization_id),
  auth0_sub = coalesce(sm.auth0_sub, n.derived_auth0_sub),
  session_id = coalesce(sm.session_id, n.derived_session_id),
  metadata =
    CASE
      WHEN coalesce(sm.organization_id, n.derived_organization_id) IS NULL
       AND coalesce(sm.auth0_sub, n.derived_auth0_sub) IS NULL
       AND coalesce(sm.session_id, n.derived_session_id) IS NULL
      THEN sm.metadata
      ELSE jsonb_strip_nulls(
        sm.metadata
        || jsonb_build_object(
          'organization_id', coalesce(sm.organization_id, n.derived_organization_id)::text,
          'auth0_sub', coalesce(sm.auth0_sub, n.derived_auth0_sub),
          'session_id', coalesce(sm.session_id, n.derived_session_id)
        )
      )
    END
FROM normalized n
WHERE sm.id = n.id;

-- Typed, parameterized semantic search function that avoids free-form SQL filters.
CREATE OR REPLACE FUNCTION public.search_semantic_memory(
  query_embedding public.vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 10,
  p_type text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_target_market text DEFAULT NULL,
  p_min_score double precision DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_auth0_sub text DEFAULT NULL,
  p_session_id text DEFAULT NULL
) RETURNS TABLE(
  id uuid,
  type text,
  content text,
  embedding public.vector,
  metadata jsonb,
  created_at timestamp with time zone,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sm.id,
    sm.type,
    sm.content,
    sm.embedding,
    sm.metadata,
    sm.created_at,
    1 - (sm.embedding <=> query_embedding) AS similarity
  FROM public.semantic_memory sm
  WHERE (p_type IS NULL OR sm.type = p_type)
    AND (p_industry IS NULL OR sm.metadata->>'industry' = p_industry)
    AND (p_target_market IS NULL OR sm.metadata->>'targetMarket' = p_target_market)
    AND (p_min_score IS NULL OR (sm.metadata->>'score')::double precision >= p_min_score)
    AND (p_organization_id IS NULL OR sm.organization_id = p_organization_id)
    AND (p_auth0_sub IS NULL OR sm.auth0_sub = p_auth0_sub)
    AND (p_session_id IS NULL OR sm.session_id = p_session_id)
    AND (
      match_threshold <= 0
      OR (1 - (sm.embedding <=> query_embedding)) >= match_threshold
    )
  ORDER BY sm.embedding <=> query_embedding
  LIMIT match_count;
$$;

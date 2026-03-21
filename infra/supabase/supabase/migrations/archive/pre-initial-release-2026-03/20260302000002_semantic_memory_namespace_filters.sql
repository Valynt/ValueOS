-- Add first-class semantic memory namespace columns and typed RPC filters.
-- Supabase auth is canonical (`auth.uid()`), with tenant_id required for tenancy partitioning.

ALTER TABLE public.semantic_memory
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS auth_subject text,
  ADD COLUMN IF NOT EXISTS session_id text;

-- Keep legacy naming (`organization_id`) coherent while migrating to tenant_id.
UPDATE public.semantic_memory
SET tenant_id = COALESCE(tenant_id, organization_id)
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

UPDATE public.semantic_memory
SET organization_id = COALESCE(organization_id, tenant_id)
WHERE organization_id IS NULL
  AND tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_semantic_memory_tenant_user
  ON public.semantic_memory (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_tenant_session
  ON public.semantic_memory (tenant_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_tenant_auth_subject
  ON public.semantic_memory (tenant_id, auth_subject, created_at DESC);

-- Backfill first-class namespace columns from legacy metadata keys.
WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN coalesce(metadata->>'tenant_id', metadata->>'organization_id', metadata->>'tenantId', metadata->>'userId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN coalesce(metadata->>'tenant_id', metadata->>'organization_id', metadata->>'tenantId', metadata->>'userId')::uuid
      ELSE NULL
    END AS derived_tenant_id,
    CASE
      WHEN coalesce(metadata->>'user_id', metadata->>'auth_user_id', metadata->>'sub') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN coalesce(metadata->>'user_id', metadata->>'auth_user_id', metadata->>'sub')::uuid
      ELSE NULL
    END AS derived_user_id,
    NULLIF(coalesce(metadata->>'auth_subject', metadata->>'auth0_sub', metadata->>'auth0Sub', metadata->>'user_sub', metadata->>'sub'), '') AS derived_auth_subject,
    NULLIF(coalesce(metadata->>'session_id', metadata->>'workflowId', metadata->>'contextId'), '') AS derived_session_id
  FROM public.semantic_memory
)
UPDATE public.semantic_memory sm
SET
  tenant_id = coalesce(sm.tenant_id, sm.organization_id, n.derived_tenant_id),
  organization_id = coalesce(sm.organization_id, sm.tenant_id, n.derived_tenant_id),
  user_id = coalesce(sm.user_id, n.derived_user_id),
  auth_subject = coalesce(sm.auth_subject, n.derived_auth_subject),
  session_id = coalesce(sm.session_id, n.derived_session_id),
  metadata = jsonb_strip_nulls(
    sm.metadata
    || jsonb_build_object(
      'tenant_id', coalesce(sm.tenant_id, sm.organization_id, n.derived_tenant_id)::text,
      'organization_id', coalesce(sm.organization_id, sm.tenant_id, n.derived_tenant_id)::text,
      'user_id', coalesce(sm.user_id, n.derived_user_id)::text,
      'auth_subject', coalesce(sm.auth_subject, n.derived_auth_subject),
      'session_id', coalesce(sm.session_id, n.derived_session_id)
    )
  )
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
  p_tenant_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_auth_subject text DEFAULT NULL,
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
    AND (
      COALESCE(p_tenant_id, p_organization_id) IS NULL
      OR sm.tenant_id = COALESCE(p_tenant_id, p_organization_id)
      OR sm.organization_id = COALESCE(p_tenant_id, p_organization_id)
    )
    AND (p_user_id IS NULL OR sm.user_id = p_user_id)
    AND (
      COALESCE(p_auth_subject, p_auth0_sub) IS NULL
      OR sm.auth_subject = COALESCE(p_auth_subject, p_auth0_sub)
    )
    AND (p_session_id IS NULL OR sm.session_id = p_session_id)
    AND (
      match_threshold <= 0
      OR (1 - (sm.embedding <=> query_embedding)) >= match_threshold
    )
  ORDER BY sm.embedding <=> query_embedding
  LIMIT match_count;
$$;

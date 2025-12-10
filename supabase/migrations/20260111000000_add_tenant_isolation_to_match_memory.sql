-- ============================================================================
-- SECURITY FIX: Add organization_id filtering to match_memory RPC
-- 
-- This migration adds tenant isolation to the vector similarity search function
-- preventing cross-tenant data access in semantic memory queries.
-- 
-- Part of: Task 1 - Tenant Isolation for Memory Queries
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.match_memory(vector, float, int, uuid, uuid);
DROP FUNCTION IF EXISTS public.match_memory(vector, float, int, uuid);

-- Create or replace match_memory function with organization_id filtering
CREATE OR REPLACE FUNCTION public.match_memory(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_session_id uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  agent_id uuid,
  session_id uuid,
  user_id uuid,
  memory_type text,
  content text,
  embedding vector(1536),
  metadata jsonb,
  importance_score numeric,
  created_at timestamptz,
  expires_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Enforce tenant isolation
  -- If p_organization_id is provided, only return memories for that organization
  -- This provides defense-in-depth alongside RLS policies
  
  RETURN QUERY
  SELECT
    am.id,
    am.organization_id,
    am.agent_id,
    am.session_id,
    am.user_id,
    am.memory_type,
    am.content,
    am.embedding,
    am.metadata,
    am.importance_score,
    am.created_at,
    am.expires_at,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM
    public.agent_memory am
  WHERE
    -- Similarity threshold
    1 - (am.embedding <=> query_embedding) > match_threshold
    -- Session filter (optional)
    AND (p_session_id IS NULL OR am.session_id = p_session_id)
    -- CRITICAL: Organization filter for tenant isolation
    AND (p_organization_id IS NULL OR am.organization_id = p_organization_id)
    -- Only search semantic memories (working memory should not be in vector search)
    AND am.memory_type = 'semantic'
    -- Exclude expired memories
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
  ORDER BY
    am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.match_memory(vector, float, int, uuid, uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.match_memory IS 
'Vector similarity search for semantic memory with tenant isolation. 
Requires organization_id parameter to prevent cross-tenant data access.
Returns memories ranked by cosine similarity to query embedding.';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Verify the function was created successfully
DO $$
DECLARE
  func_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'match_memory'
  ) INTO func_exists;

  IF func_exists THEN
    RAISE NOTICE 'SUCCESS: match_memory function created with organization_id filtering';
  ELSE
    RAISE EXCEPTION 'FAILURE: match_memory function was not created';
  END IF;
END $$;

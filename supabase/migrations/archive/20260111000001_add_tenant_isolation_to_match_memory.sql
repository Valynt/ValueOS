-- Update match_memory() to support tenant isolation via p_organization_id

DO $$
BEGIN
  -- Replace the match_memory function to include organization filter
  CREATE OR REPLACE FUNCTION public.match_memory(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    p_session_id uuid DEFAULT NULL,
    p_organization_id uuid DEFAULT NULL
  )
  RETURNS TABLE (
    id uuid,
    session_id uuid,
    agent_id uuid,
    memory_type text,
    content text,
    embedding vector(1536),
    metadata jsonb,
    created_at timestamptz,
    similarity float
  ) AS $func$
  DECLARE
    sql_query text;
    org_filter text := '';
  BEGIN
    IF p_organization_id IS NOT NULL THEN
      org_filter := format('AND organization_id = %L', p_organization_id::text);
    END IF;

    sql_query := format('
      SELECT
        id,
        session_id,
        agent_id,
        memory_type,
        content,
        embedding,
        metadata,
        created_at,
        1 - (embedding <=> $1) AS similarity
      FROM agent_memory
      WHERE memory_type = ''semantic''
        %s
        %s
      ORDER BY embedding <=> $1
      LIMIT $2
    ',
    CASE WHEN match_threshold > 0 THEN format('AND 1 - (embedding <=> $1) >= %s', match_threshold) ELSE '' END,
    org_filter
    );

    RETURN QUERY EXECUTE sql_query USING query_embedding, match_count;
  END;
  $func$ LANGUAGE plpgsql;
END
$$;

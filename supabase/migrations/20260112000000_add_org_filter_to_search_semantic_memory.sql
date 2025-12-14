-- Add organization_id filter to search_semantic_memory function

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_semantic_memory') THEN
    CREATE OR REPLACE FUNCTION search_semantic_memory(
      query_embedding vector(1536),
      match_threshold float DEFAULT 0.7,
      match_count int DEFAULT 10,
      filter_clause text DEFAULT '',
      p_organization_id uuid DEFAULT NULL
    )
    RETURNS TABLE (
      id uuid,
      type text,
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

      sql_query := format(''
        SELECT 
          id,
          type,
          content,
          embedding,
          metadata,
          created_at,
          1 - (embedding <=> $1) as similarity
        FROM semantic_memory
        %s
        %s
        %s
        ORDER BY embedding <=> $1
        LIMIT $2
      '',
      CASE WHEN filter_clause != '' THEN filter_clause ELSE '' END,
      CASE WHEN match_threshold > 0 THEN format('AND 1 - (embedding <=> $1) >= %s', match_threshold) ELSE '' END,
      org_filter
      );

      RETURN QUERY EXECUTE sql_query USING query_embedding, match_count;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END
$$;

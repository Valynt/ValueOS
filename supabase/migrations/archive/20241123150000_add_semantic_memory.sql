-- Semantic Memory Schema with pgvector
-- Enables long-term semantic memory for RAG (Retrieval-Augmented Generation)

-- Enable pgvector extension (skip if not available in test environments)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN undefined_file THEN
    RAISE NOTICE 'pgvector extension not available, skipping semantic memory features';
END
$$;

-- Semantic Memory Table (only if pgvector is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS semantic_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL CHECK (type IN ('value_proposition', 'target_definition', 'opportunity', 'integrity_check', 'workflow_result')),
      content TEXT NOT NULL,
      embedding vector(1536),
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_semantic_memory_type ON semantic_memory(type);
    CREATE INDEX IF NOT EXISTS idx_semantic_memory_created ON semantic_memory(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_semantic_memory_metadata_gin ON semantic_memory USING gin(metadata);
    CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding ON semantic_memory 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    
    RAISE NOTICE 'Semantic memory table created successfully';
  ELSE
    RAISE NOTICE 'Skipping semantic memory table creation - pgvector not available';
  END IF;
END
$$;

-- Functions (only if pgvector is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Semantic search function
    CREATE OR REPLACE FUNCTION search_semantic_memory(
      query_embedding vector(1536),
      match_threshold float DEFAULT 0.7,
      match_count int DEFAULT 10,
      filter_clause text DEFAULT ''
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
    BEGIN
      sql_query := format('
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
        ORDER BY embedding <=> $1
        LIMIT $2
      ',
      CASE WHEN filter_clause != '' THEN filter_clause ELSE '' END,
      CASE WHEN match_threshold > 0 THEN format('AND 1 - (embedding <=> $1) >= %s', match_threshold) ELSE '' END
      );
      
      RETURN QUERY EXECUTE sql_query USING query_embedding, match_count;
    END;
    $func$ LANGUAGE plpgsql;

    -- Get memories by industry
    CREATE OR REPLACE FUNCTION get_memories_by_industry(
      p_industry text,
      p_type text DEFAULT NULL,
      p_limit int DEFAULT 10
    )
    RETURNS TABLE (
      id uuid,
      type text,
      content text,
      metadata jsonb,
      created_at timestamptz
    ) AS $func$
    BEGIN
      RETURN QUERY
      SELECT 
        sm.id,
        sm.type,
        sm.content,
        sm.metadata,
        sm.created_at
      FROM semantic_memory sm
      WHERE sm.metadata->>'industry' = p_industry
        AND (p_type IS NULL OR sm.type = p_type)
      ORDER BY sm.created_at DESC
      LIMIT p_limit;
    END;
    $func$ LANGUAGE plpgsql;

    -- Get high-scoring memories
    CREATE OR REPLACE FUNCTION get_high_scoring_memories(
      p_type text,
      p_min_score float DEFAULT 0.7,
      p_limit int DEFAULT 10
    )
    RETURNS TABLE (
      id uuid,
      type text,
      content text,
      metadata jsonb,
      score float,
      created_at timestamptz
    ) AS $func$
    BEGIN
      RETURN QUERY
      SELECT 
        sm.id,
        sm.type,
        sm.content,
        sm.metadata,
        (sm.metadata->>'score')::float as score,
        sm.created_at
      FROM semantic_memory sm
      WHERE sm.type = p_type
        AND (sm.metadata->>'score')::float >= p_min_score
      ORDER BY (sm.metadata->>'score')::float DESC, sm.created_at DESC
      LIMIT p_limit;
    END;
    $func$ LANGUAGE plpgsql;

    -- Get memory statistics
    CREATE OR REPLACE FUNCTION get_memory_statistics()
    RETURNS JSONB AS $func$
    DECLARE
      result JSONB;
    BEGIN
      SELECT jsonb_build_object(
        'totalMemories', COUNT(*),
        'byType', (
          SELECT jsonb_object_agg(type, count)
          FROM (
            SELECT type, COUNT(*) as count
            FROM semantic_memory
            GROUP BY type
          ) type_counts
        ),
        'avgScore', AVG((metadata->>'score')::float),
        'oldestMemory', MIN(created_at),
        'newestMemory', MAX(created_at),
        'avgEmbeddingNorm', AVG(vector_norm(embedding))
      )
      INTO result
      FROM semantic_memory;
      
      RETURN result;
    END;
    $func$ LANGUAGE plpgsql;
    
    RAISE NOTICE 'Semantic memory functions created successfully';
  END IF;
END
$$;

-- Row Level Security (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AND 
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semantic_memory') THEN
    ALTER TABLE semantic_memory ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view their own memories"
      ON semantic_memory FOR SELECT
      TO authenticated
      USING (metadata->>'userId' = auth.uid()::text);
      
    CREATE POLICY "Users can insert their own memories"
      ON semantic_memory FOR INSERT
      TO authenticated
      WITH CHECK (metadata->>'userId' = auth.uid()::text);
      
    CREATE POLICY "Users can delete their own memories"
      ON semantic_memory FOR DELETE
      TO authenticated
      USING (metadata->>'userId' = auth.uid()::text);
      
    CREATE POLICY "Service role can access all memories"
      ON semantic_memory FOR ALL
      TO service_role
      USING (true);
    
    RAISE NOTICE 'RLS policies created successfully';
  END IF;
END
$$;

-- Sample data (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AND 
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semantic_memory') THEN
    INSERT INTO semantic_memory (type, content, embedding, metadata) VALUES
    (
      'value_proposition',
      'Streamlined project management with real-time collaboration and AI-powered insights',
      array_fill(0.1, ARRAY[1536])::vector,
      jsonb_build_object(
        'agentType', 'OpportunityAgent',
        'industry', 'Technology',
        'targetMarket', 'SMBs',
        'score', 0.85,
        'timestamp', NOW(),
        'tags', ARRAY['successful', 'validated']
      )
    ),
    (
      'target_definition',
      'Small to medium-sized businesses (10-500 employees) in the technology sector seeking to improve team collaboration and project visibility',
      array_fill(0.1, ARRAY[1536])::vector,
      jsonb_build_object(
        'agentType', 'TargetAgent',
        'industry', 'Technology',
        'score', 0.9,
        'timestamp', NOW()
      )
    );
    
    RAISE NOTICE 'Sample data inserted successfully';
  END IF;
END
$$;

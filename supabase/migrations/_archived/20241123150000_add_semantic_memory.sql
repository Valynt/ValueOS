-- Semantic Memory Schema with pgvector
-- Enables long-term semantic memory for RAG (Retrieval-Augmented Generation)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Semantic Memory Table
CREATE TABLE IF NOT EXISTS semantic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('value_proposition', 'target_definition', 'opportunity', 'integrity_check', 'workflow_result')),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_semantic_memory_type ON semantic_memory(type);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_created ON semantic_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_metadata_gin ON semantic_memory USING gin(metadata);

-- Vector similarity index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding ON semantic_memory 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster build, slower query)
-- CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding ON semantic_memory 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Function for semantic search
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
) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to get memories by industry
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
) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to get high-scoring memories
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
) AS $$
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
$$ LANGUAGE plpgsql;

-- Function to get memory statistics
CREATE OR REPLACE FUNCTION get_memory_statistics()
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE semantic_memory ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- Service role can access all memories (for system operations)
CREATE POLICY "Service role can access all memories"
  ON semantic_memory FOR ALL
  TO service_role
  USING (true);

-- Sample memories for testing
INSERT INTO semantic_memory (type, content, embedding, metadata) VALUES
(
  'value_proposition',
  'Streamlined project management with real-time collaboration and AI-powered insights',
  array_fill(0.1, ARRAY[1536])::vector, -- Placeholder embedding
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

-- Comments
COMMENT ON TABLE semantic_memory IS 'Long-term semantic memory for agent RAG (Retrieval-Augmented Generation)';
COMMENT ON COLUMN semantic_memory.embedding IS 'Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)';
COMMENT ON COLUMN semantic_memory.metadata IS 'Flexible metadata: agentType, industry, targetMarket, score, timestamp, userId, workflowId, tags';
COMMENT ON FUNCTION search_semantic_memory IS 'Semantic search using cosine similarity';
COMMENT ON FUNCTION get_memories_by_industry IS 'Retrieve memories filtered by industry';
COMMENT ON FUNCTION get_high_scoring_memories IS 'Retrieve high-quality memories above score threshold';
COMMENT ON FUNCTION get_memory_statistics IS 'Get aggregate statistics about stored memories';

-- Performance tips
COMMENT ON INDEX idx_semantic_memory_embedding IS 'HNSW index for fast approximate nearest neighbor search. Tune m (max connections) and ef_construction (build quality) based on dataset size.';

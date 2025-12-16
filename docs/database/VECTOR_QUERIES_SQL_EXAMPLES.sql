-- ============================================================================
-- Vector Store SQL Query Examples
-- ============================================================================
-- Database: PostgreSQL + pgvector
-- Table: semantic_memory
-- Execute these queries in Supabase SQL Editor or psql
-- ============================================================================

-- ============================================================================
-- 1. BASIC SIMILARITY SEARCH
-- ============================================================================

-- Find similar memories (replace $1 with actual embedding vector)
-- Note: In production, generate embedding via OpenAI API
SELECT 
  id,
  type,
  content,
  metadata,
  created_at,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE 1 - (embedding <=> $1::vector(1536)) >= 0.70  -- 70% similarity threshold
ORDER BY embedding <=> $1::vector(1536)  -- Sort by distance (ascending = most similar first)
LIMIT 10;

-- ============================================================================
-- 2. USING THE BUILT-IN FUNCTION (Recommended)
-- ============================================================================

-- Search using the database function
-- Easier to use and handles the complexity for you
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),  -- Query embedding
  0.70,              -- Similarity threshold (0.0 - 1.0)
  10,                -- Max results
  ''                 -- Filter clause (optional, see examples below)
);

-- ============================================================================
-- 3. FILTERED SEARCHES
-- ============================================================================

-- Filter by memory type
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),
  0.70,
  10,
  'WHERE type = ''opportunity'''
);

-- Filter by industry (JSON metadata)
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),
  0.75,
  5,
  'WHERE type = ''value_proposition'' AND metadata->>''industry'' = ''SaaS'''
);

-- Filter by multiple conditions
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),
  0.70,
  10,
  'WHERE type = ''opportunity'' 
   AND metadata->>''industry'' = ''DevOps'' 
   AND metadata->>''targetMarket'' = ''enterprise'''
);

-- Filter by date range
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),
  0.65,
  20,
  'WHERE type = ''workflow_result'' 
   AND created_at > NOW() - INTERVAL ''30 days'''
);

-- Filter by workflow ID (partitioned search)
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),
  0.70,
  10,
  'WHERE metadata->>''workflowId'' = ''workflow-123'''
);

-- Filter by confidence score
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),
  0.75,
  10,
  'WHERE type = ''opportunity'' 
   AND (metadata->>''score'')::float >= 0.85'
);

-- Filter by tags (JSONB array contains)
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),
  0.70,
  10,
  'WHERE type = ''value_proposition'' 
   AND metadata @> ''{\"tags\": [\"cost-reduction\"]}''::jsonb'
);

-- ============================================================================
-- 4. AGGREGATION QUERIES
-- ============================================================================

-- Count memories by type with average similarity
SELECT 
  type,
  COUNT(*) AS total_memories,
  AVG(1 - (embedding <=> $1::vector(1536))) AS avg_similarity,
  MAX(1 - (embedding <=> $1::vector(1536))) AS max_similarity,
  MIN(1 - (embedding <=> $1::vector(1536))) AS min_similarity
FROM semantic_memory
WHERE 1 - (embedding <=> $1::vector(1536)) >= 0.50
GROUP BY type
ORDER BY avg_similarity DESC;

-- Industry distribution of similar opportunities
SELECT 
  metadata->>'industry' AS industry,
  COUNT(*) AS opportunity_count,
  AVG(1 - (embedding <=> $1::vector(1536))) AS avg_similarity
FROM semantic_memory
WHERE type = 'opportunity'
  AND metadata ? 'industry'
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.60
GROUP BY metadata->>'industry'
ORDER BY avg_similarity DESC;

-- Timeline analysis (memories by month)
SELECT 
  DATE_TRUNC('month', created_at) AS month,
  type,
  COUNT(*) AS count,
  AVG(1 - (embedding <=> $1::vector(1536))) AS avg_similarity
FROM semantic_memory
WHERE 1 - (embedding <=> $1::vector(1536)) >= 0.60
GROUP BY DATE_TRUNC('month', created_at), type
ORDER BY month DESC;

-- ============================================================================
-- 5. ADVANCED QUERIES
-- ============================================================================

-- Top N most similar with metadata enrichment
SELECT 
  sm.id,
  sm.type,
  sm.content,
  sm.metadata->>'industry' AS industry,
  sm.metadata->>'targetMarket' AS target_market,
  (sm.metadata->>'score')::float AS confidence_score,
  sm.created_at,
  1 - (sm.embedding <=> $1::vector(1536)) AS similarity,
  CASE 
    WHEN 1 - (sm.embedding <=> $1::vector(1536)) >= 0.85 THEN 'High'
    WHEN 1 - (sm.embedding <=> $1::vector(1536)) >= 0.70 THEN 'Medium'
    ELSE 'Low'
  END AS similarity_rating
FROM semantic_memory sm
WHERE sm.type = 'opportunity'
  AND 1 - (sm.embedding <=> $1::vector(1536)) >= 0.65
ORDER BY sm.embedding <=> $1::vector(1536)
LIMIT 10;

-- Ranked search with multiple factors
WITH scored_memories AS (
  SELECT 
    id,
    type,
    content,
    metadata,
    created_at,
    1 - (embedding <=> $1::vector(1536)) AS vector_similarity,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / (30 * 24 * 3600) AS age_factor,
    COALESCE((metadata->>'score')::float, 0.5) AS metadata_score
  FROM semantic_memory
  WHERE 1 - (embedding <=> $1::vector(1536)) >= 0.60
)
SELECT 
  *,
  (
    0.7 * vector_similarity + 
    0.2 * (1 - LEAST(age_factor, 1)) +  -- Recency bonus
    0.1 * metadata_score                 -- Quality bonus
  ) AS combined_score
FROM scored_memories
ORDER BY combined_score DESC
LIMIT 10;

-- Find duplicate or near-duplicate content
SELECT 
  sm1.id AS memory1_id,
  sm2.id AS memory2_id,
  sm1.type,
  1 - (sm1.embedding <=> sm2.embedding) AS similarity,
  sm1.created_at AS memory1_date,
  sm2.created_at AS memory2_date
FROM semantic_memory sm1
CROSS JOIN semantic_memory sm2
WHERE sm1.id < sm2.id  -- Avoid duplicate pairs and self-comparison
  AND sm1.type = sm2.type
  AND 1 - (sm1.embedding <=> sm2.embedding) >= 0.95  -- Very high similarity = likely duplicate
ORDER BY similarity DESC
LIMIT 20;

-- ============================================================================
-- 6. STATISTICS & ANALYSIS
-- ============================================================================

-- Overall memory store statistics
SELECT 
  COUNT(*) AS total_memories,
  COUNT(DISTINCT type) AS unique_types,
  COUNT(DISTINCT metadata->>'industry') AS unique_industries,
  AVG(ARRAY_LENGTH(STRING_TO_ARRAY(content, ' '), 1)) AS avg_content_words,
  MIN(created_at) AS oldest_memory,
  MAX(created_at) AS newest_memory,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS recent_memories
FROM semantic_memory;

-- Memory distribution by type
SELECT 
  type,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage,
  MIN(created_at) AS oldest,
  MAX(created_at) AS newest
FROM semantic_memory
GROUP BY type
ORDER BY count DESC;

-- Check index usage and table health
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'semantic_memory'
ORDER BY idx_scan DESC;

-- Table size and statistics
SELECT 
  pg_size_pretty(pg_total_relation_size('semantic_memory')) AS total_size,
  pg_size_pretty(pg_relation_size('semantic_memory')) AS table_size,
  pg_size_pretty(pg_total_relation_size('semantic_memory') - pg_relation_size('semantic_memory')) AS indexes_size,
  (SELECT COUNT(*) FROM semantic_memory) AS row_count;

-- ============================================================================
-- 7. MAINTENANCE QUERIES
-- ============================================================================

-- Verify HNSW index exists
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'semantic_memory'
  AND indexdef LIKE '%hnsw%';

-- Check for NULL embeddings (data quality)
SELECT 
  COUNT(*) AS null_embeddings
FROM semantic_memory
WHERE embedding IS NULL;

-- Find oldest memories by type
SELECT 
  type,
  id,
  created_at,
  AGE(NOW(), created_at) AS age
FROM semantic_memory
WHERE type = 'opportunity'
ORDER BY created_at ASC
LIMIT 10;

-- Memory retention analysis (candidates for cleanup)
SELECT 
  type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS older_than_90_days,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '180 days') AS older_than_180_days,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '365 days') AS older_than_1_year
FROM semantic_memory
GROUP BY type;

-- ============================================================================
-- 8. TESTING WITHOUT EMBEDDINGS (For Schema Validation)
-- ============================================================================

-- Create a test memory (with dummy embedding)
INSERT INTO semantic_memory (type, content, embedding, metadata)
VALUES (
  'opportunity',
  '{"opportunity": "Test opportunity", "industry": "SaaS"}',
  ARRAY_FILL(0.1::real, ARRAY[1536])::vector,  -- Dummy embedding
  '{"industry": "SaaS", "targetMarket": "enterprise", "score": 0.85}'::jsonb
);

-- Query test memories (no embedding needed)
SELECT 
  id,
  type,
  content,
  metadata,
  created_at
FROM semantic_memory
WHERE type = 'opportunity'
  AND metadata->>'industry' = 'SaaS'
ORDER BY created_at DESC
LIMIT 5;

-- Clean up test data
DELETE FROM semantic_memory
WHERE content LIKE '%Test opportunity%';

-- ============================================================================
-- 9. PERFORMANCE TESTING
-- ============================================================================

-- Explain query to see if HNSW index is used
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  id,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE type = 'opportunity'
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.70
ORDER BY embedding <=> $1::vector(1536)
LIMIT 10;

-- Look for: "Index Scan using idx_semantic_memory_embedding"

-- ============================================================================
-- 10. COMMON PATTERNS FOR APPLICATIONS
-- ============================================================================

-- Pattern 1: RAG Context Retrieval
-- Get top 5 most relevant memories for LLM context
SELECT 
  content,
  metadata,
  1 - (embedding <=> $1::vector(1536)) AS relevance
FROM semantic_memory
WHERE type IN ('opportunity', 'value_proposition')
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.70
ORDER BY embedding <=> $1::vector(1536)
LIMIT 5;

-- Pattern 2: Duplicate Detection Before Insert
-- Check if similar content already exists
SELECT EXISTS (
  SELECT 1
  FROM semantic_memory
  WHERE type = 'opportunity'
    AND 1 - (embedding <=> $1::vector(1536)) >= 0.95  -- Very high threshold
  LIMIT 1
) AS has_duplicate;

-- Pattern 3: Trending Topics
-- Find most queried topics (based on similarity patterns)
SELECT 
  metadata->>'industry' AS industry,
  COUNT(*) AS similar_memories,
  AVG(1 - (embedding <=> $1::vector(1536))) AS avg_similarity
FROM semantic_memory
WHERE type = 'opportunity'
  AND metadata ? 'industry'
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.60
GROUP BY metadata->>'industry'
HAVING COUNT(*) >= 3
ORDER BY avg_similarity DESC;

-- Pattern 4: Memory Freshness Score
-- Combine similarity with recency
SELECT 
  id,
  content,
  1 - (embedding <=> $1::vector(1536)) AS similarity,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS days_old,
  (
    0.8 * (1 - (embedding <=> $1::vector(1536))) +
    0.2 * EXP(-EXTRACT(EPOCH FROM (NOW() - created_at)) / (30 * 86400))  -- Exponential decay
  ) AS freshness_score
FROM semantic_memory
WHERE type = 'opportunity'
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.65
ORDER BY freshness_score DESC
LIMIT 10;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Cosine Distance Interpretation:
--   Distance 0.0 → Similarity 1.0 (identical)
--   Distance 0.3 → Similarity 0.7 (good match)
--   Distance 0.5 → Similarity 0.5 (marginal)
--   Distance 1.0 → Similarity 0.0 (orthogonal)
--   Distance 2.0 → Similarity -1.0 (opposite)
--
-- Recommended Thresholds:
--   High precision: 0.85+
--   Balanced: 0.70 - 0.85
--   High recall: 0.60 - 0.70
--   Exploratory: 0.50 - 0.60
--
-- Performance:
--   - HNSW index: ~10-50ms for 10K rows
--   - Without index: ~500-2000ms
--   - Target: <100ms for most queries
--
-- ============================================================================

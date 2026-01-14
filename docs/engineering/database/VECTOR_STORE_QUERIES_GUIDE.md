# Vector Store Queries - Complete Guide

**Database:** PostgreSQL with pgvector extension  
**Table:** `semantic_memory`  
**Migration:** `supabase/migrations/20241123150000_add_semantic_memory.sql`  
**Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)

---

## 📊 Table Schema

```sql
CREATE TABLE semantic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'value_proposition', 
    'target_definition', 
    'opportunity', 
    'integrity_check', 
    'workflow_result'
  )),
  content TEXT NOT NULL,
  embedding vector(1536), -- pgvector type
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_semantic_memory_type ON semantic_memory(type);
CREATE INDEX idx_semantic_memory_created ON semantic_memory(created_at DESC);
CREATE INDEX idx_semantic_memory_metadata_gin ON semantic_memory USING gin(metadata);

-- HNSW index for fast vector similarity search
CREATE INDEX idx_semantic_memory_embedding ON semantic_memory 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## 🔍 Query Patterns

### **1. Cosine Similarity Search (Core Query)**

**Understanding Distance Operators:**
- `<=>` : Cosine distance (0 = identical, 2 = opposite)
- `<->` : Euclidean distance (L2)
- `<#>` : Inner product (negative distance)

**Formula:**
```
similarity = 1 - cosine_distance
```

**Basic Query:**
```sql
-- Find top 5 similar memories
SELECT 
  id,
  type,
  content,
  metadata,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE type = 'opportunity'
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.70  -- 70% threshold
ORDER BY embedding <=> $1::vector(1536)  -- Sort by distance (ascending)
LIMIT 5;
```

**Parameters:**
- `$1` : Query embedding (1536-dimensional vector)

---

### **2. Filtered Vector Search**

**By Type + Industry:**
```sql
SELECT 
  id,
  content,
  metadata->>'industry' AS industry,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE type = 'value_proposition'
  AND metadata->>'industry' = 'SaaS'  -- JSON field filter
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.75
ORDER BY embedding <=> $1::vector(1536)
LIMIT 10;
```

**By Workflow ID:**
```sql
SELECT 
  id,
  content,
  metadata->>'workflowId' AS workflow_id,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE type = 'opportunity'
  AND metadata->>'workflowId' = $2  -- Partition by workflow
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.65
ORDER BY embedding <=> $1::vector(1536)
LIMIT 5;
```

**By Date Range:**
```sql
SELECT 
  id,
  content,
  created_at,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE type = 'workflow_result'
  AND created_at > NOW() - INTERVAL '30 days'  -- Recent only
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.70
ORDER BY embedding <=> $1::vector(1536)
LIMIT 10;
```

---

### **3. Multi-Condition Filtering**

**Complex Metadata Query:**
```sql
SELECT 
  id,
  content,
  metadata,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE type = 'opportunity'
  AND metadata->>'industry' = 'DevOps'
  AND metadata->>'targetMarket' = 'enterprise'
  AND (metadata->>'score')::float >= 0.85  -- Cast to float
  AND metadata @> '{"tags": ["automation"]}'::jsonb  -- JSON contains
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.70
ORDER BY embedding <=> $1::vector(1536)
LIMIT 10;
```

**Array Field Matching:**
```sql
-- Find memories with specific tags
SELECT 
  id,
  content,
  metadata->'tags' AS tags,
  1 - (embedding <=> $1::vector(1536)) AS similarity
FROM semantic_memory
WHERE type = 'value_proposition'
  AND metadata->'tags' ? 'cost-reduction'  -- JSON key exists
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.75
ORDER BY embedding <=> $1::vector(1536)
LIMIT 5;
```

---

### **4. Aggregation Queries**

**Count by Type and Similarity Range:**
```sql
SELECT 
  type,
  COUNT(*) AS total_memories,
  AVG(1 - (embedding <=> $1::vector(1536))) AS avg_similarity,
  MAX(1 - (embedding <=> $1::vector(1536))) AS max_similarity
FROM semantic_memory
WHERE 1 - (embedding <=> $1::vector(1536)) >= 0.50  -- Broad threshold
GROUP BY type
ORDER BY avg_similarity DESC;
```

**Industry Distribution:**
```sql
SELECT 
  metadata->>'industry' AS industry,
  type,
  COUNT(*) AS memory_count,
  AVG(1 - (embedding <=> $1::vector(1536))) AS avg_similarity
FROM semantic_memory
WHERE type = 'opportunity'
  AND metadata ? 'industry'  -- Has industry field
  AND 1 - (embedding <=> $1::vector(1536)) >= 0.60
GROUP BY metadata->>'industry', type
ORDER BY avg_similarity DESC;
```

---

### **5. Using the Built-In Function**

**From Migration:**
```sql
-- Function: search_semantic_memory(query_embedding, threshold, count, filter)
SELECT * 
FROM search_semantic_memory(
  $1::vector(1536),  -- Query embedding
  0.70,              -- Similarity threshold
  10,                -- Max results
  'WHERE type = ''opportunity'' AND metadata->>''industry'' = ''SaaS'''  -- Filter clause
);

-- Returns: id, type, content, embedding, metadata, created_at, similarity
```

**Function Definition (already in DB):**
```sql
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
```

---

## 💻 TypeScript/JavaScript Implementation

### **1. Basic Similarity Search**

```typescript
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
  });
  
  return response.data[0].embedding;
}

/**
 * Search semantic memory
 */
async function searchMemory(
  query: string,
  options: {
    type?: string;
    threshold?: number;
    limit?: number;
    filters?: Record<string, any>;
  } = {}
) {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // 2. Build query
  let rpcQuery = supabase.rpc('search_semantic_memory', {
    query_embedding: queryEmbedding,
    match_threshold: options.threshold || 0.70,
    match_count: options.limit || 10,
    filter_clause: buildFilterClause(options.type, options.filters)
  });
  
  // 3. Execute
  const { data, error } = await rpcQuery;
  
  if (error) throw error;
  
  return data;
}

/**
 * Build WHERE clause from filters
 */
function buildFilterClause(type?: string, filters?: Record<string, any>): string {
  const conditions: string[] = [];
  
  if (type) {
    conditions.push(`WHERE type = '${type}'`);
  }
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === 'string') {
        conditions.push(`${conditions.length === 0 ? 'WHERE' : 'AND'} metadata->>'${key}' = '${value}'`);
      } else if (typeof value === 'number') {
        conditions.push(`${conditions.length === 0 ? 'WHERE' : 'AND'} (metadata->>'${key}')::float = ${value}`);
      }
    });
  }
  
  return conditions.join(' ');
}

// Usage Example
const results = await searchMemory('reduce cloud infrastructure costs', {
  type: 'opportunity',
  threshold: 0.75,
  limit: 5,
  filters: {
    industry: 'DevOps',
    targetMarket: 'enterprise'
  }
});

console.log(`Found ${results.length} similar opportunities`);
results.forEach((result: any) => {
  console.log(`- Similarity: ${result.similarity.toFixed(3)}`);
  console.log(`  Content: ${result.content.slice(0, 100)}...`);
});
```

---

### **2. Batch Vector Search**

```typescript
/**
 * Search multiple queries in parallel
 */
async function batchSearch(queries: string[], options = {}) {
  // Generate embeddings in parallel
  const embeddings = await Promise.all(
    queries.map(q => generateEmbedding(q))
  );
  
  // Search in parallel
  const results = await Promise.all(
    embeddings.map(emb => 
      supabase.rpc('search_semantic_memory', {
        query_embedding: emb,
        match_threshold: options.threshold || 0.70,
        match_count: options.limit || 5
      })
    )
  );
  
  return results.map((r, i) => ({
    query: queries[i],
    results: r.data || []
  }));
}

// Usage
const batchResults = await batchSearch([
  'cost reduction strategies',
  'revenue growth opportunities',
  'customer retention improvements'
], { threshold: 0.70, limit: 3 });
```

---

### **3. Similarity Search with Ranking**

```typescript
/**
 * Search with custom ranking algorithm
 */
async function rankedSearch(
  query: string,
  options: {
    vectorWeight?: number;    // Weight for vector similarity (0-1)
    recencyWeight?: number;   // Weight for recency (0-1)
    scoreWeight?: number;     // Weight for metadata score (0-1)
    threshold?: number;
    limit?: number;
  } = {}
) {
  const {
    vectorWeight = 0.7,
    recencyWeight = 0.2,
    scoreWeight = 0.1,
    threshold = 0.65,
    limit = 10
  } = options;
  
  const queryEmbedding = await generateEmbedding(query);
  
  // Custom ranking query
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      WITH scores AS (
        SELECT 
          id,
          content,
          metadata,
          created_at,
          1 - (embedding <=> $1::vector(1536)) AS vector_similarity,
          EXTRACT(EPOCH FROM (NOW() - created_at)) / (30 * 24 * 3600) AS age_factor,
          COALESCE((metadata->>'score')::float, 0.5) AS metadata_score
        FROM semantic_memory
        WHERE 1 - (embedding <=> $1::vector(1536)) >= $2
      )
      SELECT 
        *,
        (
          ${vectorWeight} * vector_similarity + 
          ${recencyWeight} * (1 - LEAST(age_factor, 1)) + 
          ${scoreWeight} * metadata_score
        ) AS combined_score
      FROM scores
      ORDER BY combined_score DESC
      LIMIT $3
    `,
    params: [queryEmbedding, threshold, limit]
  });
  
  if (error) throw error;
  return data;
}
```

---

## 🎯 Common Use Cases

### **Use Case 1: RAG for Opportunity Discovery**

```typescript
/**
 * Retrieve similar past opportunities for context
 */
async function getOpportunityContext(discoveryData: string) {
  const query = `${discoveryData.slice(0, 500)}...`;  // Truncate for embedding
  
  const results = await searchMemory(query, {
    type: 'opportunity',
    threshold: 0.70,
    limit: 5
  });
  
  // Format for LLM context
  const context = results
    .map((r: any) => {
      const parsed = JSON.parse(r.content);
      return `
        Industry: ${r.metadata.industry}
        Opportunity: ${parsed.opportunity}
        Outcome: ${parsed.outcome}
        Confidence: ${r.similarity.toFixed(2)}
      `;
    })
    .join('\n---\n');
  
  return context;
}

// Use in agent prompt
const context = await getOpportunityContext(discoveryTranscript);
const prompt = `
  Based on similar past opportunities:
  ${context}
  
  Analyze this new discovery:
  ${discoveryTranscript}
`;
```

---

### **Use Case 2: Duplicate Detection**

```typescript
/**
 * Check if similar content already exists
 */
async function checkDuplicate(
  content: string,
  type: string,
  threshold: number = 0.90  // High threshold for duplicates
): Promise<boolean> {
  const results = await searchMemory(content, {
    type,
    threshold,
    limit: 1
  });
  
  return results.length > 0;
}

// Usage before storing
const isDuplicate = await checkDuplicate(
  JSON.stringify(opportunityData),
  'opportunity',
  0.95
);

if (isDuplicate) {
  console.log('Similar opportunity already exists');
} else {
  await storeMemory(opportunityData);
}
```

---

### **Use Case 3: Memory Clustering**

```typescript
/**
 * Find clusters of similar memories
 */
async function findMemoryClusters(type: string, threshold: number = 0.80) {
  // Get all memories of type
  const { data: memories } = await supabase
    .from('semantic_memory')
    .select('id, embedding, content, metadata')
    .eq('type', type);
  
  const clusters: any[] = [];
  const processed = new Set<string>();
  
  for (const memory of memories) {
    if (processed.has(memory.id)) continue;
    
    // Find similar memories
    const { data: similar } = await supabase.rpc('search_semantic_memory', {
      query_embedding: memory.embedding,
      match_threshold: threshold,
      match_count: 50
    });
    
    const cluster = {
      centroid: memory,
      members: similar,
      size: similar.length
    };
    
    clusters.push(cluster);
    similar.forEach((m: any) => processed.add(m.id));
  }
  
  return clusters.sort((a, b) => b.size - a.size);
}

// Usage
const opportunityClusters = await findMemoryClusters('opportunity', 0.85);
console.log(`Found ${opportunityClusters.length} opportunity clusters`);
opportunityClusters.forEach((cluster, i) => {
  console.log(`Cluster ${i + 1}: ${cluster.size} similar opportunities`);
});
```

---

### **Use Case 4: Similarity Distribution Analysis**

```typescript
/**
 * Analyze similarity distribution for threshold tuning
 */
async function analyzeSimilarityDistribution(query: string, type: string) {
  const queryEmbedding = await generateEmbedding(query);
  
  // Get all similarities (no threshold)
  const { data } = await supabase.rpc('search_semantic_memory', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,  // No filtering
    match_count: 100
  });
  
  const similarities = data.map((r: any) => r.similarity);
  
  // Calculate statistics
  const avg = similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length;
  const sorted = similarities.sort((a: number, b: number) => b - a);
  const median = sorted[Math.floor(sorted.length / 2)];
  const stdDev = Math.sqrt(
    similarities.reduce((sq: number, n: number) => sq + Math.pow(n - avg, 2), 0) / similarities.length
  );
  
  // Recommend threshold
  const recommendedThreshold = Math.max(0.50, avg - stdDev);
  
  return {
    count: similarities.length,
    average: avg,
    median,
    stdDev,
    min: sorted[sorted.length - 1],
    max: sorted[0],
    recommendedThreshold,
    distribution: {
      high: similarities.filter((s: number) => s >= 0.85).length,
      medium: similarities.filter((s: number) => s >= 0.70 && s < 0.85).length,
      low: similarities.filter((s: number) => s < 0.70).length
    }
  };
}

// Usage
const analysis = await analyzeSimilarityDistribution(
  'cloud cost optimization',
  'opportunity'
);

console.log('Similarity Distribution:');
console.log(`  Average: ${analysis.average.toFixed(3)}`);
console.log(`  Median: ${analysis.median.toFixed(3)}`);
console.log(`  Std Dev: ${analysis.stdDev.toFixed(3)}`);
console.log(`  Recommended Threshold: ${analysis.recommendedThreshold.toFixed(3)}`);
console.log(`  High (≥0.85): ${analysis.distribution.high}`);
console.log(`  Medium (0.70-0.85): ${analysis.distribution.medium}`);
console.log(`  Low (<0.70): ${analysis.distribution.low}`);
```

---

## ⚡ Performance Optimization

### **1. Index Usage Verification**

```sql
-- Check if HNSW index is being used
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
```

### **2. Batch Embedding Generation**

```typescript
/**
 * Generate embeddings in batches (faster than sequential)
 */
async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,  // Array of texts
    encoding_format: 'float'
  });
  
  return response.data.map(d => d.embedding);
}

// Usage
const embeddings = await generateEmbeddingsBatch([
  'text 1',
  'text 2',
  'text 3'
]);
```

### **3. Caching Strategy**

```typescript
import { LRUCache } from 'lru-cache';

// Cache embeddings
const embeddingCache = new LRUCache<string, number[]>({
  max: 1000,  // Max 1000 entries
  ttl: 1000 * 60 * 60  // 1 hour TTL
});

async function getCachedEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;
  
  const embedding = await generateEmbedding(text);
  embeddingCache.set(text, embedding);
  return embedding;
}

// Cache search results
const searchCache = new LRUCache<string, any[]>({
  max: 500,
  ttl: 1000 * 60 * 5  // 5 minutes TTL
});

async function getCachedSearch(query: string, options: any) {
  const cacheKey = JSON.stringify({ query, options });
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;
  
  const results = await searchMemory(query, options);
  searchCache.set(cacheKey, results);
  return results;
}
```

---

## 🐛 Troubleshooting

### **Problem 1: Slow Queries**

**Symptom:** Queries taking > 2 seconds

**Diagnosis:**
```sql
-- Check if index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'semantic_memory' 
  AND indexdef LIKE '%hnsw%';

-- Check table size
SELECT 
  pg_size_pretty(pg_total_relation_size('semantic_memory')) AS total_size,
  COUNT(*) AS row_count
FROM semantic_memory;
```

**Solutions:**
1. Ensure HNSW index exists
2. Increase `ef_search` parameter for accuracy/speed tradeoff
3. Use more selective filters before vector search
4. Consider partitioning by type

---

### **Problem 2: Low Quality Results**

**Symptom:** Irrelevant memories returned

**Diagnosis:**
```typescript
// Check similarity scores
const results = await searchMemory(query, { threshold: 0.0, limit: 20 });
console.log('Similarity distribution:', results.map(r => r.similarity));
```

**Solutions:**
1. Increase threshold (0.70 → 0.75)
2. Add metadata filters
3. Use more specific queries
4. Verify embedding model consistency

---

### **Problem 3: Missing Results**

**Symptom:** Expected memories not returned

**Diagnosis:**
```sql
-- Check if memory exists
SELECT 
  id,
  content,
  metadata,
  created_at
FROM semantic_memory
WHERE content LIKE '%expected text%'
LIMIT 5;

-- Check similarity with known memory
SELECT 
  1 - (embedding <=> (
    SELECT embedding FROM semantic_memory WHERE id = 'known-memory-id'
  )) AS similarity
FROM semantic_memory
WHERE id = 'missing-memory-id';
```

**Solutions:**
1. Lower threshold (0.70 → 0.60)
2. Verify query embedding generation
3. Check filters aren't too restrictive
4. Ensure memory was actually stored

---

## 📚 Additional Resources

- **pgvector Documentation:** https://github.com/pgvector/pgvector
- **OpenAI Embeddings:** https://platform.openai.com/docs/guides/embeddings
- **Cosine Similarity:** https://en.wikipedia.org/wiki/Cosine_similarity
- **HNSW Algorithm:** https://arxiv.org/abs/1603.09320

---

## ✅ Quick Reference

**Search Function:**
```sql
SELECT * FROM search_semantic_memory(
  $embedding,  -- vector(1536)
  0.70,        -- threshold
  10,          -- limit
  'WHERE type = ''opportunity'''  -- filter
);
```

**TypeScript:**
```typescript
const results = await searchMemory(query, {
  type: 'opportunity',
  threshold: 0.70,
  limit: 10,
  filters: { industry: 'SaaS' }
});
```

**Performance:**
- HNSW index: ~10-50ms for 10K memories
- No index: ~500-2000ms
- Target: <100ms for most queries

**Thresholds:**
- High precision: 0.85+
- Balanced: 0.70-0.85
- High recall: 0.50-0.70

# Vector Store - Complete Implementation Guide

**Status:** ✅ Production Ready  
**Last Updated:** December 1, 2025

---

## 📦 What We've Built

### **1. Comprehensive Documentation**
- ✅ `VECTOR_STORE_QUERIES_GUIDE.md` - Complete query reference
- ✅ `VECTOR_QUERIES_SQL_EXAMPLES.sql` - 50+ executable SQL examples
- ✅ `VECTOR_STORE_COMPLETE_GUIDE.md` - This file

### **2. Production Services**
- ✅ `VectorSearchService.ts` - Type-safe search service
- ✅ `SemanticMemory.ts` - Embedding generation & storage (already exists)

### **3. Test Scripts**
- ✅ `test-vector-queries.ts` - Interactive test suite
- ✅ `test/integration/semantic-memory-production.test.ts` - Automated tests

---

## 🚀 Quick Start (3 Steps)

### **Step 1: Verify Database Setup**

```bash
# Check if pgvector extension is enabled
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Check if table exists
psql $DATABASE_URL -c "\d semantic_memory"

# Verify HNSW index
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'semantic_memory' AND indexdef LIKE '%hnsw%';"
```

Expected output:
```
 indexname                    
-------------------------------
 idx_semantic_memory_embedding
```

---

### **Step 2: Test Basic Query (SQL)**

Open Supabase SQL Editor and run:

```sql
-- Get all memories (no vector search)
SELECT 
  id,
  type,
  metadata->>'industry' AS industry,
  created_at
FROM semantic_memory
ORDER BY created_at DESC
LIMIT 5;
```

If you see results, your table is populated! ✅

If empty:
```bash
# Seed some test data
npm run seed:memories
```

---

### **Step 3: Use the Service (TypeScript)**

```typescript
import { vectorSearchService } from '@/services/VectorSearchService';

// Assuming you have a query embedding
const results = await vectorSearchService.searchByEmbedding(
  queryEmbedding,
  {
    type: 'opportunity',
    threshold: 0.70,
    limit: 5
  }
);

console.log(`Found ${results.length} similar opportunities`);
results.forEach(({ memory, similarity }) => {
  console.log(`- ${similarity.toFixed(3)}: ${memory.content.slice(0, 100)}`);
});
```

---

## 📚 Available Query Methods

### **Method 1: Direct SQL** (Fastest, most control)

```sql
-- Use the built-in function
SELECT * FROM search_semantic_memory(
  $embedding::vector(1536),
  0.70,  -- threshold
  10,    -- limit
  'WHERE type = ''opportunity'''  -- filter
);
```

**When to use:**
- Maximum performance needed
- Complex aggregations
- Direct database access
- Batch operations

---

### **Method 2: VectorSearchService** (Recommended)

```typescript
import { vectorSearchService } from '@/services/VectorSearchService';

// Basic search
const results = await vectorSearchService.searchByEmbedding(embedding, options);

// By industry
const saasOpps = await vectorSearchService.searchByIndustry(
  embedding,
  'SaaS',
  { threshold: 0.75, limit: 10 }
);

// By workflow
const workflowMemories = await vectorSearchService.searchByWorkflow(
  embedding,
  'workflow-123'
);

// Find similar to existing memory
const similar = await vectorSearchService.findSimilar('memory-id-456');

// Check for duplicates
const isDupe = await vectorSearchService.checkDuplicate(
  embedding,
  'opportunity',
  0.95  // Very high threshold
);
```

**When to use:**
- Application code
- Type safety needed
- Caching desired
- Error handling important

---

### **Method 3: Supabase RPC** (Flexible)

```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase.rpc('search_semantic_memory', {
  query_embedding: embedding,
  match_threshold: 0.70,
  match_count: 10,
  filter_clause: "WHERE type = 'opportunity' AND metadata->>'industry' = 'SaaS'"
});
```

**When to use:**
- Quick prototypes
- Direct Supabase access
- Custom filter clauses
- Server-side rendering

---

## 🎯 Common Use Cases

### **Use Case 1: RAG for LLM Context**

```typescript
import { vectorSearchService } from '@/services/VectorSearchService';
import { generateEmbedding } from '@/services/SemanticMemory';

async function getLLMContext(userQuery: string) {
  // 1. Generate query embedding
  const embedding = await generateEmbedding(userQuery);

  // 2. Search similar memories
  const memories = await vectorSearchService.searchByEmbedding(embedding, {
    type: 'opportunity',
    threshold: 0.70,
    limit: 5
  });

  // 3. Format for LLM
  const context = memories
    .map(({ memory, similarity }) => {
      const parsed = JSON.parse(memory.content);
      return `
        [Relevance: ${(similarity * 100).toFixed(0)}%]
        Industry: ${memory.metadata.industry}
        Opportunity: ${parsed.opportunity}
        Outcome: ${parsed.outcome}
      `;
    })
    .join('\n\n---\n\n');

  return context;
}

// Use in agent prompt
const context = await getLLMContext('reduce cloud costs');
const prompt = `
  Based on similar past opportunities:
  ${context}

  Analyze this new discovery:
  ${userInput}
`;
```

---

### **Use Case 2: Deduplication**

```typescript
async function storeWithDuplicateCheck(
  content: any,
  type: string,
  embedding: number[]
) {
  // Check for near-duplicates
  const isDuplicate = await vectorSearchService.checkDuplicate(
    embedding,
    type as any,
    0.95  // 95% similarity = likely duplicate
  );

  if (isDuplicate) {
    console.log('⚠️  Similar content already exists');
    return null;
  }

  // Store new memory
  const { data, error } = await supabase
    .from('semantic_memory')
    .insert({
      type,
      content: JSON.stringify(content),
      embedding,
      metadata: content.metadata || {}
    })
    .select()
    .single();

  return data;
}
```

---

### **Use Case 3: Adaptive Thresholding**

```typescript
import { calculateAdjustedThreshold } from '@/config/llm';

async function adaptiveSearch(query: string, userPreference: 'precision' | 'balanced' | 'recall') {
  const embedding = await generateEmbedding(query);

  // Get initial results
  const initialResults = await vectorSearchService.searchByEmbedding(embedding, {
    threshold: 0.60,  // Broad initial search
    limit: 20
  });

  // Analyze distribution
  const analysis = await vectorSearchService.analyzeSimilarityDistribution(embedding);

  // Adjust threshold based on context
  const adjustedThreshold = calculateAdjustedThreshold(
    analysis.recommendedThreshold,
    {
      querySpecificity: query.split(' ').length > 5 ? 'high' : 'medium',
      resultCount: initialResults.length,
      userPreference
    }
  );

  // Re-search with adjusted threshold
  const finalResults = await vectorSearchService.searchByEmbedding(embedding, {
    threshold: adjustedThreshold,
    limit: 10
  });

  return finalResults;
}
```

---

### **Use Case 4: Industry Trend Analysis**

```typescript
async function analyzeIndustryTrends(industry: string) {
  // Get all memories for industry
  const { data: memories } = await supabase
    .from('semantic_memory')
    .select('*')
    .eq('type', 'opportunity')
    .filter('metadata->>industry', 'eq', industry)
    .order('created_at', { ascending: false })
    .limit(50);

  // Cluster by similarity
  const clusters: any[] = [];
  const processed = new Set<string>();

  for (const memory of memories) {
    if (processed.has(memory.id)) continue;

    const similar = await vectorSearchService.searchByEmbedding(
      memory.embedding,
      {
        type: 'opportunity',
        threshold: 0.80,
        limit: 20,
        filters: { industry }
      }
    );

    clusters.push({
      theme: extractTheme(memory.content),
      count: similar.length,
      avgConfidence: similar.reduce((sum, r) => sum + r.similarity, 0) / similar.length,
      memories: similar
    });

    similar.forEach(r => processed.add(r.memory.id));
  }

  return clusters.sort((a, b) => b.count - a.count);
}
```

---

## ⚡ Performance Optimization

### **1. HNSW Index Parameters**

Current settings (from migration):
```sql
CREATE INDEX idx_semantic_memory_embedding 
ON semantic_memory 
USING hnsw (embedding vector_cosine_ops)
WITH (
  m = 16,               -- Higher = more accurate but slower builds
  ef_construction = 64  -- Higher = better quality but slower
);
```

**Tuning Guide:**
- **Small dataset (<10K):** `m=16, ef_construction=64` (current)
- **Medium dataset (10K-100K):** `m=24, ef_construction=128`
- **Large dataset (>100K):** `m=32, ef_construction=256`

**Rebuild index:**
```sql
DROP INDEX idx_semantic_memory_embedding;

CREATE INDEX idx_semantic_memory_embedding 
ON semantic_memory 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 128);
```

---

### **2. Query Optimization**

**✅ Good (Fast):**
```sql
-- Filter BEFORE vector search
SELECT * FROM search_semantic_memory(
  $embedding,
  0.70,
  10,
  'WHERE type = ''opportunity'' AND metadata->>''industry'' = ''SaaS'''
);
```

**❌ Bad (Slow):**
```sql
-- Filter AFTER vector search (scans all vectors)
SELECT * FROM (
  SELECT * FROM search_semantic_memory($embedding, 0.70, 1000, '')
) sub
WHERE metadata->>'industry' = 'SaaS'
LIMIT 10;
```

---

### **3. Caching Strategy**

```typescript
import { LRUCache } from 'lru-cache';

// Cache embeddings (expensive to generate)
const embeddingCache = new LRUCache<string, number[]>({
  max: 1000,
  ttl: 3600000  // 1 hour
});

async function getCachedEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const embedding = await generateEmbedding(text);
  embeddingCache.set(text, embedding);
  return embedding;
}

// VectorSearchService has built-in result caching (5 minutes TTL)
```

---

## 🐛 Troubleshooting

### **Problem: No results returned**

**Diagnosis:**
```typescript
// Check if memories exist
const { count } = await supabase
  .from('semantic_memory')
  .select('id', { count: 'exact', head: true })
  .eq('type', 'opportunity');

console.log(`Found ${count} opportunities`);

// Test with very low threshold
const results = await vectorSearchService.searchByEmbedding(embedding, {
  threshold: 0.30,  // Very low
  limit: 20
});

console.log('Similarities:', results.map(r => r.similarity));
```

**Solutions:**
1. Lower threshold (0.70 → 0.50)
2. Remove filters
3. Seed test data
4. Verify embedding dimension (must be 1536)

---

### **Problem: Slow queries (>2 seconds)**

**Diagnosis:**
```sql
-- Check if index is being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM search_semantic_memory($embedding, 0.70, 10, '');

-- Look for: "Index Scan using idx_semantic_memory_embedding"
```

**Solutions:**
1. Verify HNSW index exists
2. Rebuild index with higher parameters
3. Add more selective filters
4. Use `VACUUM ANALYZE semantic_memory`

---

### **Problem: Low quality results**

**Diagnosis:**
```typescript
// Analyze similarity distribution
const analysis = await vectorSearchService.analyzeSimilarityDistribution(
  queryEmbedding,
  'opportunity'
);

console.log('Average similarity:', analysis.average);
console.log('Recommended threshold:', analysis.recommendedThreshold);
```

**Solutions:**
1. Increase threshold (0.70 → 0.80)
2. Use more specific queries
3. Add metadata filters
4. Verify embedding model consistency

---

## 📊 Monitoring

### **Key Metrics to Track**

1. **Query Performance**
   - P50, P95, P99 latency
   - Target: <100ms for P95

2. **Result Quality**
   - Average similarity scores
   - False positive rate
   - False negative rate

3. **Cache Hit Rate**
   - Embedding cache hits
   - Search result cache hits
   - Target: >60%

4. **Index Health**
   - Index size
   - Scan vs index usage ratio
   - Rebuild frequency

### **Monitoring Queries**

```sql
-- Query performance
SELECT 
  COUNT(*) as query_count,
  AVG(duration_ms) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration
FROM query_logs
WHERE query_type = 'vector_search'
  AND timestamp > NOW() - INTERVAL '1 hour';

-- Result quality
SELECT 
  AVG(similarity) as avg_similarity,
  STDDEV(similarity) as similarity_stddev,
  COUNT(*) FILTER (WHERE similarity < 0.70) as low_quality_results
FROM search_results
WHERE timestamp > NOW() - INTERVAL '1 day';
```

---

## ✅ Production Checklist

- [ ] HNSW index exists and is optimal
- [ ] Embeddings are 1536 dimensions
- [ ] Query latency <100ms (P95)
- [ ] Cache hit rate >60%
- [ ] Monitoring in place
- [ ] Threshold tuned for your data
- [ ] Duplicate detection working
- [ ] Error handling implemented
- [ ] Tests passing
- [ ] Documentation updated

---

## 🔗 Files Reference

**Documentation:**
- `docs/VECTOR_STORE_QUERIES_GUIDE.md` - Complete query reference
- `docs/VECTOR_QUERIES_SQL_EXAMPLES.sql` - SQL examples
- `docs/VECTOR_STORE_COMPLETE_GUIDE.md` - This file

**Services:**
- `src/services/VectorSearchService.ts` - Production service
- `src/services/SemanticMemory.ts` - Embedding generation
- `src/config/llm.ts` - Threshold configuration

**Tests:**
- `test/integration/semantic-memory-production.test.ts` - Automated tests
- `scripts/test-vector-queries.ts` - Interactive test script

**Database:**
- `supabase/migrations/20241123150000_add_semantic_memory.sql` - Schema

---

## 🎓 Learning Resources

- **pgvector GitHub:** https://github.com/pgvector/pgvector
- **HNSW Paper:** https://arxiv.org/abs/1603.09320
- **OpenAI Embeddings:** https://platform.openai.com/docs/guides/embeddings
- **Vector Database Guide:** https://www.pinecone.io/learn/vector-database/

---

## 🚀 Next Steps

1. **Run the test suite:** `npx ts-node scripts/test-vector-queries.ts`
2. **Review SQL examples:** Open `VECTOR_QUERIES_SQL_EXAMPLES.sql` in Supabase
3. **Integrate VectorSearchService:** Use in your agent code
4. **Monitor performance:** Set up dashboards
5. **Tune thresholds:** Adjust based on false positive/negative rates

---

**Need help?** All code is production-ready and documented. Start with the Quick Start above! 🎉

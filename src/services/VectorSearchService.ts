/**
 * Vector Search Service
 * 
 * Production-ready service for querying semantic_memory table with pgvector
 * 
 * Features:
 * - Type-safe query methods
 * - Configurable thresholds
 * - Caching support
 * - Performance monitoring
 * - Error handling
 */

import { supabase } from '@/lib/supabase';
import { getSemanticThreshold, semanticMemoryConfig } from '@/config/llm';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface SemanticMemory {
  id: string;
  type: 'value_proposition' | 'target_definition' | 'opportunity' | 'integrity_check' | 'workflow_result';
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
  similarity?: number;
}

export interface SearchOptions {
  /** Memory type to filter */
  type?: SemanticMemory['type'];
  /** Similarity threshold (0-1), defaults to type-specific threshold */
  threshold?: number;
  /** Maximum results */
  limit?: number;
  /** Metadata filters */
  filters?: Record<string, any>;
  /** Enable caching */
  useCache?: boolean;
}

export interface SearchResult {
  memory: SemanticMemory;
  similarity: number;
}

// ============================================================================
// Vector Search Service
// ============================================================================

export class VectorSearchService {
  private cache: Map<string, SearchResult[]> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Search semantic memory by query embedding
   */
  async searchByEmbedding(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      type,
      threshold,
      limit = 10,
      filters = {},
      useCache = true
    } = options;

    try {
      // Check cache
      const cacheKey = this.getCacheKey(queryEmbedding, options);
      if (useCache && this.cache.has(cacheKey)) {
        logger.debug('Vector search cache hit', { cacheKey });
        return this.cache.get(cacheKey)!;
      }

      // Determine threshold
      const effectiveThreshold = threshold || 
        (type ? getSemanticThreshold(type) : semanticMemoryConfig.defaultThreshold);

      // Build filter clause
      const filterClause = this.buildFilterClause(type, filters);

      // Execute search
      const startTime = Date.now();
      const { data, error } = await supabase.rpc('search_semantic_memory', {
        query_embedding: queryEmbedding,
        match_threshold: effectiveThreshold,
        match_count: limit,
        filter_clause: filterClause
      });

      const duration = Date.now() - startTime;

      if (error) {
        logger.error('Vector search failed', { error, duration });
        throw error;
      }

      // Format results
      const results: SearchResult[] = (data || []).map((row: any) => ({
        memory: {
          id: row.id,
          type: row.type,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata,
          created_at: row.created_at
        },
        similarity: row.similarity
      }));

      // Cache results
      if (useCache) {
        this.cache.set(cacheKey, results);
        setTimeout(() => this.cache.delete(cacheKey), this.cacheTTL);
      }

      logger.info('Vector search completed', {
        duration,
        resultCount: results.length,
        threshold: effectiveThreshold,
        type
      });

      return results;
    } catch (error) {
      logger.error('Vector search error', { error, options });
      throw error;
    }
  }

  /**
   * Search by industry
   */
  async searchByIndustry(
    queryEmbedding: number[],
    industry: string,
    options: Omit<SearchOptions, 'filters'> = {}
  ): Promise<SearchResult[]> {
    return this.searchByEmbedding(queryEmbedding, {
      ...options,
      filters: { industry }
    });
  }

  /**
   * Search within a specific workflow
   */
  async searchByWorkflow(
    queryEmbedding: number[],
    workflowId: string,
    options: Omit<SearchOptions, 'filters'> = {}
  ): Promise<SearchResult[]> {
    return this.searchByEmbedding(queryEmbedding, {
      ...options,
      filters: { workflowId }
    });
  }

  /**
   * Find similar memories to an existing memory
   */
  async findSimilar(
    memoryId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // Get the source memory
      const { data: sourceMemory, error } = await supabase
        .from('semantic_memory')
        .select('embedding, type')
        .eq('id', memoryId)
        .single();

      if (error || !sourceMemory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      // Search for similar memories
      return this.searchByEmbedding(sourceMemory.embedding, {
        type: sourceMemory.type,
        ...options
      });
    } catch (error) {
      logger.error('Find similar memories failed', { error, memoryId });
      throw error;
    }
  }

  /**
   * Check for duplicate or near-duplicate content
   */
  async checkDuplicate(
    queryEmbedding: number[],
    type: SemanticMemory['type'],
    duplicateThreshold: number = 0.95
  ): Promise<boolean> {
    const results = await this.searchByEmbedding(queryEmbedding, {
      type,
      threshold: duplicateThreshold,
      limit: 1,
      useCache: false
    });

    return results.length > 0;
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    recentCount: number;
  }> {
    try {
      // Total count
      const { count: total } = await supabase
        .from('semantic_memory')
        .select('id', { count: 'exact', head: true });

      // Count by type
      const { data: typeData } = await supabase
        .from('semantic_memory')
        .select('type');

      const byType: Record<string, number> = {};
      typeData?.forEach((row: any) => {
        byType[row.type] = (byType[row.type] || 0) + 1;
      });

      // Recent count (last 7 days)
      const { count: recentCount } = await supabase
        .from('semantic_memory')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      return {
        total: total || 0,
        byType,
        recentCount: recentCount || 0
      };
    } catch (error) {
      logger.error('Failed to get memory stats', { error });
      throw error;
    }
  }

  /**
   * Analyze similarity distribution for a query
   */
  async analyzeSimilarityDistribution(
    queryEmbedding: number[],
    type?: SemanticMemory['type']
  ): Promise<{
    count: number;
    average: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    distribution: {
      veryHigh: number;
      high: number;
      medium: number;
      low: number;
      veryLow: number;
    };
    recommendedThreshold: number;
  }> {
    try {
      // Get all similarities (no threshold)
      const results = await this.searchByEmbedding(queryEmbedding, {
        type,
        threshold: 0.0,
        limit: 100,
        useCache: false
      });

      if (results.length === 0) {
        throw new Error('No memories found for analysis');
      }

      const similarities = results.map(r => r.similarity);
      const sorted = similarities.sort((a, b) => b - a);

      // Calculate statistics
      const sum = similarities.reduce((a, b) => a + b, 0);
      const average = sum / similarities.length;
      const median = sorted[Math.floor(sorted.length / 2)];

      const variance = similarities.reduce(
        (sum, val) => sum + Math.pow(val - average, 2),
        0
      ) / similarities.length;
      const stdDev = Math.sqrt(variance);

      // Distribution buckets
      const distribution = {
        veryHigh: similarities.filter(s => s >= 0.90).length,
        high: similarities.filter(s => s >= 0.80 && s < 0.90).length,
        medium: similarities.filter(s => s >= 0.70 && s < 0.80).length,
        low: similarities.filter(s => s >= 0.60 && s < 0.70).length,
        veryLow: similarities.filter(s => s < 0.60).length
      };

      // Recommend threshold (average - 1 std dev, clamped to reasonable range)
      const recommendedThreshold = Math.max(0.50, Math.min(0.85, average - stdDev));

      return {
        count: results.length,
        average,
        median,
        stdDev,
        min: sorted[sorted.length - 1],
        max: sorted[0],
        distribution,
        recommendedThreshold
      };
    } catch (error) {
      logger.error('Similarity distribution analysis failed', { error });
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Vector search cache cleared');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private buildFilterClause(
    type?: SemanticMemory['type'],
    filters: Record<string, any> = {}
  ): string {
    const conditions: string[] = [];

    // Type filter
    if (type) {
      conditions.push(`type = '${type}'`);
    }

    // Metadata filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined) return;

      if (typeof value === 'string') {
        conditions.push(`metadata->>'${key}' = '${value}'`);
      } else if (typeof value === 'number') {
        conditions.push(`(metadata->>'${key}')::float = ${value}`);
      } else if (typeof value === 'boolean') {
        conditions.push(`(metadata->>'${key}')::boolean = ${value}`);
      } else if (Array.isArray(value)) {
        // Array contains check
        conditions.push(`metadata->'${key}' @> '${JSON.stringify(value)}'::jsonb`);
      }
    });

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  private getCacheKey(embedding: number[], options: SearchOptions): string {
    // Create deterministic cache key
    const embeddingHash = this.hashEmbedding(embedding);
    const optionsHash = JSON.stringify({
      type: options.type,
      threshold: options.threshold,
      limit: options.limit,
      filters: options.filters
    });

    return `${embeddingHash}:${optionsHash}`;
  }

  private hashEmbedding(embedding: number[]): string {
    // Simple hash for cache key (first/last/middle values)
    const samples = [
      embedding[0],
      embedding[Math.floor(embedding.length / 2)],
      embedding[embedding.length - 1]
    ];
    return samples.map(v => v.toFixed(4)).join(':');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const vectorSearchService = new VectorSearchService();

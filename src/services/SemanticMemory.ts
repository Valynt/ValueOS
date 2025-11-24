/**
 * Semantic Memory Service
 * 
 * Long-term semantic memory using pgvector for RAG (Retrieval-Augmented Generation).
 * Enables agents to recall past successful patterns, decisions, and outcomes.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface MemoryEntry {
  id: string;
  type: 'value_proposition' | 'target_definition' | 'opportunity' | 'integrity_check' | 'workflow_result';
  content: string;
  embedding: number[];
  metadata: {
    agentType: string;
    industry?: string;
    targetMarket?: string;
    score?: number;
    timestamp: Date;
    userId?: string;
    workflowId?: string;
    tags?: string[];
  };
  createdAt: Date;
}

export interface SemanticSearchResult {
  entry: MemoryEntry;
  similarity: number;
}

export class SemanticMemoryService {
  private supabase: ReturnType<typeof createClient>;
  private embeddingModel = 'text-embedding-3-small'; // OpenAI embedding model
  private embeddingDimension = 1536;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', error as Error);
      throw error;
    }
  }

  /**
   * Store a memory entry
   */
  async store(entry: Omit<MemoryEntry, 'id' | 'embedding' | 'createdAt'>): Promise<string> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(entry.content);

      // Store in database
      const { data, error } = await this.supabase
        .from('semantic_memory')
        .insert({
          type: entry.type,
          content: entry.content,
          embedding,
          metadata: entry.metadata,
        })
        .select('id')
        .single();

      if (error) throw error;

      logger.info('Memory stored', {
        id: data.id,
        type: entry.type,
        agentType: entry.metadata.agentType,
      });

      return data.id;
    } catch (error) {
      logger.error('Failed to store memory', error as Error);
      throw error;
    }
  }

  /**
   * Semantic search for similar memories
   */
  async search(
    query: string,
    options: {
      type?: MemoryEntry['type'];
      industry?: string;
      targetMarket?: string;
      minScore?: number;
      limit?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Build filter conditions
      const filters: string[] = [];
      if (options.type) filters.push(`type = '${options.type}'`);
      if (options.industry) filters.push(`metadata->>'industry' = '${options.industry}'`);
      if (options.targetMarket) filters.push(`metadata->>'targetMarket' = '${options.targetMarket}'`);
      if (options.minScore) filters.push(`(metadata->>'score')::float >= ${options.minScore}`);

      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

      // Perform vector similarity search
      const { data, error } = await this.supabase.rpc('search_semantic_memory', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7, // Cosine similarity threshold
        match_count: options.limit || 10,
        filter_clause: whereClause,
      });

      if (error) throw error;

      logger.info('Semantic search completed', {
        query: query.substring(0, 50),
        resultsCount: data?.length || 0,
      });

      return (data || []).map((row: any) => ({
        entry: {
          id: row.id,
          type: row.type,
          content: row.content,
          embedding: row.embedding,
          metadata: row.metadata,
          createdAt: new Date(row.created_at),
        },
        similarity: row.similarity,
      }));
    } catch (error) {
      logger.error('Semantic search failed', error as Error);
      throw error;
    }
  }

  /**
   * Store successful value proposition for future reference
   */
  async storeValueProposition(data: {
    content: string;
    industry: string;
    targetMarket: string;
    score: number;
    userId: string;
    workflowId: string;
  }): Promise<string> {
    return this.store({
      type: 'value_proposition',
      content: data.content,
      metadata: {
        agentType: 'OpportunityAgent',
        industry: data.industry,
        targetMarket: data.targetMarket,
        score: data.score,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
        tags: ['successful', 'validated'],
      },
    });
  }

  /**
   * Retrieve similar successful value propositions
   */
  async getSimilarValuePropositions(
    businessContext: string,
    industry: string,
    targetMarket: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(businessContext, {
      type: 'value_proposition',
      industry,
      targetMarket,
      minScore: 0.7, // Only retrieve high-quality examples
      limit: 5,
    });
  }

  /**
   * Store target definition for learning
   */
  async storeTargetDefinition(data: {
    content: string;
    industry: string;
    score: number;
    userId: string;
    workflowId: string;
  }): Promise<string> {
    return this.store({
      type: 'target_definition',
      content: data.content,
      metadata: {
        agentType: 'TargetAgent',
        industry: data.industry,
        score: data.score,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
      },
    });
  }

  /**
   * Get examples of successful targets for similar contexts
   */
  async getSimilarTargets(
    businessContext: string,
    industry: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(businessContext, {
      type: 'target_definition',
      industry,
      minScore: 0.8, // High bar for target examples
      limit: 3,
    });
  }

  /**
   * Store integrity check results for pattern learning
   */
  async storeIntegrityCheck(data: {
    content: string;
    passed: boolean;
    issues: string[];
    userId: string;
    workflowId: string;
  }): Promise<string> {
    return this.store({
      type: 'integrity_check',
      content: JSON.stringify({ content: data.content, issues: data.issues }),
      metadata: {
        agentType: 'IntegrityAgent',
        score: data.passed ? 1.0 : 0.0,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
        tags: data.passed ? ['passed'] : ['failed', ...data.issues],
      },
    });
  }

  /**
   * Learn from past integrity failures
   */
  async getCommonIntegrityIssues(
    contentType: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(contentType, {
      type: 'integrity_check',
      minScore: 0.0, // Include failures
      limit: 10,
    });
  }

  /**
   * Store complete workflow result for holistic learning
   */
  async storeWorkflowResult(data: {
    workflowId: string;
    workflowType: string;
    input: any;
    output: any;
    score: number;
    duration: number;
    userId: string;
  }): Promise<string> {
    const content = JSON.stringify({
      type: data.workflowType,
      input: data.input,
      output: data.output,
      duration: data.duration,
    });

    return this.store({
      type: 'workflow_result',
      content,
      metadata: {
        agentType: 'WorkflowOrchestrator',
        score: data.score,
        timestamp: new Date(),
        userId: data.userId,
        workflowId: data.workflowId,
        tags: [data.workflowType],
      },
    });
  }

  /**
   * Get similar successful workflows
   */
  async getSimilarWorkflows(
    workflowType: string,
    inputContext: string
  ): Promise<SemanticSearchResult[]> {
    return this.search(inputContext, {
      type: 'workflow_result',
      minScore: 0.7,
      limit: 5,
    });
  }

  /**
   * Prune old or low-quality memories
   */
  async pruneMemories(options: {
    olderThanDays?: number;
    minScore?: number;
    type?: MemoryEntry['type'];
  }): Promise<number> {
    try {
      const conditions: string[] = [];

      if (options.olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);
        conditions.push(`created_at < '${cutoffDate.toISOString()}'`);
      }

      if (options.minScore !== undefined) {
        conditions.push(`(metadata->>'score')::float < ${options.minScore}`);
      }

      if (options.type) {
        conditions.push(`type = '${options.type}'`);
      }

      if (conditions.length === 0) {
        throw new Error('At least one pruning condition required');
      }

      const { data, error } = await this.supabase
        .from('semantic_memory')
        .delete()
        .filter('id', 'neq', '00000000-0000-0000-0000-000000000000') // Dummy filter
        .select('id');

      if (error) throw error;

      const deletedCount = data?.length || 0;

      logger.info('Memories pruned', {
        deletedCount,
        conditions: options,
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to prune memories', error as Error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getStatistics(): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    avgScore: number;
    oldestMemory: Date | null;
    newestMemory: Date | null;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('semantic_memory')
        .select('type, metadata, created_at');

      if (error) throw error;

      const byType: Record<string, number> = {};
      let totalScore = 0;
      let scoreCount = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      data?.forEach((row) => {
        byType[row.type] = (byType[row.type] || 0) + 1;

        if (row.metadata?.score !== undefined) {
          totalScore += row.metadata.score;
          scoreCount++;
        }

        const date = new Date(row.created_at);
        if (!oldestDate || date < oldestDate) oldestDate = date;
        if (!newestDate || date > newestDate) newestDate = date;
      });

      return {
        totalMemories: data?.length || 0,
        byType,
        avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
        oldestMemory: oldestDate,
        newestMemory: newestDate,
      };
    } catch (error) {
      logger.error('Failed to get memory statistics', error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const semanticMemory = new SemanticMemoryService();

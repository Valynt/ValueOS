/**
 * Task #027-028: Agent Memory System
 * 
 * Long-term memory for agents to improve responses over time
 */

import { supabase } from '../supabase';
import { logger } from '../logger';

export interface MemoryEntry {
  id: string;
  agent_id: string;
  user_id: string;
  organization_id?: string;
  memory_type: 'fact' | 'preference' | 'pattern' | 'feedback' | 'outcome';
  content: string;
  context?: Record<string, any>;
  confidence: number;
  relevance_score?: number;
  created_at: string;
  last_accessed_at?: string;
  access_count: number;
}

export interface MemoryQuery {
  agent_id: string;
  user_id: string;
  query: string;
  limit?: number;
  min_confidence?: number;
  memory_types?: MemoryEntry['memory_type'][];
}

export class AgentMemory {
  private cacheEnabled: boolean = true;
  private memoryCache: Map<string, MemoryEntry[]> = new Map();

  /**
   * Store a memory entry
   */
  async store(entry: Omit<MemoryEntry, 'id' | 'created_at' | 'access_count'>): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('agent_memory')
        .insert({
          ...entry,
          access_count: 0,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      // Invalidate cache for this agent/user
      this.invalidateCache(entry.agent_id, entry.user_id);

      logger.debug('Memory stored', {
        agent_id: entry.agent_id,
        memory_type: entry.memory_type,
        memory_id: data.id,
      });

      return data.id;
    } catch (error) {
      logger.error('Failed to store memory', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant memories
   */
  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(query.agent_id, query.user_id);
      if (this.cacheEnabled && this.memoryCache.has(cacheKey)) {
        return this.filterMemories(this.memoryCache.get(cacheKey)!, query);
      }

      let dbQuery = supabase
        .from('agent_memory')
        .select('*')
        .eq('agent_id', query.agent_id)
        .eq('user_id', query.user_id)
        .gte('confidence', query.min_confidence || 0.5)
        .order('relevance_score', { ascending: false })
        .order('last_accessed_at', { ascending: false, nullsFirst: false })
        .limit(query.limit || 10);

      if (query.memory_types && query.memory_types.length > 0) {
        dbQuery = dbQuery.in('memory_type', query.memory_types);
      }

      const { data: memories, error } = await dbQuery;

      if (error) throw error;

      // Update access counts
      if (memories && memories.length > 0) {
        const ids = memories.map((m: MemoryEntry) => m.id);
        await this.updateAccessCounts(ids);
      }

      // Cache results
      if (this.cacheEnabled && memories) {
        this.memoryCache.set(cacheKey, memories);
      }

      return memories || [];
    } catch (error) {
      logger.error('Failed to retrieve memories', error);
      return [];
    }
  }

  /**
   * Search memories by semantic similarity (requires vector search)
   */
  async search(query: MemoryQuery & { embedding?: number[] }): Promise<MemoryEntry[]> {
    // If embeddings are provided, use vector similarity search
    if (query.embedding) {
      return this.vectorSearch(query);
    }

    // Fallback to text-based retrieve
    return this.retrieve(query);
  }

  /**
   * Vector search using embeddings
   */
  private async vectorSearch(query: MemoryQuery & { embedding: number[] }): Promise<MemoryEntry[]> {
    try {
      // Using Supabase pgvector extension
      const { data, error } = await supabase.rpc('match_agent_memories', {
        query_embedding: query.embedding,
        agent_id: query.agent_id,
        user_id: query.user_id,
        match_threshold: query.min_confidence || 0.5,
        match_count: query.limit || 10,
      });

      if (error) throw error;

      // Update access counts
      if (data && data.length > 0) {
        const ids = data.map((m: MemoryEntry) => m.id);
        await this.updateAccessCounts(ids);
      }

      return data || [];
    } catch (error) {
      logger.warn('Vector search failed, falling back to text search', error);
      return this.retrieve(query);
    }
  }

  /**
   * Update memory confidence based on feedback
   */
  async updateConfidence(memoryId: string, feedback: 'positive' | 'negative' | 'neutral'): Promise<void> {
    try {
      // Get current memory
      const { data: memory, error: fetchError } = await supabase
        .from('agent_memory')
        .select('confidence')
        .eq('id', memoryId)
        .single();

      if (fetchError) throw fetchError;

      // Adjust confidence
      let newConfidence = memory.confidence;
      if (feedback === 'positive') {
        newConfidence = Math.min(1.0, newConfidence + 0.1);
      } else if (feedback === 'negative') {
        newConfidence = Math.max(0.0, newConfidence - 0.15);
      }

      // Update in database
      const { error: updateError } = await supabase
        .from('agent_memory')
        .update({ confidence: newConfidence })
        .eq('id', memoryId);

      if (updateError) throw updateError;

      logger.debug('Memory confidence updated', {
        memory_id: memoryId,
        feedback,
        new_confidence: newConfidence,
      });
    } catch (error) {
      logger.error('Failed to update memory confidence', error);
    }
  }

  /**
   * Prune low-confidence or old memories
   */
  async prune(params: { agent_id: string; user_id: string; maxAge?: number; minConfidence?: number }): Promise<number> {
    try {
      let deleteQuery = supabase
        .from('agent_memory')
        .delete()
        .eq('agent_id', params.agent_id)
        .eq('user_id', params.user_id);

      // Delete based on confidence
      if (params.minConfidence !== undefined) {
        deleteQuery = deleteQuery.lt('confidence', params.minConfidence);
      }

      // Delete based on age
      if (params.maxAge) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - params.maxAge);
        deleteQuery = deleteQuery.lt('created_at', cutoffDate.toISOString());
      }

      const { data, error } = await deleteQuery.select('id');

      if (error) throw error;

      const deletedCount = data?.length || 0;

      logger.info('Memory pruned', {
        agent_id: params.agent_id,
        user_id: params.user_id,
        deleted_count: deletedCount,
      });

      // Invalidate cache
      this.invalidateCache(params.agent_id, params.user_id);

      return deletedCount;
    } catch (error) {
      logger.error('Failed to prune memories', error);
      return 0;
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(agentId: string, userId: string): Promise<{
    total_memories: number;
    by_type: Record<string, number>;
    avg_confidence: number;
    most_accessed: MemoryEntry[];
  }> {
    try {
      const { data: memories, error } = await supabase
        .from('agent_memory')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', userId);

      if (error) throw error;

      const byType: Record<string, number> = {};
      let totalConfidence = 0;

      memories?.forEach((m: MemoryEntry) => {
        byType[m.memory_type] = (byType[m.memory_type] || 0) + 1;
        totalConfidence += m.confidence;
      });

      const sortedByAccess = [...(memories || [])].sort((a, b) => b.access_count - a.access_count).slice(0, 5);

      return {
        total_memories: memories?.length || 0,
        by_type: byType,
        avg_confidence: memories?.length ? totalConfidence / memories.length : 0,
        most_accessed: sortedByAccess,
      };
    } catch (error) {
      logger.error('Failed to get memory stats', error);
      return {
        total_memories: 0,
        by_type: {},
        avg_confidence: 0,
        most_accessed: [],
      };
    }
  }

  /**
   * Clear all memories for agent/user
   */
  async clear(agentId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('agent_memory')
        .delete()
        .eq('agent_id', agentId)
        .eq('user_id', userId);

      if (error) throw error;

      this.invalidateCache(agentId, userId);

      logger.info('Memory cleared', { agent_id: agentId, user_id: userId });
    } catch (error) {
      logger.error('Failed to clear memory', error);
    }
  }

  /**
   * Update access counts for accessed memories
   */
  private async updateAccessCounts(memoryIds: string[]): Promise<void> {
    try {
      // Batch update access counts
      await Promise.all(
        memoryIds.map((id) =>
          supabase.rpc('increment_memory_access', {
            memory_id: id,
            timestamp: new Date().toISOString(),
          })
        )
      );
    } catch (error) {
      logger.warn('Failed to update access counts', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Filter memories based on query
   */
  private filterMemories(memories: MemoryEntry[], query: MemoryQuery): MemoryEntry[] {
    let filtered = [...memories];

    if (query.memory_types && query.memory_types.length > 0) {
      filtered = filtered.filter((m) => query.memory_types!.includes(m.memory_type));
    }

    if (query.min_confidence) {
      filtered = filtered.filter((m) => m.confidence >= query.min_confidence!);
    }

    return filtered.slice(0, query.limit || 10);
  }

  /**
   * Get cache key
   */
  private getCacheKey(agentId: string, userId: string): string {
    return `${agentId}:${userId}`;
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(agentId: string, userId: string): void {
    const key = this.getCacheKey(agentId, userId);
    this.memoryCache.delete(key);
  }
}

export const agentMemory = new AgentMemory();

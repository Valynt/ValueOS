/**
 * Agent Memory Service
 *
 * Provides long-term context storage and retrieval for ValueOS agents.
 * Critical for context continuity across sessions and agent interactions.
 *
 * Responsibilities:
 * - Long-term context storage
 * - Cross-session memory persistence
 * - Context enrichment for all state stores
 * - Memory query and retrieval
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger.js'
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface AgentMemory {
  id: string;
  caseId: string;
  tenantId: string;
  agentType: string;
  memoryType: MemoryType;
  content: AgentMemoryContent;
  metadata: AgentMemoryMetadata;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export enum MemoryType {
  CONTEXT = 'context',
  INSIGHT = 'insight',
  DECISION = 'decision',
  LEARNING = 'learning',
  PREFERENCE = 'preference',
  RELATIONSHIP = 'relationship',
  METRIC = 'metric',
  ERROR = 'error'
}

export interface AgentMemoryContent {
  title: string;
  description: string;
  data: Record<string, any>;
  tags: string[];
  confidence: number;
  source: string;
  relevanceScore: number;
}

export interface AgentMemoryMetadata {
  version: number;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  encrypted: boolean;
  complianceTags: string[];
}

export interface MemoryQuery {
  caseId?: string;
  /** Required for tenant isolation. All memory queries must be scoped to a tenant. */
  tenantId: string;
  agentType?: string;
  memoryType?: MemoryType;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  textSearch?: string;
  limit?: number;
  offset?: number;
}

export interface MemoryQueryResult {
  memories: AgentMemory[];
  totalCount: number;
  hasMore: boolean;
  queryTime: number;
}

export interface ContextEnrichment {
  caseContext: CaseContext;
  userPreferences: UserPreferences;
  historicalInsights: HistoricalInsight[];
  agentRelationships: AgentRelationship[];
  performanceMetrics: PerformanceMetric[];
}

export interface CaseContext {
  caseId: string;
  industry?: string;
  companySize?: string;
  stage: string;
  keyMetrics: Record<string, number>;
  previousAnalyses: AnalysisSummary[];
  stakeholderInfo: StakeholderInfo[];
}

export interface UserPreferences {
  preferredAnalysisDepth: 'shallow' | 'medium' | 'deep';
  communicationStyle: 'formal' | 'casual' | 'technical';
  metricPreferences: string[];
  timezone: string;
  language: string;
}

export interface HistoricalInsight {
  id: string;
  type: string;
  content: string;
  confidence: number;
  createdAt: Date;
  relevanceScore: number;
}

export interface AgentRelationship {
  agentType: string;
  interactionCount: number;
  successRate: number;
  averageConfidence: number;
  lastInteraction: Date;
}

export interface PerformanceMetric {
  metricName: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  benchmark?: number;
}

// ============================================================================
// Agent Memory Service
// ============================================================================

export class AgentMemoryService {
  private supabase: ReturnType<typeof createClient>;
  private cache = new Map<string, AgentMemory>();
  private readonly cacheMaxSize = 1000;
  private readonly cacheTTL = 30 * 60 * 1000; // 30 minutes

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Store agent memory
   */
  async storeMemory(memory: Omit<AgentMemory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const memoryRecord: AgentMemory = {
        ...memory,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate memory content
      this.validateMemory(memoryRecord);

      // Store in database
      const { data, error } = await this.supabase
        .from('agent_memory')
        .insert({
          id: memoryRecord.id,
          case_id: memoryRecord.caseId,
          tenant_id: memoryRecord.tenantId,
          agent_type: memoryRecord.agentType,
          memory_type: memoryRecord.memoryType,
          content: memoryRecord.content,
          metadata: memoryRecord.metadata,
          created_at: memoryRecord.createdAt.toISOString(),
          updated_at: memoryRecord.updatedAt.toISOString(),
          expires_at: memoryRecord.expiresAt?.toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to store memory: ${error.message}`);
      }

      // Update cache
      this.updateCache(memoryRecord);

      logger.info('Memory stored successfully', {
        memoryId: memoryRecord.id,
        caseId: memoryRecord.caseId,
        agentType: memoryRecord.agentType,
        memoryType: memoryRecord.memoryType,
      });

      return memoryRecord.id;

    } catch (error) {
      logger.error('Failed to store memory', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Retrieve agent memory
   */
  async getMemory(memoryId: string): Promise<AgentMemory | null> {
    try {
      // Check cache first
      const cached = this.cache.get(memoryId);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Query database
      const { data, error } = await this.supabase
        .from('agent_memory')
        .select('*')
        .eq('id', memoryId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to retrieve memory: ${error.message}`);
      }

      const memory = this.mapDatabaseRecord(data);

      // Update cache
      this.updateCache(memory);

      // Update access metadata
      await this.updateAccessMetadata(memoryId);

      return memory;

    } catch (error) {
      logger.error('Failed to retrieve memory', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Query memories
   */
  async queryMemories(query: MemoryQuery): Promise<MemoryQueryResult> {
    if (!query.tenantId) {
      throw new Error("tenantId is required for memory queries to enforce tenant isolation");
    }

    const startTime = Date.now();

    try {
      let dbQuery = this.supabase.from('agent_memory').select('*');

      // CRITICAL: Apply tenant filter first
      dbQuery = dbQuery.eq('tenant_id', query.tenantId);

      if (query.caseId) {
        dbQuery = dbQuery.eq('case_id', query.caseId);
      }
      if (query.agentType) {
        dbQuery = dbQuery.eq('agent_type', query.agentType);
      }
      if (query.memoryType) {
        dbQuery = dbQuery.eq('memory_type', query.memoryType);
      }
      if (query.dateRange) {
        dbQuery = dbQuery
          .gte('created_at', query.dateRange.start.toISOString())
          .lte('created_at', query.dateRange.end.toISOString());
      }

      // Text search
      if (query.textSearch) {
        dbQuery = dbQuery.or(`
          content->>title.ilike.%${query.textSearch}%,
          content->>description.ilike.%${query.textSearch}%
        `);
      }

      // Pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await dbQuery;

      if (error) {
        throw new Error(`Failed to query memories: ${error.message}`);
      }

      const memories = (data || []).map(record => this.mapDatabaseRecord(record));

      // Update cache for retrieved memories
      memories.forEach(memory => this.updateCache(memory));

      const queryTime = Date.now() - startTime;

      return {
        memories,
        totalCount: count || 0,
        hasMore: memories.length === limit,
        queryTime,
      };

    } catch (error) {
      logger.error('Failed to query memories', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Get context enrichment for a case
   */
  async getContextEnrichment(caseId: string, tenantId: string): Promise<ContextEnrichment> {
    try {
      // Query all relevant memories for the case
      const memories = await this.queryMemories({
        caseId,
        tenantId,
        limit: 100,
      });

      // Process memories into enrichment data
      const enrichment: ContextEnrichment = {
        caseContext: this.extractCaseContext(memories.memories),
        userPreferences: this.extractUserPreferences(memories.memories),
        historicalInsights: this.extractHistoricalInsights(memories.memories),
        agentRelationships: this.extractAgentRelationships(memories.memories),
        performanceMetrics: this.extractPerformanceMetrics(memories.memories),
      };

      logger.info('Context enrichment generated', {
        caseId,
        insightCount: enrichment.historicalInsights.length,
        relationshipCount: enrichment.agentRelationships.length,
      });

      return enrichment;

    } catch (error) {
      logger.error('Failed to generate context enrichment', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Update memory
   */
  async updateMemory(memoryId: string, updates: Partial<AgentMemory>): Promise<void> {
    try {
      const existingMemory = await this.getMemory(memoryId);
      if (!existingMemory) {
        throw new Error(`Memory not found: ${memoryId}`);
      }

      const updatedMemory: AgentMemory = {
        ...existingMemory,
        ...updates,
        updatedAt: new Date(),
      };

      // Validate updated memory
      this.validateMemory(updatedMemory);

      // Update database
      const { error } = await this.supabase
        .from('agent_memory')
        .update({
          content: updatedMemory.content,
          metadata: updatedMemory.metadata,
          updated_at: updatedMemory.updatedAt.toISOString(),
          expires_at: updatedMemory.expiresAt?.toISOString(),
        })
        .eq('id', memoryId);

      if (error) {
        throw new Error(`Failed to update memory: ${error.message}`);
      }

      // Update cache
      this.updateCache(updatedMemory);

      logger.info('Memory updated successfully', { memoryId });

    } catch (error) {
      logger.error('Failed to update memory', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Delete memory
   */
  async deleteMemory(memoryId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('agent_memory')
        .delete()
        .eq('id', memoryId);

      if (error) {
        throw new Error(`Failed to delete memory: ${error.message}`);
      }

      // Remove from cache
      this.cache.delete(memoryId);

      logger.info('Memory deleted successfully', { memoryId });

    } catch (error) {
      logger.error('Failed to delete memory', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpiredMemories(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('agent_memory')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        throw new Error(`Failed to cleanup expired memories: ${error.message}`);
      }

      const deletedCount = Array.isArray(data) ? data.length : 0;

      logger.info('Expired memories cleaned up', { deletedCount });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired memories', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateMemory(memory: AgentMemory): void {
    if (!memory.caseId) {
      throw new Error('Case ID is required');
    }
    if (!memory.tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!memory.agentType) {
      throw new Error('Agent type is required');
    }
    if (!memory.content.title) {
      throw new Error('Memory title is required');
    }
    if (memory.content.confidence < 0 || memory.content.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  private mapDatabaseRecord(record: any): AgentMemory {
    return {
      id: record.id,
      caseId: record.case_id,
      tenantId: record.tenant_id,
      agentType: record.agent_type,
      memoryType: record.memory_type,
      content: record.content,
      metadata: record.metadata,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
    };
  }

  private updateCache(memory: AgentMemory): void {
    // Implement LRU cache eviction if needed
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(memory.id, memory);
  }

  private isCacheValid(memory: AgentMemory): boolean {
    const age = Date.now() - memory.updatedAt.getTime();
    return age < this.cacheTTL;
  }

  private async updateAccessMetadata(memoryId: string): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('increment_memory_access', { memory_id: memoryId });

      if (error) {
        logger.warn('Failed to update access metadata', { memoryId, error: error.message });
      }
    } catch (error) {
      logger.warn('Failed to update access metadata', error instanceof Error ? error : undefined);
    }
  }

  private extractCaseContext(memories: AgentMemory[]): CaseContext {
    const contextMemories = memories.filter(m => m.memoryType === MemoryType.CONTEXT);

    if (contextMemories.length === 0) {
      return {
        caseId: '',
        stage: 'opportunity',
        keyMetrics: {},
        previousAnalyses: [],
        stakeholderInfo: [],
      };
    }

    const latestContext = contextMemories[0]; // Most recent

    return {
      caseId: latestContext.caseId,
      industry: latestContext.content.data.industry,
      companySize: latestContext.content.data.companySize,
      stage: latestContext.content.data.stage || 'opportunity',
      keyMetrics: latestContext.content.data.keyMetrics || {},
      previousAnalyses: latestContext.content.data.previousAnalyses || [],
      stakeholderInfo: latestContext.content.data.stakeholderInfo || [],
    };
  }

  private extractUserPreferences(memories: AgentMemory[]): UserPreferences {
    const preferenceMemories = memories.filter(m => m.memoryType === MemoryType.PREFERENCE);

    if (preferenceMemories.length === 0) {
      return {
        preferredAnalysisDepth: 'medium',
        communicationStyle: 'casual',
        metricPreferences: [],
        timezone: 'UTC',
        language: 'en',
      };
    }

    const latestPrefs = preferenceMemories[0];

    return {
      preferredAnalysisDepth: latestPrefs.content.data.analysisDepth || 'medium',
      communicationStyle: latestPrefs.content.data.communicationStyle || 'casual',
      metricPreferences: latestPrefs.content.data.metricPreferences || [],
      timezone: latestPrefs.content.data.timezone || 'UTC',
      language: latestPrefs.content.data.language || 'en',
    };
  }

  private extractHistoricalInsights(memories: AgentMemory[]): HistoricalInsight[] {
    return memories
      .filter(m => m.memoryType === MemoryType.INSIGHT || m.memoryType === MemoryType.LEARNING)
      .map(m => ({
        id: m.id,
        type: m.memoryType,
        content: m.content.description,
        confidence: m.content.confidence,
        createdAt: m.createdAt,
        relevanceScore: m.content.relevanceScore,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10); // Top 10 most relevant
  }

  private extractAgentRelationships(memories: AgentMemory[]): AgentRelationship[] {
    const agentTypes = [...new Set(memories.map(m => m.agentType))];

    return agentTypes.map(agentType => {
      const agentMemories = memories.filter(m => m.agentType === agentType);
      const successMemories = agentMemories.filter(m => m.content.confidence > 0.7);

      return {
        agentType,
        interactionCount: agentMemories.length,
        successRate: agentMemories.length > 0 ? successMemories.length / agentMemories.length : 0,
        averageConfidence: agentMemories.length > 0
          ? agentMemories.reduce((sum, m) => sum + m.content.confidence, 0) / agentMemories.length
          : 0,
        lastInteraction: new Date(Math.max(...agentMemories.map(m => m.createdAt.getTime()))),
      };
    });
  }

  private extractPerformanceMetrics(memories: AgentMemory[]): PerformanceMetric[] {
    const metricMemories = memories.filter(m => m.memoryType === MemoryType.METRIC);

    return metricMemories.map(m => ({
      metricName: m.content.title,
      value: m.content.data.value,
      unit: m.content.data.unit || 'number',
      trend: m.content.data.trend || 'stable',
      benchmark: m.content.data.benchmark,
    }));
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createAgentMemoryService(supabaseUrl: string, supabaseKey: string): AgentMemoryService {
  return new AgentMemoryService(supabaseUrl, supabaseKey);
}

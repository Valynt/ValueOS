/**
 * Agent Memory Integration
 * 
 * Integrates MemorySystem with AgentAPI to provide persistent agent memory.
 * Stores episodes and retrieves similar past experiences for context.
 */

import { AgentAPI, AgentRequest, AgentResponse } from './AgentAPI';
import { MemorySystem } from '../lib/agent-fabric/MemorySystem';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';

export interface MemoryEnhancedRequest extends AgentRequest {
  /** Session ID for memory persistence */
  sessionId?: string;
  /** Enable memory retrieval */
  useMemory?: boolean;
  /** Number of similar episodes to retrieve */
  memoryLimit?: number;
}

export interface MemoryEnhancedResponse<T = any> extends AgentResponse<T> {
  /** Episode ID if memory was stored */
  episodeId?: string;
  /** Retrieved similar episodes */
  similarEpisodes?: any[];
  /** Memory stats */
  memoryStats?: {
    episodesRetrieved: number;
    memoryStored: boolean;
    executionTime: number;
  };
}

/**
 * Agent API with integrated memory system
 */
export class AgentMemoryIntegration {
  private agentAPI: AgentAPI;
  private memorySystem: MemorySystem;
  private llmGateway: LLMGateway;

  constructor() {
    this.agentAPI = new AgentAPI();
    this.llmGateway = new LLMGateway(supabase as any);
    this.memorySystem = new MemorySystem(supabase as any, this.llmGateway);
  }

  /**
   * Invoke agent with memory integration
   * 
   * Process:
   * 1. Retrieve similar past episodes (if enabled)
   * 2. Enhance context with memory
   * 3. Invoke agent
   * 4. Store new episode
   * 5. Return response with memory metadata
   */
  async invokeWithMemory<T = any>(
    request: MemoryEnhancedRequest
  ): Promise<MemoryEnhancedResponse<T>> {
    const startTime = Date.now();
    const sessionId = request.sessionId || this.generateSessionId();
    const useMemory = request.useMemory ?? true;
    const memoryLimit = request.memoryLimit || 5;

    try {
      let similarEpisodes: any[] = [];
      let enhancedContext = { ...request.context };

      // Step 1: Retrieve similar episodes if memory enabled
      if (useMemory) {
        similarEpisodes = await this.retrieveSimilarEpisodes(
          request,
          memoryLimit
        );

        // Step 2: Enhance context with memory
        if (similarEpisodes.length > 0) {
          enhancedContext = this.enhanceContextWithMemory(
            enhancedContext,
            similarEpisodes
          );
          
          logger.info('Retrieved similar episodes for context', {
            agent: request.agent,
            count: similarEpisodes.length,
            sessionId,
          });
        }
      }

      // Step 3: Invoke agent with enhanced context
      const response = await this.agentAPI.invokeAgent<T>({
        ...request,
        context: enhancedContext,
      });

      // Step 4: Store new episode
      let episodeId: string | undefined;
      
      if (useMemory && response.success) {
        episodeId = await this.storeEpisode(
          sessionId,
          request,
          response
        );

        logger.info('Stored agent episode', {
          agent: request.agent,
          episodeId,
          sessionId,
        });
      }

      // Step 5: Return enhanced response
      const executionTime = Date.now() - startTime;

      return {
        ...response,
        episodeId,
        similarEpisodes: useMemory ? similarEpisodes : undefined,
        memoryStats: {
          episodesRetrieved: similarEpisodes.length,
          memoryStored: !!episodeId,
          executionTime,
        },
      };
    } catch (error) {
      logger.error('Agent invocation with memory failed', error instanceof Error ? error : new Error(String(error)), {
        agent: request.agent,
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Retrieve similar past episodes
   */
  private async retrieveSimilarEpisodes(
    request: MemoryEnhancedRequest,
    limit: number
  ): Promise<any[]> {
    try {
      const context = {
        agent: request.agent,
        query: request.query,
        ...request.context,
      };

      const episodes = await this.memorySystem.retrieveSimilarEpisodes(
        context,
        limit
      );

      return episodes;
    } catch (error) {
      logger.warn('Failed to retrieve similar episodes', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Enhance request context with memory
   */
  private enhanceContextWithMemory(
    context: Record<string, any>,
    similarEpisodes: any[]
  ): Record<string, any> {
    const memoryContext = similarEpisodes.map((episode) => ({
      taskIntent: episode.task_intent,
      success: episode.success,
      rewardScore: episode.reward_score,
      summary: episode.summary || 'No summary available',
      createdAt: episode.created_at,
    }));

    return {
      ...context,
      pastExperiences: memoryContext,
      memoryNote:
        'Use these past experiences to inform your approach. Similar situations from your memory:',
    };
  }

  /**
   * Store episode after agent execution
   */
  private async storeEpisode(
    sessionId: string,
    request: MemoryEnhancedRequest,
    response: AgentResponse<any>
  ): Promise<string> {
    try {
      const episodeId = await this.memorySystem.storeEpisode({
        sessionId,
        agentId: request.agent,
        episodeType: 'agent_invocation',
        taskIntent: request.query,
        context: request.context || {},
        initialState: {
          query: request.query,
          parameters: request.parameters,
        },
        finalState: {
          result: response.data,
          tokens: (response as any).tokenUsage,
        },
        success: response.success,
        rewardScore: this.calculateRewardScore(response),
        durationSeconds: ((response as any).tokenUsage?.totalTokens || 0) / 1000, // Rough estimate
      });

      // Store episodic memory for quick retrieval
      await this.memorySystem.storeEpisodicMemory(
        sessionId,
        request.agent,
        `Processed: ${request.query}`,
        {
          success: response.success,
          responsePreview: JSON.stringify(response.data).substring(0, 200),
        }
      );

      return episodeId;
    } catch (error) {
      logger.error('Failed to store episode', error instanceof Error ? error : new Error(String(error)), {
        sessionId,
        agent: request.agent,
      });
      throw error;
    }
  }

  /**
   * Calculate reward score based on response quality
   */
  private calculateRewardScore(response: AgentResponse<any>): number {
    let score = 0.5; // Base score

    // Success bonus
    if (response.success) {
      score += 0.3;
    }

    // Token efficiency bonus (fewer tokens = better)
    if ((response as any).tokenUsage) {
      const totalTokens = (response as any).tokenUsage.totalTokens || 0;
      if (totalTokens < 500) {
        score += 0.2;
      } else if (totalTokens < 1000) {
        score += 0.1;
      }
    }

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get memory stats for a session
   */
  async getSessionMemoryStats(sessionId: string): Promise<{
    episodeCount: number;
    totalReward: number;
    averageReward: number;
  }> {
    try {
      const { data, error } = await (supabase as any)
        .from('episodes')
        .select('reward_score')
        .eq('session_id', sessionId);

      if (error) throw error;

      const episodes = data || [];
      const totalReward = episodes.reduce(
        (sum: number, ep: any) => sum + (ep.reward_score || 0),
        0
      );

      return {
        episodeCount: episodes.length,
        totalReward,
        averageReward: episodes.length > 0 ? totalReward / episodes.length : 0,
      };
    } catch (error) {
      logger.error('Failed to get session memory stats', error instanceof Error ? error : new Error(String(error)), {
        sessionId,
      });
      return {
        episodeCount: 0,
        totalReward: 0,
        averageReward: 0,
      };
    }
  }

  /**
   * Clear memory for a session (useful for testing)
   */
  async clearSessionMemory(sessionId: string): Promise<void> {
    try {
      // Delete all episodes for this session
      await (supabase as any)
        .from('episodes')
        .delete()
        .eq('session_id', sessionId);

      // Delete all episodic memories
      await (supabase as any)
        .from('agent_memory')
        .delete()
        .eq('session_id', sessionId);

      logger.info('Cleared session memory', { sessionId });
    } catch (error) {
      logger.error('Failed to clear session memory', error instanceof Error ? error : new Error(String(error)), {
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Get the underlying AgentAPI instance
   */
  getAgentAPI(): AgentAPI {
    return this.agentAPI;
  }

  /**
   * Get the underlying MemorySystem instance
   */
  getMemorySystem(): MemorySystem {
    return this.memorySystem;
  }
}

// Singleton instance
export const agentMemory = new AgentMemoryIntegration();

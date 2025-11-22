import { logger } from '../../lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { MemoryType, AgentMemory } from './types';
import { LLMGateway } from './LLMGateway';

export class MemorySystem {
  constructor(
    private supabase: SupabaseClient,
    private llmGateway: LLMGateway
  ) {}

  async storeEpisodicMemory(
    sessionId: string,
    agentId: string,
    event: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase.from('agent_memory').insert({
      session_id: sessionId,
      agent_id: agentId,
      memory_type: 'episodic',
      content: event,
      metadata,
      importance_score: 0.5
    });
  }

  async storeSemanticMemory(
    sessionId: string,
    agentId: string,
    knowledge: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const embedding = await this.llmGateway.generateEmbedding(knowledge);

    await this.supabase.from('agent_memory').insert({
      session_id: sessionId,
      agent_id: agentId,
      memory_type: 'semantic',
      content: knowledge,
      embedding: `[${embedding.join(',')}]`,
      metadata,
      importance_score: 0.7
    });
  }

  async storeWorkingMemory(
    sessionId: string,
    agentId: string,
    taskState: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase.from('agent_memory').insert({
      session_id: sessionId,
      agent_id: agentId,
      memory_type: 'working',
      content: taskState,
      metadata,
      importance_score: 0.3
    });
  }

  // ============================================================================
  // Episodic Memory Extensions for LLM-MARL
  // ============================================================================

  /**
   * Store a complete episode
   */
  async storeEpisode(episode: {
    sessionId: string;
    agentId: string;
    episodeType: string;
    taskIntent: string;
    context: Record<string, any>;
    initialState: Record<string, any>;
    finalState: Record<string, any>;
    success: boolean;
    rewardScore: number;
    durationSeconds: number;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .rpc('store_episode', {
        p_session_id: episode.sessionId,
        p_agent_id: episode.agentId,
        p_episode_type: episode.episodeType,
        p_task_intent: episode.taskIntent,
        p_context: episode.context,
        p_initial_state: episode.initialState,
        p_final_state: episode.finalState,
        p_success: episode.success,
        p_reward_score: episode.rewardScore,
        p_duration_seconds: episode.durationSeconds,
      })
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Store an episode step
   */
  async storeEpisodeStep(step: {
    episodeId: string;
    stepNumber: number;
    actionType: string;
    actionDescription: string;
    agentName: string;
    stateBefore: Record<string, any>;
    stateAfter: Record<string, any>;
    reasoning: string;
    success: boolean;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .rpc('store_episode_step', {
        p_episode_id: step.episodeId,
        p_step_number: step.stepNumber,
        p_action_type: step.actionType,
        p_action_description: step.actionDescription,
        p_agent_name: step.agentName,
        p_state_before: step.stateBefore,
        p_state_after: step.stateAfter,
        p_reasoning: step.reasoning,
        p_success: step.success,
      })
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Retrieve similar episodes for analogy-based learning
   */
  async retrieveSimilarEpisodes(
    context: Record<string, any>,
    limit: number = 10
  ): Promise<any[]> {
    const { data, error } = await this.supabase
      .rpc('retrieve_similar_episodes', {
        p_context: context,
        p_limit: limit,
      });

    if (error) throw error;
    return data || [];
  }

  /**
   * Score an episode with reward and quality metrics
   */
  async scoreEpisode(
    episodeId: string,
    rewardScore: number,
    qualityScore: number
  ): Promise<void> {
    const { error } = await this.supabase
      .rpc('score_episode', {
        p_episode_id: episodeId,
        p_reward_score: rewardScore,
        p_quality_score: qualityScore,
      });

    if (error) throw error;
  }

  /**
   * Get episode with all steps
   */
  async getEpisodeWithSteps(episodeId: string): Promise<any> {
    const [episodeResult, stepsResult] = await Promise.all([
      this.supabase
        .from('episodes')
        .select('*')
        .eq('id', episodeId)
        .single(),
      this.supabase
        .from('episode_steps')
        .select('*')
        .eq('episode_id', episodeId)
        .order('step_number', { ascending: true }),
    ]);

    if (episodeResult.error) throw episodeResult.error;
    if (stepsResult.error) throw stepsResult.error;

    return {
      ...episodeResult.data,
      steps: stepsResult.data || [],
    };
  }

  /**
   * Store simulation result
   */
  async storeSimulationResult(result: {
    episodeId: string;
    simulationType: string;
    parameters: Record<string, any>;
    predictedOutcome: Record<string, any>;
    confidenceScore: number;
    riskAssessment: Record<string, any>;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('simulation_results')
      .insert({
        episode_id: result.episodeId,
        simulation_type: result.simulationType,
        parameters: result.parameters,
        predicted_outcome: result.predictedOutcome,
        confidence_score: result.confidenceScore,
        risk_assessment: result.riskAssessment,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Get successful episodes for learning
   */
  async getSuccessfulEpisodes(
    episodeType?: string,
    limit: number = 50
  ): Promise<any[]> {
    let query = this.supabase
      .from('episodes')
      .select('*')
      .eq('success', true)
      .order('reward_score', { ascending: false })
      .limit(limit);

    if (episodeType) {
      query = query.eq('episode_type', episodeType);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get failed episodes for analysis
   */
  async getFailedEpisodes(
    episodeType?: string,
    limit: number = 50
  ): Promise<any[]> {
    let query = this.supabase
      .from('episodes')
      .select('*')
      .eq('success', false)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (episodeType) {
      query = query.eq('episode_type', episodeType);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Calculate episode statistics
   */
  async getEpisodeStats(episodeType?: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageReward: number;
    averageDuration: number;
  }> {
    let query = this.supabase
      .from('episodes')
      .select('success, reward_score, duration_seconds');

    if (episodeType) {
      query = query.eq('episode_type', episodeType);
    }

    const { data, error } = await query;

    if (error) throw error;

    const episodes = data || [];
    const successful = episodes.filter((e) => e.success).length;
    const failed = episodes.filter((e) => !e.success).length;
    const avgReward =
      episodes.reduce((sum, e) => sum + (e.reward_score || 0), 0) / episodes.length || 0;
    const avgDuration =
      episodes.reduce((sum, e) => sum + (e.duration_seconds || 0), 0) / episodes.length || 0;

    return {
      total: episodes.length,
      successful,
      failed,
      averageReward: avgReward,
      averageDuration: avgDuration,
    };
  }

  async storeWorkingMemory_old(
    sessionId: string,
    agentId: string,
    taskState: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase.from('agent_memory').insert({
      session_id: sessionId,
      agent_id: agentId,
      memory_type: 'working',
      content: taskState,
      metadata,
      importance_score: 1.0
    });
  }

  async storeProceduralMemory(
    sessionId: string,
    agentId: string,
    pattern: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase.from('agent_memory').insert({
      session_id: sessionId,
      agent_id: agentId,
      memory_type: 'procedural',
      content: pattern,
      metadata,
      importance_score: 0.8
    });
  }

  async getEpisodicMemory(sessionId: string, limit: number = 10): Promise<AgentMemory[]> {
    const { data, error } = await this.supabase
      .from('agent_memory')
      .select('*')
      .eq('session_id', sessionId)
      .eq('memory_type', 'episodic')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getWorkingMemory(sessionId: string, agentId?: string): Promise<AgentMemory[]> {
    let query = this.supabase
      .from('agent_memory')
      .select('*')
      .eq('session_id', sessionId)
      .eq('memory_type', 'working')
      .order('created_at', { ascending: false });

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async searchSemanticMemory(
    sessionId: string,
    query: string,
    limit: number = 5
  ): Promise<AgentMemory[]> {
    const queryEmbedding = await this.llmGateway.generateEmbedding(query);

    const { data, error } = await this.supabase.rpc('match_memory', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
      p_session_id: sessionId
    });

    if (error) {
      logger.warn('Semantic search failed, falling back to text search:', error);
      const { data: fallbackData } = await this.supabase
        .from('agent_memory')
        .select('*')
        .eq('session_id', sessionId)
        .eq('memory_type', 'semantic')
        .ilike('content', `%${query}%`)
        .limit(limit);

      return fallbackData || [];
    }

    return data || [];
  }

  async updateAccessTime(memoryId: string): Promise<void> {
    await this.supabase
      .from('agent_memory')
      .update({ accessed_at: new Date().toISOString() })
      .eq('id', memoryId);
  }

  async clearWorkingMemory(sessionId: string): Promise<void> {
    await this.supabase
      .from('agent_memory')
      .delete()
      .eq('session_id', sessionId)
      .eq('memory_type', 'working');
  }
}

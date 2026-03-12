/**
 * Agent Prefetch Service
 * 
 * Proactively prefetches agent responses in the background to eliminate
 * perceived latency when users transition between workflow stages.
 * 
 * Strategy:
 * - Monitor user idle time (5+ seconds)
 * - Predict next likely stage based on current stage
 * - Prefetch agent responses in background
 * - Cache results for instant display
 * 
 * Example:
 * - User in Opportunity stage, idle for 5s
 * - Prefetch Target stage analysis
 * - When user clicks "Next", show instantly
 */

import { logger } from '../../lib/logger.js'

import { agentChatService } from './AgentChatService.js'

export type WorkflowStage = 'opportunity' | 'target' | 'realization' | 'expansion';

interface PrefetchConfig {
  enabled: boolean;
  idleThreshold: number; // milliseconds
  cacheExpiry: number; // milliseconds
}

interface PrefetchCache {
  stage: WorkflowStage;
  context: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

class AgentPrefetchService {
  private config: PrefetchConfig = {
    enabled: true,
    idleThreshold: 5000, // 5 seconds
    cacheExpiry: 300000, // 5 minutes
  };

  private cache: Map<string, PrefetchCache> = new Map();
  private prefetchInProgress: Set<string> = new Set();
  private idleTimer: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();

  /**
   * Initialize prefetch service
   */
  initialize() {
    logger.info('Agent prefetch service initialized', { config: this.config });

    // Monitor user activity
    this.setupActivityMonitoring();
  }

  /**
   * Setup activity monitoring
   */
  private setupActivityMonitoring() {
    const resetIdleTimer = () => {
      this.lastActivity = Date.now();
      
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
      }

      this.idleTimer = setTimeout(() => {
        this.onUserIdle();
      }, this.config.idleThreshold);
    };

    // Monitor mouse and keyboard activity
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', resetIdleTimer);
      window.addEventListener('keydown', resetIdleTimer);
      window.addEventListener('click', resetIdleTimer);
      window.addEventListener('scroll', resetIdleTimer);
    }

    // Initial timer
    resetIdleTimer();
  }

  /**
   * Handle user idle state
   */
  private onUserIdle() {
    logger.info('User idle detected, checking for prefetch opportunities');
    // Prefetch logic will be triggered by components via prefetchNextStage
  }

  /**
   * Prefetch next stage
   */
  async prefetchNextStage(
    currentStage: WorkflowStage,
    context: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('Prefetch disabled');
      return;
    }

    const nextStage = this.getNextStage(currentStage);
    if (!nextStage) {
      logger.debug('No next stage to prefetch', { currentStage });
      return;
    }

    const cacheKey = this.getCacheKey(nextStage, context);

    // Check if already prefetching
    if (this.prefetchInProgress.has(cacheKey)) {
      logger.debug('Prefetch already in progress', { nextStage });
      return;
    }

    // Check if cached and not expired
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      logger.debug('Using cached prefetch result', { nextStage });
      return;
    }

    // Start prefetch
    this.prefetchInProgress.add(cacheKey);
    logger.info('Starting prefetch', { currentStage, nextStage });

    try {
      // Prefetch agent response for next stage
      const result = await this.fetchStageData(nextStage, context);

      // Cache result
      this.cache.set(cacheKey, {
        stage: nextStage,
        context,
        result,
        timestamp: Date.now(),
      });

      logger.info('Prefetch completed', { nextStage });
    } catch (error) {
      logger.error('Prefetch failed', { nextStage, error });
    } finally {
      this.prefetchInProgress.delete(cacheKey);
    }
  }

  /**
   * Get prefetched result
   */
  getPrefetchedResult(
    stage: WorkflowStage,
    context: Record<string, unknown>
  ): unknown {
    const cacheKey = this.getCacheKey(stage, context);
    const cached = this.cache.get(cacheKey);

    if (!cached || this.isCacheExpired(cached)) {
      return null;
    }

    logger.info('Using prefetched result', { stage });
    return cached.result;
  }

  /**
   * Fetch stage data (actual agent call)
   */
  private async fetchStageData(
    stage: WorkflowStage,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // This would call the appropriate agent based on stage
    // For now, we'll use a generic approach
    
    const prompt = this.getStagePrompt(stage, context);
    
    // Use agent chat service to get response
    // Note: This is a background call, so we don't want to show UI updates
    const result = await agentChatService.sendMessage(prompt, {
      silent: true, // Don't trigger UI updates
      context,
    });

    return result;
  }

  /**
   * Get prompt for stage
   */
  private getStagePrompt(stage: WorkflowStage, context: Record<string, unknown>): string {
    const company = typeof context['company'] === 'string' ? context['company'] : 'unknown';
    switch (stage) {
      case 'opportunity':
        return `Analyze opportunity for: ${company}`;
      case 'target':
        return `Create target analysis for: ${company}`;
      case 'realization':
        return `Plan realization for: ${company}`;
      case 'expansion':
        return `Identify expansion opportunities for: ${company}`;
      default:
        return '';
    }
  }

  /**
   * Get next stage in workflow
   */
  private getNextStage(currentStage: WorkflowStage): WorkflowStage | null {
    const stageOrder: WorkflowStage[] = [
      'opportunity',
      'target',
      'realization',
      'expansion',
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
      return null;
    }

    return stageOrder[currentIndex + 1];
  }

  /**
   * Generate cache key
   */
  private getCacheKey(stage: WorkflowStage, context: Record<string, unknown>): string {
    // Simple hash of stage + context
    const contextStr = JSON.stringify(context);
    return `${stage}:${contextStr}`;
  }

  /**
   * Check if cache is expired
   */
  private isCacheExpired(cached: PrefetchCache): boolean {
    return Date.now() - cached.timestamp > this.config.cacheExpiry;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Prefetch cache cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PrefetchConfig>) {
    this.config = { ...this.config, ...config };
    logger.info('Prefetch config updated', { config: this.config });
  }
}

export const agentPrefetchService = new AgentPrefetchService();

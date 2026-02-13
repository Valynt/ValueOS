/**
 * Circuit Breaker Manager with Categorization
 *
 * Optimizes circuit breaker management by grouping similar agents
 * and sharing circuit breaker state while maintaining security isolation.
 */

import { logger } from '../lib/logger';
import { AgentType } from './agent-types';
import { CircuitBreakerManager as BaseCircuitBreakerManager } from './CircuitBreaker';

// ============================================================================
// Types
// ============================================================================

export type AgentCategory =
  | 'data-gathering'
  | 'value-analysis'
  | 'communication'
  | 'validation'
  | 'coordination'
  | 'standalone';

export interface CategoryConfig {
  name: AgentCategory;
  agents: AgentType[];
  failureThreshold: number;
  cooldownPeriod: number;
  timeoutMs: number;
  failureRateThreshold: number;
  latencyThresholdMs: number;
  minimumSamples: number;
  description: string;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CircuitBreakerStats {
  category: AgentCategory;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  averageLatency: number;
  failureRate: number;
  requestsInWindow: number;
  windowStartTime: number;
}

export interface CircuitBreakerEvent {
  category: AgentCategory;
  agent: AgentType;
  eventType: 'state_change' | 'failure' | 'success' | 'timeout';
  previousState?: string;
  newState?: string;
  timestamp: number;
  metadata: Record<string, any>;
}

// ============================================================================
// Category Configuration
// ============================================================================

export const AGENT_CATEGORIES: Record<AgentCategory, CategoryConfig> = {
  'data-gathering': {
    name: 'data-gathering',
    agents: ['research', 'benchmark', 'company-intelligence'],
    failureThreshold: 5,
    cooldownPeriod: 60000, // 1 minute
    timeoutMs: 30000, // 30 seconds
    failureRateThreshold: 0.4, // 40% failure rate
    latencyThresholdMs: 5000, // 5 seconds
    minimumSamples: 10,
    description: 'Agents that gather external data and perform research',
    securityLevel: 'medium',
  },

  'value-analysis': {
    name: 'value-analysis',
    agents: ['opportunity', 'target', 'financial-modeling', 'value-mapping'],
    failureThreshold: 3,
    cooldownPeriod: 90000, // 1.5 minutes
    timeoutMs: 45000, // 45 seconds
    failureRateThreshold: 0.3, // 30% failure rate
    latencyThresholdMs: 8000, // 8 seconds
    minimumSamples: 8,
    description: 'Agents that perform financial and value analysis',
    securityLevel: 'high',
  },

  'communication': {
    name: 'communication',
    agents: ['communicator', 'narrative'],
    failureThreshold: 7,
    cooldownPeriod: 30000, // 30 seconds
    timeoutMs: 15000, // 15 seconds
    failureRateThreshold: 0.5, // 50% failure rate
    latencyThresholdMs: 3000, // 3 seconds
    minimumSamples: 15,
    description: 'Agents that generate communications and narratives',
    securityLevel: 'low',
  },

  'validation': {
    name: 'validation',
    agents: ['integrity', 'groundtruth'],
    failureThreshold: 2,
    cooldownPeriod: 120000, // 2 minutes
    timeoutMs: 20000, // 20 seconds
    failureRateThreshold: 0.2, // 20% failure rate
    latencyThresholdMs: 2000, // 2 seconds
    minimumSamples: 5,
    description: 'Agents that perform validation and compliance checks',
    securityLevel: 'critical',
  },

  'coordination': {
    name: 'coordination',
    agents: ['coordinator'],
    failureThreshold: 4,
    cooldownPeriod: 45000, // 45 seconds
    timeoutMs: 25000, // 25 seconds
    failureRateThreshold: 0.35, // 35% failure rate
    latencyThresholdMs: 4000, // 4 seconds
    minimumSamples: 12,
    description: 'Agent that coordinates other agents',
    securityLevel: 'high',
  },

  'standalone': {
    name: 'standalone',
    agents: ['realization', 'expansion', 'system-mapper', 'intervention-designer', 'outcome-engineer', 'value-eval'],
    failureThreshold: 6,
    cooldownPeriod: 75000, // 1.25 minutes
    timeoutMs: 35000, // 35 seconds
    failureRateThreshold: 0.45, // 45% failure rate
    latencyThresholdMs: 6000, // 6 seconds
    minimumSamples: 10,
    description: 'Agents with unique functionality that operate independently',
    securityLevel: 'medium',
  },
};

// ============================================================================
// Categorized Circuit Breaker Manager
// ============================================================================

export class CategorizedCircuitBreakerManager extends BaseCircuitBreakerManager {
  private categoryStats: Map<AgentCategory, CircuitBreakerStats> = new Map();
  private eventHistory: CircuitBreakerEvent[] = [];
  private readonly MAX_EVENT_HISTORY = 1000;

  constructor() {
    super();
    this.initializeCategoryStats();
  }

  /**
   * Execute with category-based circuit breaker
   */
  async executeWithCategory<T>(
    agent: AgentType,
    task: () => Promise<T>,
    category?: AgentCategory
  ): Promise<T> {
    const agentCategory = category || this.getAgentCategory(agent);

    // Log execution attempt
    this.logEvent({
      category: agentCategory,
      agent,
      eventType: 'success', // Will be updated if it fails
      timestamp: Date.now(),
      metadata: { action: 'execute_start' },
    });

    try {
      // Use category-specific configuration
      const categoryConfig = AGENT_CATEGORIES[agentCategory];

      const result = await this.execute(
        `${agentCategory}:${agent}`,
        task,
        {
          timeoutMs: categoryConfig.timeoutMs,
          failureRateThreshold: categoryConfig.failureRateThreshold,
          latencyThresholdMs: categoryConfig.latencyThresholdMs,
          minimumSamples: categoryConfig.minimumSamples,
        }
      );

      // Update success stats
      this.updateCategoryStats(agentCategory, 'success');

      return result;
    } catch (error) {
      // Update failure stats
      this.updateCategoryStats(agentCategory, 'failure');

      // Log failure event
      this.logEvent({
        category: agentCategory,
        agent,
        eventType: 'failure',
        timestamp: Date.now(),
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          action: 'execute_failed'
        },
      });

      throw error;
    }
  }

  /**
   * Get circuit breaker status for an agent category
   */
  getCategoryStatus(category: AgentCategory): CircuitBreakerStats | null {
    const state = this.getState(`${category}:*`);

    if (!state) {
      return null;
    }

    const stats = this.categoryStats.get(category);
    if (!stats) {
      return null;
    }

    // Update state from base circuit breaker
    stats.state = state.state;
    stats.failureCount = state.failure_count;
    stats.lastFailureTime = state.last_failure_time;

    return stats;
  }

  /**
   * Get circuit breaker status for a specific agent
   */
  getAgentStatus(agent: AgentType): CircuitBreakerStats | null {
    const category = this.getAgentCategory(agent);
    const categoryStats = this.getCategoryStatus(category);

    if (!categoryStats) {
      return null;
    }

    // Create agent-specific stats based on category
    return {
      ...categoryStats,
      agent: agent as any, // Not part of the interface but useful for debugging
    };
  }

  /**
   * Reset circuit breaker for a category
   */
  resetCategory(category: AgentCategory): void {
    // Reset all agents in the category
    const categoryConfig = AGENT_CATEGORIES[category];
    categoryConfig.agents.forEach(agent => {
      this.reset(`${category}:${agent}`);
    });

    // Reset category stats
    const stats = this.categoryStats.get(category);
    if (stats) {
      stats.state = 'closed';
      stats.failureCount = 0;
      stats.successCount = 0;
      stats.lastFailureTime = null;
      stats.lastSuccessTime = null;
      stats.averageLatency = 0;
      stats.failureRate = 0;
      stats.requestsInWindow = 0;
      stats.windowStartTime = Date.now();
    }

    // Log reset event
    this.logEvent({
      category,
      agent: 'all' as AgentType,
      eventType: 'state_change',
      previousState: 'open',
      newState: 'closed',
      timestamp: Date.now(),
      metadata: { action: 'category_reset' },
    });

    logger.info('Circuit breaker reset for category', { category });
  }

  /**
   * Reset circuit breaker for a specific agent
   */
  resetAgent(agent: AgentType): void {
    const category = this.getAgentCategory(agent);
    this.reset(`${category}:${agent}`);

    // Log reset event
    this.logEvent({
      category,
      agent,
      eventType: 'state_change',
      previousState: 'open',
      newState: 'closed',
      timestamp: Date.now(),
      metadata: { action: 'agent_reset' },
    });

    logger.info('Circuit breaker reset for agent', { agent, category });
  }

  /**
   * Get all category statistics
   */
  getAllCategoryStats(): Record<AgentCategory, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [category, categoryStats] of this.categoryStats.entries()) {
      // Update with current state
      const currentState = this.getState(`${category}:*`);
      if (currentState) {
        categoryStats.state = currentState.state;
        categoryStats.failureCount = currentState.failure_count;
        categoryStats.lastFailureTime = currentState.last_failure_time;
      }

      stats[category] = categoryStats;
    }

    return stats as Record<AgentCategory, CircuitBreakerStats>;
  }

  /**
   * Get recent events for monitoring
   */
  getRecentEvents(limit: number = 50, category?: AgentCategory): CircuitBreakerEvent[] {
    let events = this.eventHistory;

    // Filter by category if specified
    if (category) {
      events = events.filter(event => event.category === category);
    }

    // Sort by timestamp (newest first) and limit
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get performance metrics for optimization
   */
  getPerformanceMetrics(): {
    totalRequests: number;
    totalFailures: number;
    averageFailureRate: number;
    categoryPerformance: Record<AgentCategory, {
      requests: number;
      failures: number;
      failureRate: number;
      averageLatency: number;
      reliability: number;
    }>;
  } {
    const categoryPerformance: Record<string, any> = {};
    let totalRequests = 0;
    let totalFailures = 0;

    for (const [category, stats] of this.categoryStats.entries()) {
      const requests = stats.successCount + stats.failureCount;
      const failures = stats.failureCount;
      const failureRate = requests > 0 ? failures / requests : 0;
      const reliability = 1 - failureRate;

      totalRequests += requests;
      totalFailures += failures;

      categoryPerformance[category] = {
        requests,
        failures,
        failureRate,
        averageLatency: stats.averageLatency,
        reliability,
      };
    }

    return {
      totalRequests,
      totalFailures,
      averageFailureRate: totalRequests > 0 ? totalFailures / totalRequests : 0,
      categoryPerformance: categoryPerformance as Record<AgentCategory, any>,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize category statistics
   */
  private initializeCategoryStats(): void {
    for (const [category, _config] of Object.entries(AGENT_CATEGORIES)) {
      this.categoryStats.set(category as AgentCategory, {
        category: category as AgentCategory,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        averageLatency: 0,
        failureRate: 0,
        requestsInWindow: 0,
        windowStartTime: Date.now(),
      });
    }
  }

  /**
   * Get category for an agent
   */
  private getAgentCategory(agent: AgentType): AgentCategory {
    for (const [category, config] of Object.entries(AGENT_CATEGORIES)) {
      if (config.agents.includes(agent)) {
        return category as AgentCategory;
      }
    }
    return 'standalone';
  }

  /**
   * Update category statistics
   */
  private updateCategoryStats(category: AgentCategory, result: 'success' | 'failure'): void {
    const stats = this.categoryStats.get(category);
    if (!stats) return;

    if (result === 'success') {
      stats.successCount++;
      stats.lastSuccessTime = new Date().toISOString();
    } else {
      stats.failureCount++;
      stats.lastFailureTime = new Date().toISOString();
    }

    // Update failure rate
    const totalRequests = stats.successCount + stats.failureCount;
    stats.failureRate = totalRequests > 0 ? stats.failureCount / totalRequests : 0;

    // Update requests in window
    stats.requestsInWindow++;
  }

  /**
   * Log circuit breaker event
   */
  private logEvent(event: CircuitBreakerEvent): void {
    this.eventHistory.push(event);

    // Trim history if too large
    if (this.eventHistory.length > this.MAX_EVENT_HISTORY) {
      this.eventHistory = this.eventHistory.slice(-this.MAX_EVENT_HISTORY);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let categorizedCircuitBreakerInstance: CategorizedCircuitBreakerManager | null = null;

export function getCategorizedCircuitBreakerManager(): CategorizedCircuitBreakerManager {
  if (!categorizedCircuitBreakerInstance) {
    categorizedCircuitBreakerInstance = new CategorizedCircuitBreakerManager();
  }
  return categorizedCircuitBreakerInstance;
}

export function resetCategorizedCircuitBreakerManager(): void {
  categorizedCircuitBreakerInstance = null;
}

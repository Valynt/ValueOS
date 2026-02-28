/**
 * Enhanced Parallel Executor
 *
 * Optimizes parallel execution patterns for agent workflows while
 * maintaining security boundaries and dependency management.
 */

import { randomUUID } from 'crypto';

import { logger } from '../lib/logger';

import { AgentType } from './agent-types';
import { getCategorizedCircuitBreakerManager } from './CircuitBreakerManager';
import { getContextOptimizer } from './ContextOptimizer';
import { getSecureSharedContext } from './SecureSharedContext';
import { getUnifiedAgentAPI } from './UnifiedAgentAPI';

// ============================================================================
// Types
// ============================================================================

export interface ParallelTask {
  id: string;
  agentType: AgentType;
  query: string;
  context?: Record<string, any>;
  parameters?: Record<string, any>;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  estimatedDuration: number;
  timeoutMs: number;
  retryConfig: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
  };
}

export interface ParallelGroup {
  id: string;
  name: string;
  tasks: ParallelTask[];
  executionStrategy: 'parallel' | 'sequential' | 'pipeline';
  maxConcurrency: number;
  estimatedDuration: number;
  dependencies: string[];
}

export interface ParallelExecutionPlan {
  planId: string;
  groups: ParallelGroup[];
  executionOrder: string[][];
  totalEstimatedDuration: number;
  maxConcurrency: number;
  resourceRequirements: ResourceRequirements;
  riskAssessment: RiskAssessment;
}

export interface ResourceRequirements {
  maxConcurrentAgents: number;
  memoryRequirement: 'low' | 'medium' | 'high' | 'critical';
  tokenRequirement: number;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskAssessment {
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  failureProbability: number;
  dataSensitivity: 'low' | 'medium' | 'high' | 'critical';
  complianceRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface TaskResult {
  taskId: string;
  agentType: AgentType;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  warnings?: string[];
}

export interface ParallelExecutionResult {
  planId: string;
  success: boolean;
  results: TaskResult[];
  totalDuration: number;
  totalTokens: number;
  executedGroups: string[];
  failedGroups: string[];
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  parallelismEfficiency: number;
  resourceUtilization: number;
  averageTaskDuration: number;
  longestTaskDuration: number;
  shortestTaskDuration: number;
  throughput: number; // tasks per second
}

// ============================================================================
// Enhanced Parallel Executor Implementation
// ============================================================================

export class EnhancedParallelExecutor {
  private agentAPI = getUnifiedAgentAPI();
  private circuitBreakerManager = getCategorizedCircuitBreakerManager();
  private sharedContext = getSecureSharedContext();
  private contextOptimizer = getContextOptimizer();

  private readonly DEFAULT_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_CONCURRENCY = 10;

  /**
   * Execute parallel plan with optimization
   */
  async executeParallelPlan(plan: ParallelExecutionPlan): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const executedGroups: string[] = [];
    const failedGroups: string[] = [];
    const allResults: TaskResult[] = [];

    logger.info('Starting parallel execution', {
      planId: plan.planId,
      groupCount: plan.groups.length,
      estimatedDuration: plan.totalEstimatedDuration,
      maxConcurrency: plan.maxConcurrency,
    });

    try {
      // Execute groups in order
      for (const groupId of plan.executionOrder.flat()) {
        const group = plan.groups.find(g => g.id === groupId);
        if (!group) {
          logger.warn('Group not found in plan', { groupId });
          continue;
        }

        // Check dependencies
        if (!this.areDependenciesMet(group.dependencies, executedGroups)) {
          logger.warn('Dependencies not met for group', { groupId, dependencies: group.dependencies, executedGroups });
          failedGroups.push(groupId);
          continue;
        }

        // Execute group
        const groupResult = await this.executeGroup(group, plan);

        if (groupResult.success) {
          executedGroups.push(groupId);
          allResults.push(...groupResult.results);
        } else {
          failedGroups.push(groupId);
          allResults.push(...groupResult.results);
        }
      }

      const totalDuration = Date.now() - startTime;
      const totalTokens = allResults.reduce((sum, result) => sum + (result.tokens?.total || 0), 0);

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(plan, allResults, totalDuration);

      const result: ParallelExecutionResult = {
        planId: plan.planId,
        success: failedGroups.length === 0,
        results: allResults,
        totalDuration,
        totalTokens,
        executedGroups,
        failedGroups,
        performance,
      };

      logger.info('Parallel execution completed', {
        planId: result.planId,
        success: result.success,
        totalDuration: result.totalDuration,
        totalTokens: result.totalTokens,
        parallelismEfficiency: performance.parallelismEfficiency,
      });

      return result;
    } catch (error) {
      logger.error('Parallel execution failed', error instanceof Error ? error : undefined, {
        planId: plan.planId,
      });

      return {
        planId: plan.planId,
        success: false,
        results: allResults,
        totalDuration: Date.now() - startTime,
        totalTokens: 0,
        executedGroups,
        failedGroups: plan.executionOrder.flat(),
        performance: {
          parallelismEfficiency: 0,
          resourceUtilization: 0,
          averageTaskDuration: 0,
          longestTaskDuration: 0,
          shortestTaskDuration: 0,
          throughput: 0,
        },
      };
    }
  }

  /**
   * Execute a single group of tasks
   */
  private async executeGroup(group: ParallelGroup, plan: ParallelExecutionPlan): Promise<{ success: boolean; results: TaskResult[] }> {
    const startTime = Date.now();
    const results: TaskResult[] = [];

    logger.debug('Executing group', {
      groupId: group.id,
      taskCount: group.tasks.length,
      strategy: group.executionStrategy,
      maxConcurrency: group.maxConcurrency,
    });

    try {
      switch (group.executionStrategy) {
        case 'parallel':
          results.push(...await this.executeParallelTasks(group.tasks, group.maxConcurrency));
          break;
        case 'sequential':
          results.push(...await this.executeSequentialTasks(group.tasks));
          break;
        case 'pipeline':
          results.push(...await this.executePipelineTasks(group.tasks));
          break;
        default:
          throw new Error(`Unknown execution strategy: ${group.executionStrategy}`);
      }

      const success = results.every(result => result.success);
      const duration = Date.now() - startTime;

      logger.debug('Group execution completed', {
        groupId: group.id,
        success,
        duration,
        taskResults: results.length,
      });

      return { success, results };
    } catch (error) {
      logger.error('Group execution failed', error instanceof Error ? error : undefined, {
        groupId: group.id,
      });

      return { success: false, results };
    }
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallelTasks(tasks: ParallelTask[], maxConcurrency: number): Promise<TaskResult[]> {
    const concurrency = Math.min(maxConcurrency, this.MAX_CONCURRENCY);
    const results: TaskResult[] = [];

    // Create execution batches
    const batches = this.createBatches(tasks, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(task => this.executeTask(task))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const task = batch.find(t => t.id === (result.reason as any).taskId);
          results.push({
            taskId: task?.id || 'unknown',
            agentType: task?.agentType || 'unknown',
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            duration: 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequentialTasks(tasks: ParallelTask[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      try {
        const result = await this.executeTask(task);
        results.push(result);

        // Stop sequential execution if a critical task fails
        if (!result.success && task.priority === 'critical') {
          logger.warn('Critical task failed, stopping sequential execution', {
            taskId: task.id,
            error: result.error,
          });
          break;
        }
      } catch (error) {
        results.push({
          taskId: task.id,
          agentType: task.agentType,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
        });
      }
    }

    return results;
  }

  /**
   * Execute tasks as a pipeline
   */
  private async executePipelineTasks(tasks: ParallelTask[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    let contextData: Record<string, any> = {};

    for (const task of tasks) {
      try {
        // Add previous results to context
        const taskContext = {
          ...task.context,
          pipelineResults: contextData,
        };

        const result = await this.executeTask({
          ...task,
          context: taskContext,
        });

        results.push(result);

        // Store result for next task
        if (result.success && result.result) {
          contextData[task.id] = result.result;
        }

        // Stop pipeline if a critical task fails
        if (!result.success && task.priority === 'critical') {
          logger.warn('Critical task failed, stopping pipeline', {
            taskId: task.id,
            error: result.error,
          });
          break;
        }
      } catch (error) {
        results.push({
          taskId: task.id,
          agentType: task.agentType,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
        });
      }
    }

    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: ParallelTask): Promise<TaskResult> {
    const startTime = Date.now();
    const taskId = task.id;

    logger.debug('Executing task', {
      taskId,
      agentType: task.agentType,
      priority: task.priority,
      estimatedDuration: task.estimatedDuration,
    });

    try {
      // Optimize context if needed
      let optimizedContext = task.context;
      if (task.context && this.estimateTokens(JSON.stringify(task.context)) > 2000) {
        const optimization = await this.contextOptimizer.optimizeContext(
          task.agentType,
          taskId,
          JSON.stringify(task.context)
        );
        optimizedContext = JSON.parse(optimization.retainedContent);
      }

      // Execute with circuit breaker protection
      const result = await this.circuitBreakerManager.executeWithCategory(
        task.agentType,
        async () => {
          return await this.agentAPI.invoke({
            agent: task.agentType,
            query: task.query,
            context: optimizedContext,
            parameters: task.parameters,
            sessionId: taskId,
          });
        }
      );

      const duration = Date.now() - startTime;

      return {
        taskId,
        agentType: task.agentType,
        success: result.success,
        result: result.data,
        error: result.error,
        duration,
        tokens: result.metadata?.tokens,
        warnings: result.warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        taskId,
        agentType: task.agentType,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  /**
   * Create execution batches for parallel processing
   */
  private createBatches(tasks: ParallelTask[], batchSize: number): ParallelTask[][] {
    const batches: ParallelTask[][] = [];

    // Sort by priority (critical first)
    const sortedTasks = [...tasks].sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (let i = 0; i < sortedTasks.length; i += batchSize) {
      batches.push(sortedTasks.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Check if dependencies are met
   */
  private areDependenciesMet(dependencies: string[], executedGroups: string[]): boolean {
    return dependencies.every(dep => executedGroups.includes(dep));
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    plan: ParallelExecutionPlan,
    results: TaskResult[],
    totalDuration: number
  ): PerformanceMetrics {
    const successfulResults = results.filter(r => r.success);
    const durations = successfulResults.map(r => r.duration);

    const averageTaskDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const longestTaskDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const shortestTaskDuration = durations.length > 0 ? Math.min(...durations) : 0;

    // Calculate parallelism efficiency
    const theoreticalSequentialDuration = plan.groups.reduce((sum, group) =>
      sum + group.estimatedDuration, 0
    );
    const parallelismEfficiency = theoreticalSequentialDuration > 0
      ? theoreticalSequentialDuration / totalDuration
      : 1;

    // Calculate resource utilization
    const maxPossibleConcurrency = plan.groups.reduce((max, group) =>
      Math.max(max, group.maxConcurrency), 0
    );
    const actualConcurrency = plan.groups.reduce((sum, group) =>
      sum + (group.executionStrategy === 'parallel' ? group.tasks.length : 1), 0
    );
    const resourceUtilization = maxPossibleConcurrency > 0
      ? actualConcurrency / maxPossibleConcurrency
      : 0;

    // Calculate throughput
    const throughput = totalDuration > 0 ? successfulResults.length / (totalDuration / 1000) : 0;

    return {
      parallelismEfficiency: Math.min(parallelismEfficiency, 1.0),
      resourceUtilization: Math.min(resourceUtilization, 1.0),
      averageTaskDuration,
      longestTaskDuration,
      shortestTaskDuration,
      throughput,
    };
  }

  /**
   * Estimate token count for content
   */
  private estimateTokens(content: string): number {
    // Rough estimation: ~1 token per 4 characters
    return Math.ceil(content.length / 4);
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    circuitBreakerStats: any;
    contextStats: any;
    sharedContextStats: any;
  } {
    return {
      circuitBreakerStats: this.circuitBreakerManager.getAllCategoryStats(),
      contextStats: this.contextOptimizer.getOptimizationStats(),
      sharedContextStats: this.sharedContext.getContextStats(),
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createParallelTask(
  agentType: AgentType,
  query: string,
  options: Partial<ParallelTask> = {}
): ParallelTask {
  return {
    id: randomUUID(),
    agentType,
    query,
    priority: 'medium',
    dependencies: [],
    estimatedDuration: 30000, // 30 seconds default
    timeoutMs: 60000, // 60 seconds default
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    },
    ...options,
  };
}

export function createParallelGroup(
  name: string,
  tasks: ParallelTask[],
  options: Partial<ParallelGroup> = {}
): ParallelGroup {
  return {
    id: randomUUID(),
    name,
    tasks,
    executionStrategy: 'parallel',
    maxConcurrency: 5,
    estimatedDuration: tasks.reduce((sum, task) => sum + task.estimatedDuration, 0),
    dependencies: [],
    ...options,
  };
}

export function createParallelExecutionPlan(
  groups: ParallelGroup[],
  options: Partial<ParallelExecutionPlan> = {}
): ParallelExecutionPlan {
  // Determine execution order based on dependencies
  const executionOrder = calculateExecutionOrder(groups);

  return {
    planId: randomUUID(),
    groups,
    executionOrder,
    totalEstimatedDuration: groups.reduce((sum, group) => sum + group.estimatedDuration, 0),
    maxConcurrency: Math.max(...groups.map(g => g.maxConcurrency)),
    resourceRequirements: {
      maxConcurrentAgents: Math.max(...groups.map(g => g.tasks.length)),
      memoryRequirement: 'medium',
      tokenRequirement: groups.reduce((sum, group) =>
        sum + group.tasks.reduce((taskSum, _task) => taskSum + 1000, 0), 0
      ),
      securityLevel: 'medium',
    },
    riskAssessment: {
      complexity: 'moderate',
      failureProbability: 0.1,
      dataSensitivity: 'medium',
      complianceRisk: 'low',
      recommendations: [],
    },
    ...options,
  };
}

function calculateExecutionOrder(groups: ParallelGroup[]): string[][] {
  const order: string[][] = [];
  const processed = new Set<string>();
  const remaining = new Set(groups.map(g => g.id));

  while (remaining.size > 0) {
    const currentBatch: string[] = [];

    for (const groupId of remaining) {
      const group = groups.find(g => g.id === groupId);
      if (!group) continue;

      // Check if all dependencies are met
      const depsMet = group.dependencies.every(dep => processed.has(dep));

      if (depsMet) {
        currentBatch.push(groupId);
        processed.add(groupId);
        remaining.delete(groupId);
      }
    }

    if (currentBatch.length > 0) {
      order.push(currentBatch);
    } else {
      // Circular dependency - break by adding remaining groups
      logger.warn('Circular dependency detected, breaking cycle');
      order.push(Array.from(remaining));
      remaining.clear();
    }
  }

  return order;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let enhancedParallelExecutorInstance: EnhancedParallelExecutor | null = null;

export function getEnhancedParallelExecutor(): EnhancedParallelExecutor {
  if (!enhancedParallelExecutorInstance) {
    enhancedParallelExecutorInstance = new EnhancedParallelExecutor();
  }
  return enhancedParallelExecutorInstance;
}

export function resetEnhancedParallelExecutor(): void {
  enhancedParallelExecutorInstance = null;
}

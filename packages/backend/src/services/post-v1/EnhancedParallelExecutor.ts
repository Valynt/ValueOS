/**
 * Enhanced Parallel Executor
 *
 * Optimizes parallel execution patterns for agent workflows while
 * maintaining security boundaries and dependency management.
 */

import { randomUUID } from "crypto";

import { logger } from "../../lib/logger.js";

import { AgentType } from "./agent-types.js";
import { getCategorizedCircuitBreakerManager } from "./CircuitBreakerManager.js";
import { getContextOptimizer } from "./ContextOptimizer.js";
import {
  getSystemResourceMonitor,
  ResourceListener,
  SystemResources,
} from "./monitoring/SystemResourceMonitor.js";
import { getSecureSharedContext } from "./SecureSharedContext.js";
import { getUnifiedAgentAPI } from "./UnifiedAgentAPI.js";

// ============================================================================
// Utility Classes
// ============================================================================

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// ============================================================================
// Types
// ============================================================================

export type ParallelPriority = "critical" | "high" | "medium" | "low";

export interface ParallelTask {
  id: string;
  agentType: AgentType;
  query: string;
  context?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  priority: ParallelPriority;
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
  executionStrategy: "parallel" | "sequential" | "pipeline";
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
  memoryRequirement: "low" | "medium" | "high" | "critical";
  tokenRequirement: number;
  securityLevel: "low" | "medium" | "high" | "critical";
}

export interface RiskAssessment {
  complexity: "simple" | "moderate" | "complex" | "enterprise";
  failureProbability: number;
  dataSensitivity: "low" | "medium" | "high" | "critical";
  complianceRisk: "low" | "medium" | "high" | "critical";
  recommendations: string[];
}

export interface TaskResult {
  taskId: string;
  agentType: AgentType;
  success: boolean;
  result?: unknown;
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

export interface RunnableTask<TPayload> {
  id: string;
  payload: TPayload;
  priority: ParallelPriority;
}

export interface RunnableTaskResult<TResult> {
  taskId: string;
  success: boolean;
  result?: TResult;
  error?: string;
  duration: number;
}

// ============================================================================
// Enhanced Parallel Executor Implementation
// ============================================================================

export class EnhancedParallelExecutor implements ResourceListener {
  private agentAPI = getUnifiedAgentAPI();
  private circuitBreakerManager = getCategorizedCircuitBreakerManager();
  private sharedContext = getSecureSharedContext();
  private contextOptimizer = getContextOptimizer();
  private resourceMonitor = getSystemResourceMonitor();

  private readonly DEFAULT_TIMEOUT = 60000; // 60 seconds
  private baseMaxConcurrency = 10;
  private currentMaxConcurrency = 10;
  private resourceScalingEnabled = true;
  private currentPlan: ParallelExecutionPlan | null = null;

  constructor(
    baseConcurrency: number = 10,
    enableResourceScaling: boolean = true
  ) {
    this.baseMaxConcurrency = baseConcurrency;
    this.currentMaxConcurrency = baseConcurrency;
    this.resourceScalingEnabled = enableResourceScaling;

    // Register for resource monitoring
    if (enableResourceScaling) {
      this.resourceMonitor.addListener(this);
      this.resourceMonitor.startMonitoring();
    }
  }

  /**
   * Handle resource changes for dynamic scaling
   */
  onResourceChange(resources: SystemResources): void {
    if (!this.resourceScalingEnabled) return;

    const newConcurrency = this.resourceMonitor.getOptimalConcurrency(
      this.baseMaxConcurrency
    );

    if (newConcurrency !== this.currentMaxConcurrency) {
      logger.info("Adjusting concurrency based on system resources", {
        oldConcurrency: this.currentMaxConcurrency,
        newConcurrency,
        cpuUsage: resources.cpu.usage,
        memoryUsage: resources.memory.percentage,
        heapUsage: resources.heap.percentage,
        pressure: resources.memory.pressure,
      });

      this.currentMaxConcurrency = newConcurrency;
    }
  }

  /**
   * Execute parallel plan with optimization
   */
  async executeParallelPlan(
    plan: ParallelExecutionPlan
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    this.currentPlan = plan; // Store current plan for runnable task lookup
    const executedTasks: Set<string> = new Set();
    const failedTasks: Set<string> = new Set();
    const allResults: TaskResult[] = [];
    const taskDependencies: Map<string, string[]> = new Map();
    const taskResults: Map<string, TaskResult> = new Map();

    // Build dependency map
    for (const group of plan.groups) {
      for (const task of group.tasks) {
        taskDependencies.set(task.id, task.dependencies);
      }
    }

    logger.info("Starting DAG-based parallel execution", {
      planId: plan.planId,
      totalTasks: Array.from(taskDependencies.keys()).length,
      estimatedDuration: plan.totalEstimatedDuration,
      maxConcurrency: plan.maxConcurrency,
    });

    try {
      // Execute tasks in DAG order
      while (executedTasks.size + failedTasks.size < taskDependencies.size) {
        // Find tasks with zero dependencies (runnable tasks)
        const runnableTasks = this.findRunnableTasks(
          taskDependencies,
          executedTasks,
          failedTasks
        );

        if (runnableTasks.length === 0) {
          // Check for circular dependencies or stuck execution
          if (executedTasks.size + failedTasks.size < taskDependencies.size) {
            logger.error("Execution stuck - possible circular dependencies", {
              executed: Array.from(executedTasks),
              failed: Array.from(failedTasks),
              remaining: Array.from(taskDependencies.keys()).filter(
                id => !executedTasks.has(id) && !failedTasks.has(id)
              ),
            });
            break;
          }
          break;
        }

        // Execute runnable tasks concurrently
        const batchResults = await this.executeRunnableTasks(
          runnableTasks,
          plan.maxConcurrency
        );

        // Process results
        for (const result of batchResults) {
          taskResults.set(result.taskId, result);
          allResults.push(result);

          if (result.success) {
            executedTasks.add(result.taskId);
          } else {
            failedTasks.add(result.taskId);
          }
        }

        // Stream thinking updates to UI (single stream)
        await this.streamThinkingUpdate(
          executedTasks,
          failedTasks,
          taskResults
        );
      }

      const totalDuration = Date.now() - startTime;
      const totalTokens = allResults.reduce(
        (sum, result) => sum + (result.tokens?.total || 0),
        0
      );

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(
        plan,
        allResults,
        totalDuration
      );

      const result: ParallelExecutionResult = {
        planId: plan.planId,
        success: failedTasks.size === 0,
        results: allResults,
        totalDuration,
        totalTokens,
        executedGroups: [], // Not applicable for DAG execution
        failedGroups: [], // Not applicable for DAG execution
        performance,
      };

      logger.info("DAG parallel execution completed", {
        planId: result.planId,
        success: result.success,
        totalDuration: result.totalDuration,
        totalTokens: result.totalTokens,
        executedTasks: executedTasks.size,
        failedTasks: failedTasks.size,
        parallelismEfficiency: performance.parallelismEfficiency,
      });

      return result;
    } catch (error) {
      logger.error(
        "DAG parallel execution failed",
        error instanceof Error ? error : undefined,
        {
          planId: plan.planId,
        }
      );

      return {
        planId: plan.planId,
        success: false,
        results: allResults,
        totalDuration: Date.now() - startTime,
        totalTokens: allResults.reduce(
          (sum, result) => sum + (result.tokens?.total || 0),
          0
        ),
        executedGroups: [],
        failedGroups: [],
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
   * Execute runnable tasks with concurrency and priority ordering.
   */
  async executeRunnableTasks<TPayload, TResult>(
    tasks: RunnableTask<TPayload>[],
    runner: (task: RunnableTask<TPayload>) => Promise<TResult>,
    maxConcurrency: number
  ): Promise<RunnableTaskResult<TResult>[]> {
    const concurrency = Math.min(maxConcurrency, this.currentMaxConcurrency);
    const results: RunnableTaskResult<TResult>[] = [];
    const batches = this.createPriorityBatches(tasks, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async task => {
          const startTime = Date.now();
          try {
            const result = await runner(task);
            return {
              taskId: task.id,
              success: true,
              result,
              duration: Date.now() - startTime,
            };
          } catch (error) {
            return {
              taskId: task.id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
              duration: Date.now() - startTime,
            };
          }
        })
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute a single group of tasks
   */
  private async executeGroup(
    group: ParallelGroup,
    plan: ParallelExecutionPlan
  ): Promise<{ success: boolean; results: TaskResult[] }> {
    const startTime = Date.now();
    const results: TaskResult[] = [];

    logger.debug("Executing group", {
      groupId: group.id,
      taskCount: group.tasks.length,
      strategy: group.executionStrategy,
      maxConcurrency: group.maxConcurrency,
    });

    try {
      switch (group.executionStrategy) {
        case "parallel":
          results.push(
            ...(await this.executeParallelTasks(
              group.tasks,
              group.maxConcurrency
            ))
          );
          break;
        case "sequential":
          results.push(...(await this.executeSequentialTasks(group.tasks)));
          break;
        case "pipeline":
          results.push(...(await this.executePipelineTasks(group.tasks)));
          break;
        default:
          throw new Error(
            `Unknown execution strategy: ${group.executionStrategy}`
          );
      }

      const success = results.every(result => result.success);
      const duration = Date.now() - startTime;

      logger.debug("Group execution completed", {
        groupId: group.id,
        success,
        duration,
        taskResults: results.length,
      });

      return { success, results };
    } catch (error) {
      logger.error(
        "Group execution failed",
        error instanceof Error ? error : undefined,
        {
          groupId: group.id,
        }
      );

      return { success: false, results };
    }
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallelTasks(
    tasks: ParallelTask[],
    maxConcurrency: number
  ): Promise<TaskResult[]> {
    const concurrency = Math.min(maxConcurrency, this.currentMaxConcurrency);
    const results: TaskResult[] = [];

    // Create execution batches
    const batches = this.createBatches(tasks, concurrency);

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(task => this.executeTask(task))
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          let task;
          if (
            typeof result.reason === "object" &&
            result.reason !== null &&
            "taskId" in result.reason
          ) {
            const maybeReason = result.reason as { taskId?: unknown };
            if (typeof maybeReason.taskId === "string") {
              task = batch.find(t => t.id === maybeReason.taskId);
            }
          }
          const agentType =
            task?.agentType &&
            Object.values(AgentType).includes(task.agentType as AgentType)
              ? (task.agentType as AgentType)
              : "coordinator"; // Default to coordinator instead of unknown
          results.push({
            taskId: task?.id || "unknown",
            agentType,
            success: false,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
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
  private async executeSequentialTasks(
    tasks: ParallelTask[]
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      try {
        const result = await this.executeTask(task);
        results.push(result);

        // Stop sequential execution if a critical task fails
        if (!result.success && task.priority === "critical") {
          logger.warn("Critical task failed, stopping sequential execution", {
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
  private async executePipelineTasks(
    tasks: ParallelTask[]
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const contextData: Record<string, unknown> = {};

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
        if (!result.success && task.priority === "critical") {
          logger.warn("Critical task failed, stopping pipeline", {
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

    logger.debug("Executing task", {
      taskId,
      agentType: task.agentType,
      priority: task.priority,
      estimatedDuration: task.estimatedDuration,
    });

    try {
      // Optimize context if needed
      let optimizedContext = task.context;
      if (
        task.context &&
        this.estimateTokens(JSON.stringify(task.context)) > 2000
      ) {
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
  private createBatches(
    tasks: ParallelTask[],
    batchSize: number
  ): ParallelTask[][] {
    return this.createPriorityBatches(tasks, batchSize);
  }

  private createPriorityBatches<TTask extends { priority: ParallelPriority }>(
    tasks: TTask[],
    batchSize: number
  ): TTask[][] {
    const batches: TTask[][] = [];
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const sortedTasks = [...tasks].sort((a, b) => {
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
  private areDependenciesMet(
    dependencies: string[],
    executedGroups: string[]
  ): boolean {
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

    const averageTaskDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    const longestTaskDuration =
      durations.length > 0 ? Math.max(...durations) : 0;
    const shortestTaskDuration =
      durations.length > 0 ? Math.min(...durations) : 0;

    // Calculate parallelism efficiency
    const theoreticalSequentialDuration = plan.groups.reduce(
      (sum, group) => sum + group.estimatedDuration,
      0
    );
    const parallelismEfficiency =
      theoreticalSequentialDuration > 0
        ? theoreticalSequentialDuration / totalDuration
        : 1;

    // Calculate resource utilization
    const maxPossibleConcurrency = plan.groups.reduce(
      (max, group) => Math.max(max, group.maxConcurrency),
      0
    );
    const actualConcurrency = plan.groups.reduce(
      (sum, group) =>
        sum + (group.executionStrategy === "parallel" ? group.tasks.length : 1),
      0
    );
    const resourceUtilization =
      maxPossibleConcurrency > 0
        ? actualConcurrency / maxPossibleConcurrency
        : 0;

    // Calculate throughput
    const throughput =
      totalDuration > 0 ? successfulResults.length / (totalDuration / 1000) : 0;

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
   * Find tasks with zero dependencies that can be executed
   */
  private findRunnableTasks(
    taskDependencies: Map<string, string[]>,
    executedTasks: Set<string>,
    failedTasks: Set<string>
  ): ParallelTask[] {
    const runnableTasks: ParallelTask[] = [];

    for (const [taskId, dependencies] of taskDependencies) {
      if (executedTasks.has(taskId) || failedTasks.has(taskId)) continue;

      // Check if all dependencies are met
      const unmetDependencies = dependencies.filter(
        dep => !executedTasks.has(dep)
      );
      if (unmetDependencies.length === 0) {
        // Find the task in the plan (need to store current plan)
        for (const group of this.currentPlan?.groups || []) {
          const task = group.tasks.find(t => t.id === taskId);
          if (task) {
            runnableTasks.push(task);
            break;
          }
        }
      }
    }

    return runnableTasks;
  }

  /**
   * Execute runnable tasks concurrently
   */
   
  private async executeRunnableTasks(
    tasks: ParallelTask[],
    maxConcurrency: number
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const semaphore = new Semaphore(maxConcurrency);

    const executePromises = tasks.map(async task => {
      await semaphore.acquire();
      try {
        const result = await this.executeTask(task);
        results.push(result);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(executePromises);
    return results;
  }

  /**
   * Stream thinking updates to UI
   */
  private async streamThinkingUpdate(
    executedTasks: Set<string>,
    failedTasks: Set<string>,
    taskResults: Map<string, TaskResult>
  ): Promise<void> {
    // Placeholder for streaming thinking updates to UI
    // This would integrate with WebSocket or similar to send real-time updates
    const progress = {
      executed: executedTasks.size,
      failed: failedTasks.size,
      total:
        executedTasks.size +
        failedTasks.size +
        (this.currentPlan?.groups.reduce((sum, g) => sum + g.tasks.length, 0) ||
          0) -
        executedTasks.size -
        failedTasks.size,
      latestResults: Array.from(taskResults.values()).slice(-5), // Last 5 results
    };

    logger.debug("Streaming thinking update", progress);

    // Progress is observable via the SSE stream on the agent invoke endpoint.
    // A separate WebSocket channel is not needed — SSE covers the streaming requirement.
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    circuitBreakerStats: unknown;
    contextStats: unknown;
    sharedContextStats: unknown;
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
    priority: "medium",
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
    executionStrategy: "parallel",
    maxConcurrency: 5,
    estimatedDuration: tasks.reduce(
      (sum, task) => sum + task.estimatedDuration,
      0
    ),
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
    totalEstimatedDuration: groups.reduce(
      (sum, group) => sum + group.estimatedDuration,
      0
    ),
    maxConcurrency: Math.max(...groups.map(g => g.maxConcurrency)),
    resourceRequirements: {
      maxConcurrentAgents: Math.max(...groups.map(g => g.tasks.length)),
      memoryRequirement: "medium",
      tokenRequirement: groups.reduce(
        (sum, group) =>
          sum + group.tasks.reduce((taskSum, _task) => taskSum + 1000, 0),
        0
      ),
      securityLevel: "medium",
    },
    riskAssessment: {
      complexity: "moderate",
      failureProbability: 0.1,
      dataSensitivity: "medium",
      complianceRisk: "low",
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
      logger.warn("Circular dependency detected, breaking cycle");
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

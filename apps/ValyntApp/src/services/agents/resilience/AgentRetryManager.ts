/**
 * Agent Retry Manager
 *
 * CONSOLIDATION: Intelligent retry and fallback mechanisms for agent operations
 *
 * Provides sophisticated retry strategies with exponential backoff, circuit breaker
 * integration, and intelligent fallback agent selection for resilient agent operations.
 */

import { AgentRequest, AgentResponse, IAgent } from "../core/IAgent";
import { AgentType } from "../../agent-types";
import { logger } from "../../../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { agentTelemetryService } from "../telemetry/AgentTelemetryService";

// ============================================================================
// Retry Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Retry strategy */
  strategy: RetryStrategy;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor */
  jitterFactor: number;
  /** Retryable error types */
  retryableErrors: string[];
  /** Non-retryable error types */
  nonRetryableErrors: string[];
  /** Fallback agent types */
  fallbackAgents: AgentType[];
  /** Fallback strategy */
  fallbackStrategy: FallbackStrategy;
  /** Timeout per attempt */
  attemptTimeout: number;
  /** Overall timeout */
  overallTimeout: number;
  /** Retry context */
  context?: RetryContext;
}

export type RetryStrategy =
  | "exponential_backoff"
  | "linear_backoff"
  | "fixed_delay"
  | "adaptive"
  | "custom";

export type FallbackStrategy = "none" | "sequential" | "parallel" | "best_effort" | "custom";

export interface RetryContext {
  /** Request ID */
  requestId: string;
  /** Session ID */
  sessionId?: string;
  /** User ID */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Request priority */
  priority: "low" | "medium" | "high" | "critical";
  /** Request source */
  source: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

export interface RetryAttempt {
  /** Attempt number */
  attempt: number;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Duration */
  duration?: number;
  /** Success status */
  success: boolean;
  /** Error if failed */
  error?: RetryError;
  /** Agent type used */
  agentType: AgentType;
  /** Response if successful */
  response?: AgentResponse;
  /** Retry delay before this attempt */
  delay: number;
}

export interface RetryError {
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Stack trace */
  stack?: string;
  /** Whether error is retryable */
  retryable: boolean;
  /** Error severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Error context */
  context?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

export interface RetryResult {
  /** Request ID */
  requestId: string;
  /** Overall success status */
  success: boolean;
  /** Final response */
  response?: AgentResponse;
  /** Final error */
  error?: RetryError;
  /** Total attempts */
  totalAttempts: number;
  /** Retry attempts */
  attempts: RetryAttempt[];
  /** Total duration */
  totalDuration: number;
  /** Agent type that succeeded */
  successfulAgentType?: AgentType;
  /** Fallback used */
  fallbackUsed: boolean;
  /** Retry strategy used */
  strategy: RetryStrategy;
  /** Retry statistics */
  statistics: RetryStatistics;
}

export interface RetryStatistics {
  /** Average attempt duration */
  avgAttemptDuration: number;
  /** Total retry delay */
  totalRetryDelay: number;
  /** Success rate by attempt */
  successRateByAttempt: Record<number, number>;
  /** Error distribution */
  errorDistribution: Record<string, number>;
  /** Agent performance */
  agentPerformance: Record<
    AgentType,
    {
      attempts: number;
      successes: number;
      avgDuration: number;
      successRate: number;
    }
  >;
}

export interface FallbackAgent {
  /** Agent type */
  agentType: AgentType;
  /** Agent instance */
  agent: IAgent;
  /** Priority */
  priority: number;
  /** Success rate */
  successRate: number;
  /** Average response time */
  avgResponseTime: number;
  /** Last used */
  lastUsed?: Date;
  /** Health status */
  health: "healthy" | "degraded" | "unhealthy";
}

export interface RetryPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Agent types this policy applies to */
  agentTypes: AgentType[];
  /** Default retry options */
  defaultOptions: RetryOptions;
  /** Error type mappings */
  errorMappings: Record<
    string,
    {
      retryable: boolean;
      maxRetries?: number;
      backoffMultiplier?: number;
      fallbackAgents?: AgentType[];
    }
  >;
  /** Policy conditions */
  conditions: RetryPolicyCondition[];
  /** Enabled status */
  enabled: boolean;
}

export interface RetryPolicyCondition {
  /** Condition ID */
  id: string;
  /** Condition type */
  type: "time_of_day" | "load_level" | "error_rate" | "priority" | "custom";
  /** Condition parameters */
  parameters: Record<string, unknown>;
  /** Override options */
  overrideOptions: Partial<RetryOptions>;
  /** Enabled status */
  enabled: boolean;
}

// ============================================================================
// Retry Manager Implementation
// ============================================================================

/**
 * Agent Retry Manager
 *
 * Provides intelligent retry and fallback mechanisms for agent operations
 */
export class AgentRetryManager {
  private static instance: AgentRetryManager;
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  private fallbackAgents: Map<AgentType, FallbackAgent[]> = new Map();
  private retryHistory: Map<string, RetryResult[]> = new Map();
  private maxHistorySize: number = 1000;

  private constructor() {
    this.initializeDefaultPolicies();
    logger.info("AgentRetryManager initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentRetryManager {
    if (!AgentRetryManager.instance) {
      AgentRetryManager.instance = new AgentRetryManager();
    }
    return AgentRetryManager.instance;
  }

  /**
   * Execute agent request with retry and fallback
   */
  async executeWithRetry<T>(
    primaryAgent: IAgent,
    request: AgentRequest,
    options?: Partial<RetryOptions>
  ): Promise<RetryResult> {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Get retry options
    const retryOptions = this.getRetryOptions(primaryAgent.getAgentType(), options);

    // Create retry context
    const context: RetryContext = {
      requestId,
      sessionId: request.sessionId,
      userId: request.userId,
      organizationId: request.organizationId,
      priority: "medium",
      source: "agent_retry_manager",
      ...options?.context,
    };

    logger.info("Starting agent execution with retry", {
      requestId,
      agentType: primaryAgent.getAgentType(),
      maxRetries: retryOptions.maxRetries,
      strategy: retryOptions.strategy,
    });

    const attempts: RetryAttempt[] = [];
    let finalResponse: AgentResponse | undefined;
    let finalError: RetryError | undefined;
    let successfulAgentType: AgentType | undefined;
    let fallbackUsed = false;

    try {
      // Execute primary agent with retries
      const primaryResult = await this.executeAgentWithRetry(
        primaryAgent,
        request,
        retryOptions,
        context,
        attempts,
        0
      );

      if (primaryResult.success) {
        finalResponse = primaryResult.response;
        successfulAgentType = primaryAgent.getAgentType();
      } else {
        // Try fallback agents if primary failed
        if (retryOptions.fallbackAgents.length > 0) {
          fallbackUsed = true;
          const fallbackResult = await this.executeFallbackAgents(
            request,
            retryOptions,
            context,
            attempts,
            primaryResult.error
          );

          if (fallbackResult.success) {
            finalResponse = fallbackResult.response;
            successfulAgentType = fallbackResult.agentType;
          } else {
            finalError = fallbackResult.error;
          }
        } else {
          finalError = primaryResult.error;
        }
      }
    } catch (error) {
      finalError = this.createRetryError(error as Error, "unknown", false);
      logger.error("Unexpected error during retry execution", {
        requestId,
        error: (error as Error).message,
      });
    }

    const totalDuration = Date.now() - startTime;
    const statistics = this.calculateRetryStatistics(attempts);

    const result: RetryResult = {
      requestId,
      success: !!finalResponse,
      response: finalResponse,
      error: finalError,
      totalAttempts: attempts.length,
      attempts,
      totalDuration,
      successfulAgentType,
      fallbackUsed,
      strategy: retryOptions.strategy,
      statistics,
    };

    // Store retry history
    this.storeRetryHistory(result);

    logger.info("Agent execution with retry completed", {
      requestId,
      success: result.success,
      totalAttempts: result.totalAttempts,
      totalDuration,
      fallbackUsed,
      successfulAgentType,
    });

    return result;
  }

  /**
   * Register fallback agent
   */
  registerFallbackAgent(primaryAgentType: AgentType, fallbackAgent: FallbackAgent): void {
    if (!this.fallbackAgents.has(primaryAgentType)) {
      this.fallbackAgents.set(primaryAgentType, []);
    }

    const fallbacks = this.fallbackAgents.get(primaryAgentType)!;
    fallbacks.push(fallbackAgent);

    // Sort by priority (highest first)
    fallbacks.sort((a, b) => b.priority - a.priority);

    logger.info("Fallback agent registered", {
      primaryAgentType,
      fallbackAgentType: fallbackAgent.agentType,
      priority: fallbackAgent.priority,
    });
  }

  /**
   * Get fallback agents for agent type
   */
  getFallbackAgents(agentType: AgentType): FallbackAgent[] {
    return this.fallbackAgents.get(agentType) || [];
  }

  /**
   * Add or update retry policy
   */
  updateRetryPolicy(policy: RetryPolicy): void {
    this.retryPolicies.set(policy.id, policy);
    logger.info("Retry policy updated", { policyId: policy.id, agentTypes: policy.agentTypes });
  }

  /**
   * Get retry policy for agent type
   */
  getRetryPolicy(agentType: AgentType): RetryPolicy | undefined {
    for (const policy of this.retryPolicies.values()) {
      if (policy.agentTypes.includes(agentType) && policy.enabled) {
        return policy;
      }
    }
    return undefined;
  }

  /**
   * Get retry history
   */
  getRetryHistory(filters?: {
    agentType?: AgentType;
    requestId?: string;
    sessionId?: string;
    success?: boolean;
    startTime?: Date;
    endTime?: Date;
  }): RetryResult[] {
    let history = Array.from(this.retryHistory.values()).flat();

    if (filters) {
      if (filters.agentType) {
        history = history.filter((r) => r.attempts.some((a) => a.agentType === filters.agentType));
      }
      if (filters.requestId) {
        history = history.filter((r) => r.requestId === filters.requestId);
      }
      if (filters.sessionId) {
        history = history.filter((r) => r.attempts.some((a) => a.agentType === filters.agentType));
      }
      if (filters.success !== undefined) {
        history = history.filter((r) => r.success === filters.success);
      }
      if (filters.startTime) {
        history = history.filter((r) => r.attempts[0].startTime >= filters.startTime!);
      }
      if (filters.endTime) {
        history = history.filter(
          (r) => r.attempts[r.attempts.length - 1].endTime! <= filters.endTime!
        );
      }
    }

    return history.sort(
      (a, b) => b.attempts[0].startTime.getTime() - a.attempts[0].startTime.getTime()
    );
  }

  /**
   * Get retry statistics
   */
  getRetryStatistics(timeWindow?: { start: Date; end: Date }): {
    totalRetries: number;
    successRate: number;
    avgAttempts: number;
    fallbackUsageRate: number;
    agentPerformance: Record<
      AgentType,
      {
        attempts: number;
        successes: number;
        successRate: number;
        avgDuration: number;
      }
    >;
    errorDistribution: Record<string, number>;
  } {
    let history = Array.from(this.retryHistory.values()).flat();

    if (timeWindow) {
      history = history.filter(
        (r) =>
          r.attempts[0].startTime >= timeWindow.start && r.attempts[0].startTime <= timeWindow.end
      );
    }

    const totalRetries = history.length;
    const successfulRetries = history.filter((r) => r.success).length;
    const successRate = totalRetries > 0 ? successfulRetries / totalRetries : 0;

    const avgAttempts =
      totalRetries > 0 ? history.reduce((sum, r) => sum + r.totalAttempts, 0) / totalRetries : 0;

    const fallbackUsageRate =
      totalRetries > 0 ? history.filter((r) => r.fallbackUsed).length / totalRetries : 0;

    const agentPerformance: Record<
      AgentType,
      {
        attempts: number;
        successes: number;
        successRate: number;
        avgDuration: number;
      }
    > = {};

    history.forEach((result) => {
      result.attempts.forEach((attempt) => {
        if (!agentPerformance[attempt.agentType]) {
          agentPerformance[attempt.agentType] = {
            attempts: 0,
            successes: 0,
            successRate: 0,
            avgDuration: 0,
          };
        }

        const perf = agentPerformance[attempt.agentType];
        perf.attempts++;
        if (attempt.success) {
          perf.successes++;
        }
      });
    });

    // Calculate success rates and average durations
    Object.entries(agentPerformance).forEach(([agentType, perf]) => {
      perf.successRate = perf.attempts > 0 ? perf.successes / perf.attempts : 0;

      const agentAttempts = history
        .flatMap((r) => r.attempts)
        .filter((a) => a.agentType === agentType && a.success && a.duration);

      perf.avgDuration =
        agentAttempts.length > 0
          ? agentAttempts.reduce((sum, a) => sum + a.duration!, 0) / agentAttempts.length
          : 0;
    });

    const errorDistribution: Record<string, number> = {};
    history.forEach((result) => {
      result.attempts.forEach((attempt) => {
        if (attempt.error) {
          errorDistribution[attempt.error.type] = (errorDistribution[attempt.error.type] || 0) + 1;
        }
      });
    });

    return {
      totalRetries,
      successRate,
      avgAttempts,
      fallbackUsageRate,
      agentPerformance,
      errorDistribution,
    };
  }

  /**
   * Reset retry manager
   */
  reset(): void {
    this.retryHistory.clear();
    this.initializeDefaultPolicies();
    logger.info("Agent retry manager reset");
  }

  /**
   * Get manager statistics
   */
  getManagerStatistics(): {
    totalPolicies: number;
    activePolicies: number;
    totalFallbackAgents: number;
    totalRetryHistory: number;
    memoryUsage: number;
  } {
    const activePolicies = Array.from(this.retryPolicies.values()).filter((p) => p.enabled).length;
    const totalFallbackAgents = Array.from(this.fallbackAgents.values()).reduce(
      (sum, agents) => sum + agents.length,
      0
    );
    const totalRetryHistory = Array.from(this.retryHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0
    );

    return {
      totalPolicies: this.retryPolicies.size,
      activePolicies,
      totalFallbackAgents,
      totalRetryHistory,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Execute agent with retry logic
   */
  private async executeAgentWithRetry<T>(
    agent: IAgent,
    request: AgentRequest,
    options: RetryOptions,
    context: RetryContext,
    attempts: RetryAttempt[],
    attemptNumber: number
  ): Promise<{ success: boolean; response?: AgentResponse; error?: RetryError }> {
    const agentType = agent.getAgentType();
    const startTime = Date.now();
    const delay = attemptNumber > 0 ? this.calculateRetryDelay(attemptNumber, options) : 0;

    // Wait before retry (except first attempt)
    if (delay > 0) {
      await this.sleep(delay);
    }

    const attempt: RetryAttempt = {
      attempt: attemptNumber + 1,
      startTime: new Date(),
      success: false,
      agentType,
      delay,
    };

    try {
      // Execute with timeout
      const response = await this.executeWithTimeout(agent, request, options.attemptTimeout);

      attempt.endTime = new Date();
      attempt.duration = Date.now() - startTime;
      attempt.success = true;
      attempt.response = response;

      attempts.push(attempt);

      // Record success in telemetry
      agentTelemetryService.recordTelemetryEvent({
        type: "agent_retry_success",
        agentType,
        sessionId: context.sessionId,
        userId: context.userId,
        data: {
          requestId: context.requestId,
          attemptNumber: attemptNumber + 1,
          duration: attempt.duration,
          delay,
        },
        severity: "info",
      });

      return { success: true, response };
    } catch (error) {
      const retryError = this.createRetryError(error as Error, agentType, true);

      attempt.endTime = new Date();
      attempt.duration = Date.now() - startTime;
      attempt.error = retryError;

      attempts.push(attempt);

      // Record failure in telemetry
      agentTelemetryService.recordTelemetryEvent({
        type: "agent_retry_failure",
        agentType,
        sessionId: context.sessionId,
        userId: context.userId,
        data: {
          requestId: context.requestId,
          attemptNumber: attemptNumber + 1,
          error: retryError.message,
          errorType: retryError.type,
          duration: attempt.duration,
        },
        severity: "error",
      });

      // Check if we should retry
      if (
        attemptNumber < options.maxRetries &&
        this.shouldRetry(retryError, options, attemptNumber)
      ) {
        logger.debug("Retrying agent execution", {
          requestId: context.requestId,
          agentType,
          attemptNumber: attemptNumber + 1,
          maxRetries: options.maxRetries,
          errorType: retryError.type,
        });

        return this.executeAgentWithRetry(
          agent,
          request,
          options,
          context,
          attempts,
          attemptNumber + 1
        );
      }

      return { success: false, error: retryError };
    }
  }

  /**
   * Execute fallback agents
   */
  private async executeFallbackAgents<T>(
    request: AgentRequest,
    options: RetryOptions,
    context: RetryContext,
    attempts: RetryAttempt[],
    primaryError?: RetryError
  ): Promise<{
    success: boolean;
    response?: AgentResponse;
    error?: RetryError;
    agentType: AgentType;
  }> {
    const fallbackAgents = this.getFallbackAgents(request.agentType);

    if (fallbackAgents.length === 0) {
      return {
        success: false,
        error:
          primaryError ||
          this.createRetryError(
            new Error("No fallback agents available"),
            request.agentType,
            false
          ),
        agentType: request.agentType,
      };
    }

    logger.info("Executing fallback agents", {
      requestId: context.requestId,
      primaryAgentType: request.agentType,
      fallbackCount: fallbackAgents.length,
      strategy: options.fallbackStrategy,
    });

    switch (options.fallbackStrategy) {
      case "sequential":
        return this.executeSequentialFallback(request, options, context, attempts, fallbackAgents);

      case "parallel":
        return this.executeParallelFallback(request, options, context, attempts, fallbackAgents);

      case "best_effort":
        return this.executeBestEffortFallback(request, options, context, attempts, fallbackAgents);

      default:
        return this.executeSequentialFallback(request, options, context, attempts, fallbackAgents);
    }
  }

  /**
   * Execute sequential fallback
   */
  private async executeSequentialFallback<T>(
    request: AgentRequest,
    options: RetryOptions,
    context: RetryContext,
    attempts: RetryAttempt[],
    fallbackAgents: FallbackAgent[]
  ): Promise<{
    success: boolean;
    response?: AgentResponse;
    error?: RetryError;
    agentType: AgentType;
  }> {
    for (const fallbackAgent of fallbackAgents) {
      try {
        logger.debug("Trying fallback agent", {
          requestId: context.requestId,
          fallbackAgentType: fallbackAgent.agentType,
          priority: fallbackAgent.priority,
        });

        const result = await this.executeAgentWithRetry(
          fallbackAgent.agent,
          request,
          { ...options, maxRetries: Math.min(options.maxRetries, 2) }, // Limited retries for fallback
          context,
          attempts,
          attempts.length
        );

        if (result.success) {
          fallbackAgent.lastUsed = new Date();

          agentTelemetryService.recordTelemetryEvent({
            type: "agent_fallback_success",
            agentType: fallbackAgent.agentType,
            sessionId: context.sessionId,
            userId: context.userId,
            data: {
              requestId: context.requestId,
              primaryAgentType: request.agentType,
              fallbackAgentType: fallbackAgent.agentType,
              priority: fallbackAgent.priority,
            },
            severity: "info",
          });

          return {
            success: true,
            response: result.response,
            agentType: fallbackAgent.agentType,
          };
        }
      } catch (error) {
        logger.warn("Fallback agent failed", {
          requestId: context.requestId,
          fallbackAgentType: fallbackAgent.agentType,
          error: (error as Error).message,
        });
      }
    }

    return {
      success: false,
      error: this.createRetryError(
        new Error("All fallback agents failed"),
        request.agentType,
        false
      ),
      agentType: request.agentType,
    };
  }

  /**
   * Execute parallel fallback
   */
  private async executeParallelFallback<T>(
    request: AgentRequest,
    options: RetryOptions,
    context: RetryContext,
    attempts: RetryAttempt[],
    fallbackAgents: FallbackAgent[]
  ): Promise<{
    success: boolean;
    response?: AgentResponse;
    error?: RetryError;
    agentType: AgentType;
  }> {
    const promises = fallbackAgents.map(async (fallbackAgent) => {
      try {
        const result = await this.executeAgentWithRetry(
          fallbackAgent.agent,
          request,
          { ...options, maxRetries: 1 }, // Single attempt for parallel
          context,
          attempts,
          attempts.length
        );

        return {
          agentType: fallbackAgent.agentType,
          success: result.success,
          response: result.response,
          error: result.error,
          priority: fallbackAgent.priority,
        };
      } catch (error) {
        return {
          agentType: fallbackAgent.agentType,
          success: false,
          error: this.createRetryError(error as Error, fallbackAgent.agentType, false),
          priority: fallbackAgent.priority,
        };
      }
    });

    const results = await Promise.all(promises);

    // Find the first successful result with highest priority
    const successfulResults = results
      .filter((r) => r.success)
      .sort((a, b) => b.priority - a.priority);

    if (successfulResults.length > 0) {
      const bestResult = successfulResults[0];

      agentTelemetryService.recordTelemetryEvent({
        type: "agent_fallback_parallel_success",
        agentType: bestResult.agentType,
        sessionId: context.sessionId,
        userId: context.userId,
        data: {
          requestId: context.requestId,
          primaryAgentType: request.agentType,
          fallbackAgentType: bestResult.agentType,
          totalAttempts: results.length,
        },
        severity: "info",
      });

      return {
        success: true,
        response: bestResult.response,
        agentType: bestResult.agentType,
      };
    }

    return {
      success: false,
      error: this.createRetryError(
        new Error("All parallel fallback agents failed"),
        request.agentType,
        false
      ),
      agentType: request.agentType,
    };
  }

  /**
   * Execute best effort fallback
   */
  private async executeBestEffortFallback<T>(
    request: AgentRequest,
    options: RetryOptions,
    context: RetryContext,
    attempts: RetryAttempt[],
    fallbackAgents: FallbackAgent[]
  ): Promise<{
    success: boolean;
    response?: AgentResponse;
    error?: RetryError;
    agentType: AgentType;
  }> {
    // Sort by success rate and response time
    const sortedAgents = [...fallbackAgents].sort((a, b) => {
      const aScore = a.successRate * 0.7 + (1 / (a.avgResponseTime || 1000)) * 0.3;
      const bScore = b.successRate * 0.7 + (1 / (b.avgResponseTime || 1000)) * 0.3;
      return bScore - aScore;
    });

    return this.executeSequentialFallback(request, options, context, attempts, sortedAgents);
  }

  /**
   * Get retry options for agent type
   */
  private getRetryOptions(
    agentType: AgentType,
    customOptions?: Partial<RetryOptions>
  ): RetryOptions {
    const policy = this.getRetryPolicy(agentType);
    const defaultOptions = policy?.defaultOptions || this.getDefaultRetryOptions();

    return {
      ...defaultOptions,
      ...customOptions,
    };
  }

  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(attemptNumber: number, options: RetryOptions): number {
    let delay: number;

    switch (options.strategy) {
      case "exponential_backoff":
        delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
        break;

      case "linear_backoff":
        delay = options.baseDelay * attemptNumber;
        break;

      case "fixed_delay":
        delay = options.baseDelay;
        break;

      case "adaptive":
        // Adaptive based on recent success rates
        const recentSuccessRate = this.getRecentSuccessRate(options);
        if (recentSuccessRate < 0.5) {
          delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1) * 2;
        } else {
          delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
        }
        break;

      default:
        delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
    }

    // Apply jitter
    if (options.jitterFactor > 0) {
      const jitter = delay * options.jitterFactor * Math.random();
      delay += jitter;
    }

    // Apply maximum delay
    delay = Math.min(delay, options.maxDelay);

    return Math.floor(delay);
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: RetryError, options: RetryOptions, attemptNumber: number): boolean {
    // Check if error type is non-retryable
    if (options.nonRetryableErrors.includes(error.type)) {
      return false;
    }

    // Check if error type is explicitly retryable
    if (options.retryableErrors.includes(error.type)) {
      return true;
    }

    // Check error severity
    if (error.severity === "critical") {
      return false;
    }

    // Check if error indicates retryable condition
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporary/i,
      /rate.?limit/i,
      /too.?many.?requests/i,
      /service.?unavailable/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    agent: IAgent,
    request: AgentRequest,
    timeout: number
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Agent execution timeout after ${timeout}ms`));
      }, timeout);

      agent
        .execute(request)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create retry error
   */
  private createRetryError(error: Error, agentType: AgentType, retryable: boolean): RetryError {
    return {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack,
      retryable,
      severity: this.getErrorSeverity(error),
      context: { agentType },
      timestamp: new Date(),
    };
  }

  /**
   * Get error severity
   */
  private getErrorSeverity(error: Error): "low" | "medium" | "high" | "critical" {
    const message = error.message.toLowerCase();

    if (message.includes("timeout") || message.includes("network")) {
      return "medium";
    }
    if (message.includes("authentication") || message.includes("authorization")) {
      return "high";
    }
    if (message.includes("critical") || message.includes("fatal")) {
      return "critical";
    }

    return "low";
  }

  /**
   * Calculate retry statistics
   */
  private calculateRetryStatistics(attempts: RetryAttempt[]): RetryStatistics {
    const successfulAttempts = attempts.filter((a) => a.success);
    const avgAttemptDuration =
      attempts.length > 0
        ? attempts.reduce((sum, a) => sum + (a.duration || 0), 0) / attempts.length
        : 0;

    const totalRetryDelay = attempts.reduce((sum, a) => sum + a.delay, 0);

    const successRateByAttempt: Record<number, number> = {};
    attempts.forEach((attempt) => {
      const attemptNumber = attempt.attempt;
      if (!successRateByAttempt[attemptNumber]) {
        successRateByAttempt[attemptNumber] = 0;
      }
      if (attempt.success) {
        successRateByAttempt[attemptNumber]++;
      }
    });

    // Convert to percentages
    Object.keys(successRateByAttempt).forEach((attemptNum) => {
      const num = parseInt(attemptNum);
      const totalAttemptsForNum = attempts.filter((a) => a.attempt === num).length;
      successRateByAttempt[num] = (successRateByAttempt[num] / totalAttemptsForNum) * 100;
    });

    const errorDistribution: Record<string, number> = {};
    attempts.forEach((attempt) => {
      if (attempt.error) {
        errorDistribution[attempt.error.type] = (errorDistribution[attempt.error.type] || 0) + 1;
      }
    });

    const agentPerformance: Record<
      AgentType,
      {
        attempts: number;
        successes: number;
        avgDuration: number;
        successRate: number;
      }
    > = {};

    attempts.forEach((attempt) => {
      if (!agentPerformance[attempt.agentType]) {
        agentPerformance[attempt.agentType] = {
          attempts: 0,
          successes: 0,
          avgDuration: 0,
          successRate: 0,
        };
      }

      const perf = agentPerformance[attempt.agentType];
      perf.attempts++;
      if (attempt.success) {
        perf.successes++;
      }
    });

    // Calculate success rates and average durations
    Object.entries(agentPerformance).forEach(([agentType, perf]) => {
      perf.successRate = perf.attempts > 0 ? perf.successes / perf.attempts : 0;

      const agentAttempts = attempts.filter(
        (a) => a.agentType === agentType && a.success && a.duration
      );
      perf.avgDuration =
        agentAttempts.length > 0
          ? agentAttempts.reduce((sum, a) => sum + a.duration!, 0) / agentAttempts.length
          : 0;
    });

    return {
      avgAttemptDuration,
      totalRetryDelay,
      successRateByAttempt,
      errorDistribution,
      agentPerformance,
    };
  }

  /**
   * Store retry history
   */
  private storeRetryHistory(result: RetryResult): void {
    const agentType = result.attempts[0]?.agentType;
    if (!agentType) return;

    if (!this.retryHistory.has(agentType)) {
      this.retryHistory.set(agentType, []);
    }

    const history = this.retryHistory.get(agentType)!;
    history.push(result);

    // Cleanup old history
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  /**
   * Get recent success rate for adaptive strategy
   */
  private getRecentSuccessRate(options: RetryOptions): number {
    // This would look at recent retry history to calculate success rate
    // For now, return a default value
    return 0.8;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Initialize default retry policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicy: RetryPolicy = {
      id: "default-retry-policy",
      name: "Default Retry Policy",
      description: "Default retry policy for all agents",
      agentTypes: ["opportunity", "target", "expansion", "integrity", "realization"],
      defaultOptions: this.getDefaultRetryOptions(),
      errorMappings: {
        TimeoutError: { retryable: true, maxRetries: 3 },
        NetworkError: { retryable: true, maxRetries: 5 },
        ValidationError: { retryable: false },
        AuthenticationError: { retryable: false },
      },
      conditions: [],
      enabled: true,
    };

    this.retryPolicies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Get default retry options
   */
  private getDefaultRetryOptions(): RetryOptions {
    return {
      maxRetries: 3,
      strategy: "exponential_backoff",
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      retryableErrors: [
        "TimeoutError",
        "NetworkError",
        "ConnectionError",
        "ServiceUnavailableError",
        "RateLimitError",
      ],
      nonRetryableErrors: [
        "ValidationError",
        "AuthenticationError",
        "AuthorizationError",
        "NotFoundError",
        "PermissionError",
      ],
      fallbackAgents: [],
      fallbackStrategy: "sequential",
      attemptTimeout: 30000,
      overallTimeout: 120000,
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation in MB
    const policiesSize = this.retryPolicies.size * 0.01; // ~10KB per policy
    const fallbacksSize =
      Array.from(this.fallbackAgents.values()).reduce((sum, agents) => sum + agents.length, 0) *
      0.001; // ~1KB per fallback
    const historySize =
      Array.from(this.retryHistory.values()).reduce((sum, history) => sum + history.length, 0) *
      0.005; // ~5KB per result

    return policiesSize + fallbacksSize + historySize;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentRetryManager = AgentRetryManager.getInstance();

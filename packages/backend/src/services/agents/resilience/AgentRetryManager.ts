/**
 * Agent Retry Manager
 *
 * CONSOLIDATION: Intelligent retry and fallback mechanisms for agent operations
 *
 * Provides sophisticated retry strategies with exponential backoff, circuit breaker
 * integration, and intelligent fallback agent selection for resilient agent operations.
 */

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../../lib/logger.js";
import { getRedisClient } from "../../../lib/redis.js";
import { AgentType } from "../../agent-types.js";
import { AgentRequest, AgentResponse, IAgent } from "../core/IAgent.js";
import { agentTelemetryService } from "../telemetry/AgentTelemetryService.js";

export type ContractComplianceFailureType = "parse" | "schema" | "business_rule" | "unknown";

export interface ContractComplianceViolation {
  path?: string;
  message: string;
  code?: string;
}

export interface ContractComplianceValidationResult<TOutput> {
  approved: boolean;
  output?: TOutput;
  failureType?: ContractComplianceFailureType;
  details?: string;
  violations?: ContractComplianceViolation[];
}

export interface ContractAwareRetryPayload<TOutput> {
  generator: (input: { prompt: string; attempt: number }) => Promise<string>;
  complianceEngine: {
    validate: (
      rawOutput: string,
      payload: {
        outputSchema: unknown;
        originalSchema: unknown;
      }
    ) => Promise<ContractComplianceValidationResult<TOutput>>;
  };
  outputSchema: unknown;
  originalSchema?: unknown;
  initialPrompt: string;
  agentPolicy: { maxRetries: number };
}

export interface ContractAwareRetryError {
  code:
    | "PARSE_VALIDATION_FAILED"
    | "SCHEMA_VALIDATION_FAILED"
    | "BUSINESS_RULE_VALIDATION_FAILED"
    | "GENERATOR_EXECUTION_FAILED"
    | "COMPLIANCE_ENGINE_FAILED"
    | "UNKNOWN_COMPLIANCE_ERROR";
  message: string;
  retryable: boolean;
  attemptsUsed: number;
  violations?: ContractComplianceViolation[];
}

export interface AgentResult<TOutput> {
  approved: boolean;
  output?: TOutput;
  retryCount: number;
  error?: ContractAwareRetryError;
}

export type {
  FallbackAgent,
  FallbackStrategy,
  RetryAttempt,
  RetryContext,
  RetryError,
  RetryOptions,
  RetryPolicy,
  RetryPolicyCondition,
  RetryResult,
  RetryStatistics,
  RetryStrategy,
} from "./AgentRetryTypes.js";
import type {
  FallbackAgent,
  FallbackStrategy,
  RetryAttempt,
  RetryContext,
  RetryError,
  RetryOptions,
  RetryPolicy,
  RetryPolicyCondition,
  RetryResult,
  RetryStatistics,
  RetryStrategy,
} from "./AgentRetryTypes.js";

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

  // Per-tenant rate limit state is stored in Redis so all replicas share
  // the same view. In-process Map was a B-6 blocker: each pod maintained
  // independent state, allowing a tenant that hit the LLM rate limit on
  // one replica to continue hammering the API from other replicas.
  //
  // Redis key format: agent:ratelimit:{tenantId}
  // Value: JSON-serialised TenantRateLimitState
  // TTL: backoffMs + 60 s buffer (auto-expires stale entries)
  private static readonly REDIS_RATE_LIMIT_PREFIX = "agent:ratelimit:";
  private static readonly REDIS_RATE_LIMIT_ROLE = "control-plane" as const;

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
   * Execute contract-aware retry flow:
   * Generate -> Validate -> Repair -> Retry -> Approve/Reject
   */
  async executeContractAwareRetry<TOutput>(
    payload: ContractAwareRetryPayload<TOutput>
  ): Promise<AgentResult<TOutput>> {
    const maxRetries = Math.max(0, payload.agentPolicy.maxRetries);
    let prompt = payload.initialPrompt;
    let lastValidationFailure: ContractComplianceValidationResult<TOutput> | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let rawOutput: string;
      try {
        rawOutput = await payload.generator({ prompt, attempt });
      } catch (error) {
        return {
          approved: false,
          retryCount: attempt,
          error: {
            code: "GENERATOR_EXECUTION_FAILED",
            message: (error as Error).message,
            retryable: false,
            attemptsUsed: attempt + 1,
          },
        };
      }

      let validation: ContractComplianceValidationResult<TOutput>;
      try {
        validation = await payload.complianceEngine.validate(rawOutput, {
          outputSchema: payload.outputSchema,
          originalSchema: payload.originalSchema ?? payload.outputSchema,
        });
      } catch (error) {
        return {
          approved: false,
          retryCount: attempt,
          error: {
            code: "COMPLIANCE_ENGINE_FAILED",
            message: (error as Error).message,
            retryable: false,
            attemptsUsed: attempt + 1,
          },
        };
      }

      if (validation.approved && validation.output !== undefined) {
        return {
          approved: true,
          output: validation.output,
          retryCount: attempt,
        };
      }

      lastValidationFailure = validation;
      const failureType = validation.failureType ?? "unknown";
      const details = validation.details ?? "Output compliance validation failed.";

      switch (failureType) {
        case "business_rule":
          return {
            approved: false,
            retryCount: attempt,
            error: {
              code: "BUSINESS_RULE_VALIDATION_FAILED",
              message: details,
              retryable: false,
              attemptsUsed: attempt + 1,
              violations: validation.violations,
            },
          };

        case "parse":
        case "schema":
          if (attempt >= maxRetries) {
            return {
              approved: false,
              retryCount: attempt,
              error: {
                code:
                  failureType === "parse"
                    ? "PARSE_VALIDATION_FAILED"
                    : "SCHEMA_VALIDATION_FAILED",
                message: details,
                retryable: true,
                attemptsUsed: attempt + 1,
                violations: validation.violations,
              },
            };
          }

          prompt = this.buildRepairPrompt(
            payload.originalSchema ?? payload.outputSchema,
            validation
          );
          continue;

        case "unknown":
        default:
          return {
            approved: false,
            retryCount: attempt,
            error: {
              code: "UNKNOWN_COMPLIANCE_ERROR",
              message: details,
              retryable: false,
              attemptsUsed: attempt + 1,
              violations: validation.violations,
            },
          };
      }
    }

    return {
      approved: false,
      retryCount: maxRetries,
      error: {
        code: "UNKNOWN_COMPLIANCE_ERROR",
        message: lastValidationFailure?.details ?? "Contract-aware retry exhausted.",
        retryable: false,
        attemptsUsed: maxRetries + 1,
        violations: lastValidationFailure?.violations,
      },
    };
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

    type AgentAccumulator = {
      attempts: number;
      successes: number;
      successfulDurationSum: number;
      successfulDurationCount: number;
    };

    const agentAccumulators: Partial<Record<AgentType, AgentAccumulator>> = {};
    const errorDistribution: Record<string, number> = {};

    const totalRetries = history.length;
    let successfulRetries = 0;
    let fallbackUsageCount = 0;
    let totalAttemptsAcrossRetries = 0;

    history.forEach((result) => {
      totalAttemptsAcrossRetries += result.totalAttempts;

      if (result.success) {
        successfulRetries++;
      }

      if (result.fallbackUsed) {
        fallbackUsageCount++;
      }

      result.attempts.forEach((attempt) => {
        const existingAccumulator = agentAccumulators[attempt.agentType];
        const accumulator: AgentAccumulator = existingAccumulator ?? {
          attempts: 0,
          successes: 0,
          successfulDurationSum: 0,
          successfulDurationCount: 0,
        };

        accumulator.attempts++;

        if (attempt.success) {
          accumulator.successes++;
          if (typeof attempt.duration === "number") {
            accumulator.successfulDurationSum += attempt.duration;
            accumulator.successfulDurationCount++;
          }
        }

        agentAccumulators[attempt.agentType] = accumulator;

        if (attempt.error) {
          errorDistribution[attempt.error.type] = (errorDistribution[attempt.error.type] || 0) + 1;
        }
      });
    });

    const successRate = totalRetries > 0 ? successfulRetries / totalRetries : 0;
    const avgAttempts = totalRetries > 0 ? totalAttemptsAcrossRetries / totalRetries : 0;
    const fallbackUsageRate = totalRetries > 0 ? fallbackUsageCount / totalRetries : 0;

    const agentPerformance: Record<
      AgentType,
      {
        attempts: number;
        successes: number;
        successRate: number;
        avgDuration: number;
      }
    > = {};
    Object.entries(agentAccumulators).forEach(([agentType, accumulator]) => {
      if (!accumulator) {
        return;
      }

      agentPerformance[agentType as AgentType] = {
        attempts: accumulator.attempts,
        successes: accumulator.successes,
        successRate: accumulator.attempts > 0 ? accumulator.successes / accumulator.attempts : 0,
        avgDuration:
          accumulator.successfulDurationCount > 0
            ? accumulator.successfulDurationSum / accumulator.successfulDurationCount
            : 0,
      };
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
  // Self-Healing: Global Rate Limit Management
  // ============================================================================

  /**
   * Build the Redis key for a tenant's rate-limit state.
   */
  private rateLimitKey(tenantId: string): string {
    return `${AgentRetryManager.REDIS_RATE_LIMIT_PREFIX}${tenantId}`;
  }

  /**
   * Read per-tenant rate-limit state from Redis.
   * Falls back to "no active limit" if Redis is unavailable so that a Redis
   * outage does not block all LLM traffic.
   */
  private async getRateLimitState(
    tenantId: string
  ): Promise<{ active: boolean; until: number; backoffMs: number; incidents: number; lastTime: number } | null> {
    try {
      const client = await getRedisClient(AgentRetryManager.REDIS_RATE_LIMIT_ROLE);
      if (!client) return null;
      const raw = await client.get(this.rateLimitKey(tenantId));
      if (!raw) return null;
      return JSON.parse(raw) as { active: boolean; until: number; backoffMs: number; incidents: number; lastTime: number };
    } catch (err) {
      logger.warn("Failed to read rate-limit state from Redis, assuming no active limit", {
        tenantId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Persist per-tenant rate-limit state to Redis with an automatic TTL so
   * stale entries self-expire even if the reset path is never reached.
   */
  private async setRateLimitState(
    tenantId: string,
    state: { active: boolean; until: number; backoffMs: number; incidents: number; lastTime: number }
  ): Promise<void> {
    try {
      const client = await getRedisClient(AgentRetryManager.REDIS_RATE_LIMIT_ROLE);
      if (!client) return;
      // TTL = backoff window + 60 s safety buffer, minimum 60 s
      const ttlSeconds = Math.max(60, Math.ceil((state.backoffMs + 60_000) / 1000));
      await client.set(this.rateLimitKey(tenantId), JSON.stringify(state), "EX", ttlSeconds);
    } catch (err) {
      logger.warn("Failed to persist rate-limit state to Redis", {
        tenantId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Check if rate limit backoff is active for the given tenant and wait if necessary.
   * State is read from Redis so all replicas share the same view (B-6 fix).
   */
  private async checkGlobalRateLimit(requestId: string, organizationId?: string): Promise<void> {
    const tenantId = organizationId ?? "global";
    const state = await this.getRateLimitState(tenantId);
    if (!state?.active) {
      return;
    }

    const now = Date.now();
    if (now < state.until) {
      const waitTime = state.until - now;
      logger.warn("Tenant rate limit active, delaying request", {
        requestId,
        organizationId: tenantId,
        waitTime,
        backoffMs: state.backoffMs,
        incidents: state.incidents,
      });

      await this.sleep(waitTime);
    } else {
      // Backoff period expired — clear the active flag in Redis
      state.active = false;
      await this.setRateLimitState(tenantId, state);
      logger.info("Tenant rate limit period expired, resuming normal operations", {
        requestId,
        organizationId: tenantId,
        incidents: state.incidents,
      });
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: RetryError): boolean {
    const message = error.message.toLowerCase();
    const type = error.type.toLowerCase();

    return (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429") ||
      type.includes("ratelimit") ||
      type.includes("throttle")
    );
  }

  /**
   * Handle a rate-limit error for a specific tenant by applying per-tenant
   * exponential backoff. State is written to Redis so all replicas back off
   * together (B-6 fix).
   */
  private handleGlobalRateLimit(requestId: string, organizationId?: string): void {
    const tenantId = organizationId ?? "global";
    // Fire-and-forget: read current state, update, persist.
    // We do not await here to avoid blocking the retry path.
    void (async () => {
      const existing = (await this.getRateLimitState(tenantId)) ?? {
        active: false,
        until: 0,
        backoffMs: 1000,
        incidents: 0,
        lastTime: 0,
      };

      existing.incidents++;
      existing.lastTime = Date.now();
      // Exponential backoff: double the delay, max 5 minutes
      existing.backoffMs = Math.min(existing.backoffMs * 2, 300_000);
      existing.until = Date.now() + existing.backoffMs;
      existing.active = true;
      await this.setRateLimitState(tenantId, existing);

      logger.warn("Tenant rate limit triggered, applying exponential backoff", {
        requestId,
        organizationId: tenantId,
        backoffMs: existing.backoffMs,
        incidents: existing.incidents,
        until: new Date(existing.until).toISOString(),
      });

      agentTelemetryService.recordTelemetryEvent({
        type: "agent_fabric_global_rate_limit",
        agentType: "system" as AgentType,
        data: {
          requestId,
          organizationId: tenantId,
          backoffMs: existing.backoffMs,
          incidents: existing.incidents,
          activeUntil: existing.until,
        },
        severity: "warning",
      });
    })();
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
      // Check per-tenant rate limit before execution
      await this.checkGlobalRateLimit(context.requestId, context.organizationId);

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
        organizationId: context.organizationId,
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
        organizationId: context.organizationId,
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

      // Check for rate limit errors and trigger per-tenant backoff
      if (this.isRateLimitError(retryError)) {
        this.handleGlobalRateLimit(context.requestId, context.organizationId);
      }

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
            organizationId: context.organizationId,
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
        organizationId: context.organizationId,
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
   * Build a targeted repair prompt for parse/schema violations.
   */
  private buildRepairPrompt<TOutput>(
    originalSchema: unknown,
    validation: ContractComplianceValidationResult<TOutput>
  ): string {
    const violationDetails =
      validation.violations?.map((violation, index) => {
        const location = violation.path ? ` at ${violation.path}` : "";
        const code = violation.code ? ` (${violation.code})` : "";
        return `${index + 1}. ${violation.message}${location}${code}`;
      }) ?? [];

    const detailsSection =
      violationDetails.length > 0
        ? violationDetails.join("\n")
        : validation.details ?? "No additional violation details provided.";

    return [
      "Repair the previous response.",
      "Return only valid JSON with no markdown, no prose, and no backticks.",
      "The output must conform exactly to this schema:",
      JSON.stringify(originalSchema, null, 2),
      "Violations to fix:",
      detailsSection,
    ].join("\n\n");
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

/**
 * Agent Graceful Degradation Manager
 *
 * CONSOLIDATION: Graceful degradation system for agent operations
 *
 * Provides intelligent capability reduction, fallback functionality, and
 * degraded service operation when agents are under stress or experiencing issues.
 */

import { IAgent, AgentRequest, AgentResponse } from "../core/IAgent";
import { AgentType } from "../../agent-types";
import { logger } from "../../../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { agentTelemetryService } from "../telemetry/AgentTelemetryService";

// ============================================================================
// Degradation Types
// ============================================================================

export interface DegradationLevel {
  /** Level name */
  name: string;
  /** Level priority (higher = more degraded) */
  priority: number;
  /** Level description */
  description: string;
  /** Capabilities to disable */
  disabledCapabilities: string[];
  /** Capability reductions */
  capabilityReductions: CapabilityReduction[];
  /** Performance limits */
  performanceLimits: PerformanceLimits;
  /** Fallback behaviors */
  fallbackBehaviors: FallbackBehavior[];
  /** User notifications */
  userNotifications: UserNotification[];
}

export interface CapabilityReduction {
  /** Capability ID */
  capabilityId: string;
  /** Reduction type */
  type: "disable" | "limit" | "simplify" | "cache" | "approximate";
  /** Reduction parameters */
  parameters: Record<string, unknown>;
  /** Reason for reduction */
  reason: string;
}

export interface PerformanceLimits {
  /** Maximum concurrent requests */
  maxConcurrentRequests: number;
  /** Maximum request size */
  maxRequestSize: number;
  /** Maximum response time */
  maxResponseTime: number;
  /** Maximum memory usage */
  maxMemoryUsage: number;
  /** Rate limiting */
  rateLimiting: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    burstAllowance: number;
  };
}

export interface FallbackBehavior {
  /** Behavior ID */
  id: string;
  /** Trigger condition */
  trigger: DegradationTrigger;
  /** Fallback action */
  action: FallbackAction;
  /** Behavior priority */
  priority: number;
  /** Timeout */
  timeout: number;
}

export interface DegradationTrigger {
  /** Trigger type */
  type:
    | "error_rate"
    | "response_time"
    | "memory_usage"
    | "cpu_usage"
    | "circuit_breaker"
    | "manual";
  /** Trigger threshold */
  threshold: number;
  /** Trigger duration (ms) */
  duration: number;
  /** Trigger parameters */
  parameters?: Record<string, unknown>;
}

export interface FallbackAction {
  /** Action type */
  type: "use_cache" | "simplify_response" | "return_default" | "queue_request" | "redirect_agent";
  /** Action parameters */
  parameters: Record<string, unknown>;
  /** Action description */
  description: string;
}

export interface UserNotification {
  /** Notification ID */
  id: string;
  /** Notification type */
  type: "info" | "warning" | "error";
  /** Notification message */
  message: string;
  /** Notification details */
  details?: Record<string, unknown>;
  /** Show to user */
  showToUser: boolean;
  /** Notification duration */
  duration?: number;
}

export interface DegradationPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Agent types this policy applies to */
  agentTypes: AgentType[];
  /** Degradation levels */
  levels: DegradationLevel[];
  /** Auto-degradation settings */
  autoDegradation: AutoDegradationSettings;
  /** Recovery settings */
  recovery: RecoverySettings;
  /** Monitoring settings */
  monitoring: MonitoringSettings;
  /** Enabled status */
  enabled: boolean;
}

export interface AutoDegradationSettings {
  /** Enable auto-degradation */
  enabled: boolean;
  /** Degradation triggers */
  triggers: DegradationTrigger[];
  /** Minimum time between degradations */
  cooldownPeriod: number;
  /** Maximum degradation level */
  maxLevel: string;
  /** Degradation history retention */
  historyRetention: number;
}

export interface RecoverySettings {
  /** Enable auto-recovery */
  enabled: boolean;
  /** Recovery triggers */
  triggers: RecoveryTrigger[];
  /** Recovery strategy */
  strategy: "immediate" | "gradual" | "manual";
  /** Recovery confirmation */
  requireConfirmation: boolean;
  /** Recovery cooldown */
  cooldownPeriod: number;
}

export interface RecoveryTrigger {
  /** Trigger type */
  type: "health_improvement" | "load_reduction" | "time_based" | "manual";
  /** Trigger threshold */
  threshold: number;
  /** Trigger duration */
  duration: number;
  /** Trigger parameters */
  parameters?: Record<string, unknown>;
}

export interface MonitoringSettings {
  /** Health check interval */
  healthCheckInterval: number;
  /** Metrics collection interval */
  metricsInterval: number;
  /** Alert thresholds */
  alertThresholds: AlertThresholds;
  /** Notification settings */
  notifications: NotificationSettings;
}

export interface AlertThresholds {
  /** Error rate threshold */
  errorRate: number;
  /** Response time threshold */
  responseTime: number;
  /** Memory usage threshold */
  memoryUsage: number;
  /** CPU usage threshold */
  cpuUsage: number;
}

export interface NotificationSettings {
  /** Enable notifications */
  enabled: boolean;
  /** Notification channels */
  channels: ("console" | "email" | "slack" | "webhook")[];
  /** Notification recipients */
  recipients: string[];
  /** Notification templates */
  templates: Record<string, string>;
}

export interface DegradationState {
  /** Agent type */
  agentType: AgentType;
  /** Current degradation level */
  currentLevel: string;
  /** Level start time */
  levelStartTime: Date;
  /** Degradation history */
  history: DegradationEvent[];
  /** Active fallbacks */
  activeFallbacks: FallbackBehavior[];
  /** Performance metrics */
  metrics: DegradationMetrics;
  /** Recovery status */
  recoveryStatus: "none" | "in_progress" | "completed";
}

export interface DegradationEvent {
  /** Event ID */
  id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event type */
  type:
    | "degradation_start"
    | "degradation_end"
    | "level_change"
    | "fallback_activated"
    | "recovery_start"
    | "recovery_end";
  /** Previous level */
  previousLevel?: string;
  /** New level */
  newLevel?: string;
  /** Trigger */
  trigger?: DegradationTrigger;
  /** Reason */
  reason: string;
  /** Event details */
  details: Record<string, unknown>;
}

export interface DegradationMetrics {
  /** Current error rate */
  errorRate: number;
  /** Current response time */
  responseTime: number;
  /** Current memory usage */
  memoryUsage: number;
  /** Current CPU usage */
  cpuUsage: number;
  /** Request throughput */
  throughput: number;
  /** Active requests */
  activeRequests: number;
  /** Degraded requests */
  degradedRequests: number;
  /** Fallback usage */
  fallbackUsage: number;
}

// ============================================================================
// Degradation Manager Implementation
// ============================================================================

/**
 * Agent Graceful Degradation Manager
 *
 * Manages graceful degradation of agent capabilities under stress
 */
export class AgentDegradationManager {
  private static instance: AgentDegradationManager;
  private degradationPolicies: Map<string, DegradationPolicy> = new Map();
  private degradationStates: Map<AgentType, DegradationState> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private monitoringIntervalMs: number = 30000; // 30 seconds

  private constructor() {
    this.initializeDefaultPolicies();
    this.startMonitoring();
    logger.info("AgentDegradationManager initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentDegradationManager {
    if (!AgentDegradationManager.instance) {
      AgentDegradationManager.instance = new AgentDegradationManager();
    }
    return AgentDegradationManager.instance;
  }

  /**
   * Execute agent request with graceful degradation
   */
  async executeWithDegradation<T>(
    agent: IAgent,
    request: AgentRequest,
    customPolicy?: DegradationPolicy
  ): Promise<{
    response?: AgentResponse;
    degraded: boolean;
    degradationLevel?: string;
    fallbackUsed?: boolean;
    error?: Error;
  }> {
    const agentType = agent.getAgentType();
    const policy = customPolicy || this.getDegradationPolicy(agentType);

    if (!policy || !policy.enabled) {
      // No degradation policy, execute normally
      try {
        const response = await agent.execute(request);
        return { response, degraded: false };
      } catch (error) {
        return { error: error as Error, degraded: false };
      }
    }

    const state = this.getOrCreateDegradationState(agentType);
    const currentLevel =
      policy.levels.find((l) => l.name === state.currentLevel) || policy.levels[0];

    logger.debug("Executing with degradation", {
      agentType,
      currentLevel: state.currentLevel,
      degraded: state.currentLevel !== "normal",
    });

    try {
      // Apply performance limits
      const limitedRequest = this.applyPerformanceLimits(request, currentLevel.performanceLimits);

      // Check if we should use fallback
      const fallbackResult = this.shouldUseFallback(request, state, currentLevel);
      if (fallbackResult.use) {
        const fallbackResponse = await this.executeFallback(
          agent,
          request,
          fallbackResult.fallback
        );

        // Record fallback usage
        state.metrics.fallbackUsage++;

        return {
          response: fallbackResponse,
          degraded: true,
          degradationLevel: state.currentLevel,
          fallbackUsed: true,
        };
      }

      // Execute with degraded capabilities
      const response = await this.executeWithReducedCapabilities(
        agent,
        limitedRequest,
        currentLevel
      );

      return {
        response,
        degraded: state.currentLevel !== "normal",
        degradationLevel: state.currentLevel,
      };
    } catch (error) {
      // Handle error with degradation
      const errorResult = await this.handleErrorWithDegradation(
        agent,
        request,
        error as Error,
        state,
        policy
      );

      return {
        response: errorResult.response,
        degraded: true,
        degradationLevel: state.currentLevel,
        fallbackUsed: errorResult.fallbackUsed,
        error: errorResult.error,
      };
    }
  }

  /**
   * Get degradation state for agent type
   */
  getDegradationState(agentType: AgentType): DegradationState | undefined {
    return this.degradationStates.get(agentType);
  }

  /**
   * Manually trigger degradation
   */
  triggerDegradation(
    agentType: AgentType,
    targetLevel: string,
    reason: string,
    trigger?: DegradationTrigger
  ): boolean {
    const policy = this.getDegradationPolicy(agentType);
    if (!policy) {
      logger.warn("No degradation policy found for agent", { agentType });
      return false;
    }

    const state = this.getOrCreateDegradationState(agentType);
    const targetLevelObj = policy.levels.find((l) => l.name === targetLevel);

    if (!targetLevelObj) {
      logger.warn("Invalid degradation level", { agentType, targetLevel });
      return false;
    }

    const previousLevel = state.currentLevel;
    state.currentLevel = targetLevel;
    state.levelStartTime = new Date();

    // Record degradation event
    const event: DegradationEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: "level_change",
      previousLevel,
      newLevel: targetLevel,
      trigger,
      reason,
      details: {
        manual: true,
        agentType,
      },
    };

    state.history.push(event);

    // Notify users
    this.notifyDegradation(agentType, targetLevelObj, reason);

    logger.warn("Degradation triggered", {
      agentType,
      previousLevel,
      newLevel: targetLevel,
      reason,
    });

    return true;
  }

  /**
   * Manually trigger recovery
   */
  triggerRecovery(agentType: AgentType, reason: string): boolean {
    const state = this.degradationStates.get(agentType);
    if (!state) {
      logger.warn("No degradation state found for agent", { agentType });
      return false;
    }

    const previousLevel = state.currentLevel;
    state.currentLevel = "normal";
    state.levelStartTime = new Date();
    state.recoveryStatus = "completed";

    // Record recovery event
    const event: DegradationEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      type: "recovery_end",
      previousLevel,
      newLevel: "normal",
      reason,
      details: {
        manual: true,
        agentType,
      },
    };

    state.history.push(event);

    logger.info("Recovery triggered", {
      agentType,
      previousLevel,
      reason,
    });

    return true;
  }

  /**
   * Add or update degradation policy
   */
  updateDegradationPolicy(policy: DegradationPolicy): void {
    this.degradationPolicies.set(policy.id, policy);
    logger.info("Degradation policy updated", {
      policyId: policy.id,
      agentTypes: policy.agentTypes,
    });
  }

  /**
   * Get degradation policy for agent type
   */
  getDegradationPolicy(agentType: AgentType): DegradationPolicy | undefined {
    for (const policy of this.degradationPolicies.values()) {
      if (policy.agentTypes.includes(agentType) && policy.enabled) {
        return policy;
      }
    }
    return undefined;
  }

  /**
   * Get degradation statistics
   */
  getDegradationStatistics(): {
    totalPolicies: number;
    activePolicies: number;
    degradedAgents: number;
    agentsByLevel: Record<string, number>;
    totalEvents: number;
    avgRecoveryTime: number;
    fallbackUsageRate: number;
  } {
    const activePolicies = Array.from(this.degradationPolicies.values()).filter(
      (p) => p.enabled
    ).length;
    const degradedAgents = Array.from(this.degradationStates.values()).filter(
      (s) => s.currentLevel !== "normal"
    ).length;

    const agentsByLevel: Record<string, number> = {};
    this.degradationStates.forEach((state, _agentType) => {
      agentsByLevel[state.currentLevel] = (agentsByLevel[state.currentLevel] || 0) + 1;
    });

    const totalEvents = Array.from(this.degradationStates.values()).reduce(
      (sum, state) => sum + state.history.length,
      0
    );

    const completedRecoveries = Array.from(this.degradationStates.values())
      .filter((s) => s.recoveryStatus === "completed")
      .map((s) => {
        const startEvent = s.history.find((e) => e.type === "degradation_start");
        const endEvent = s.history.find((e) => e.type === "recovery_end");
        return startEvent && endEvent
          ? endEvent.timestamp.getTime() - startEvent.timestamp.getTime()
          : null;
      })
      .filter((time): time is number => time !== null);

    const avgRecoveryTime =
      completedRecoveries.length > 0
        ? completedRecoveries.reduce((sum, time) => sum + time, 0) / completedRecoveries.length
        : 0;

    const totalRequests = Array.from(this.degradationStates.values()).reduce(
      (sum, state) => sum + state.metrics.throughput,
      0
    );
    const totalFallbackUsage = Array.from(this.degradationStates.values()).reduce(
      (sum, state) => sum + state.metrics.fallbackUsage,
      0
    );
    const fallbackUsageRate = totalRequests > 0 ? totalFallbackUsage / totalRequests : 0;

    return {
      totalPolicies: this.degradationPolicies.size,
      activePolicies,
      degradedAgents,
      agentsByLevel,
      totalEvents,
      avgRecoveryTime,
      fallbackUsageRate,
    };
  }

  /**
   * Reset degradation manager
   */
  reset(): void {
    this.degradationStates.clear();
    this.initializeDefaultPolicies();
    logger.info("Agent degradation manager reset");
  }

  /**
   * Shutdown degradation manager
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info("Agent degradation manager shutdown");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get or create degradation state
   */
  private getOrCreateDegradationState(agentType: AgentType): DegradationState {
    if (!this.degradationStates.has(agentType)) {
      const state: DegradationState = {
        agentType,
        currentLevel: "normal",
        levelStartTime: new Date(),
        history: [],
        activeFallbacks: [],
        metrics: {
          errorRate: 0,
          responseTime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          throughput: 0,
          activeRequests: 0,
          degradedRequests: 0,
          fallbackUsage: 0,
        },
        recoveryStatus: "none",
      };

      this.degradationStates.set(agentType, state);
    }

    return this.degradationStates.get(agentType)!;
  }

  /**
   * Apply performance limits to request
   */
  private applyPerformanceLimits(request: AgentRequest, limits: PerformanceLimits): AgentRequest {
    // Check request size
    const requestSize = JSON.stringify(request).length;
    if (requestSize > limits.maxRequestSize) {
      throw new Error(`Request size ${requestSize} exceeds limit ${limits.maxRequestSize}`);
    }

    // Apply rate limiting (simplified - in production would use proper rate limiter)
    // This is a placeholder for rate limiting logic

    return request;
  }

  /**
   * Check if fallback should be used
   */
  private shouldUseFallback(
    request: AgentRequest,
    state: DegradationState,
    level: DegradationLevel
  ): { use: boolean; fallback?: FallbackBehavior } {
    // Check if any fallback behaviors match current conditions
    for (const fallback of level.fallbackBehaviors) {
      if (this.evaluateTrigger(fallback.trigger, state)) {
        return { use: true, fallback };
      }
    }

    return { use: false };
  }

  /**
   * Evaluate degradation trigger
   */
  private evaluateTrigger(trigger: DegradationTrigger, state: DegradationState): boolean {
    switch (trigger.type) {
      case "error_rate":
        return state.metrics.errorRate >= trigger.threshold;

      case "response_time":
        return state.metrics.responseTime >= trigger.threshold;

      case "memory_usage":
        return state.metrics.memoryUsage >= trigger.threshold;

      case "cpu_usage":
        return state.metrics.cpuUsage >= trigger.threshold;

      case "manual":
        return false; // Manual triggers are handled separately

      default:
        return false;
    }
  }

  /**
   * Execute fallback behavior
   */
  private async executeFallback(
    agent: IAgent,
    request: AgentRequest,
    fallback: FallbackBehavior
  ): Promise<AgentResponse> {
    logger.debug("Executing fallback", {
      agentType: agent.getAgentType(),
      fallbackId: fallback.id,
      action: fallback.action.type,
    });

    switch (fallback.action.type) {
      case "use_cache":
        return this.executeCachedResponse(agent, request, fallback.action.parameters);

      case "simplify_response":
        return this.executeSimplifiedResponse(agent, request, fallback.action.parameters);

      case "return_default":
        return this.executeDefaultResponse(agent, request, fallback.action.parameters);

      case "queue_request":
        return this.executeQueuedRequest(agent, request, fallback.action.parameters);

      case "redirect_agent":
        return this.executeRedirectedRequest(agent, request, fallback.action.parameters);

      default:
        throw new Error(`Unknown fallback action type: ${fallback.action.type}`);
    }
  }

  /**
   * Execute with reduced capabilities
   */
  private async executeWithReducedCapabilities(
    agent: IAgent,
    request: AgentRequest,
    level: DegradationLevel
  ): Promise<AgentResponse> {
    // Apply capability reductions
    let modifiedRequest = request;

    for (const reduction of level.capabilityReductions) {
      modifiedRequest = this.applyCapabilityReduction(modifiedRequest, reduction);
    }

    // Execute with timeout
    const timeout = level.performanceLimits.maxResponseTime;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Agent execution timeout after ${timeout}ms`));
      }, timeout);

      agent
        .execute(modifiedRequest)
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
   * Apply capability reduction
   */
  private applyCapabilityReduction(
    request: AgentRequest,
    reduction: CapabilityReduction
  ): AgentRequest {
    switch (reduction.type) {
      case "simplify":
        // Simplify request parameters
        return {
          ...request,
          parameters: this.simplifyParameters(request.parameters || {}),
        };

      case "limit":
        // Limit request scope
        return {
          ...request,
          parameters: this.limitParameters(request.parameters || {}, reduction.parameters),
        };

      case "cache":
        // Use cached data if available
        return {
          ...request,
          parameters: {
            ...request.parameters,
            useCache: true,
          },
        };

      default:
        return request;
    }
  }

  /**
   * Handle error with degradation
   */
  private async handleErrorWithDegradation(
    agent: IAgent,
    request: AgentRequest,
    error: Error,
    state: DegradationState,
    policy: DegradationPolicy
  ): Promise<{ response?: AgentResponse; fallbackUsed: boolean; error?: Error }> {
    logger.error("Agent execution failed, attempting degradation", {
      agentType: agent.getAgentType(),
      error: error.message,
      currentLevel: state.currentLevel,
    });

    // Try to escalate degradation level
    const currentLevelIndex = policy.levels.findIndex((l) => l.name === state.currentLevel);
    const nextLevel = policy.levels[currentLevelIndex + 1];

    if (nextLevel) {
      this.triggerDegradation(
        agent.getAgentType(),
        nextLevel.name,
        `Error escalation: ${error.message}`
      );

      // Retry with higher degradation level
      try {
        const response = await this.executeWithReducedCapabilities(agent, request, nextLevel);
        return { response, fallbackUsed: false };
      } catch (retryError) {
        // If retry also fails, try fallbacks
        const fallbackResult = this.shouldUseFallback(request, state, nextLevel);
        if (fallbackResult.use && fallbackResult.fallback) {
          const fallbackResponse = await this.executeFallback(
            agent,
            request,
            fallbackResult.fallback
          );
          return { response: fallbackResponse, fallbackUsed: true };
        }
      }
    }

    // Final fallback - return error with degraded response
    return { error, fallbackUsed: false };
  }

  /**
   * Fallback execution methods
   */
  private async executeCachedResponse(
    agent: IAgent,
    request: AgentRequest,
    parameters: Record<string, unknown>
  ): Promise<AgentResponse> {
    // Simplified cache implementation
    // In production, would use proper caching system
    return {
      success: true,
      confidence: "medium" as const,
      metadata: {
        executionId: uuidv4(),
        agentType: agent.getAgentType(),
        startTime: new Date(),
        endTime: new Date(),
        duration: 100,
        tokenUsage: { input: 0, output: 0, total: 0, cost: 0 },
        cacheHit: true,
        retryCount: 0,
        circuitBreakerTripped: false,
      },
      data: {
        message: "Cached response",
        cached: true,
      },
    };
  }

  private async executeSimplifiedResponse(
    agent: IAgent,
    request: AgentRequest,
    parameters: Record<string, unknown>
  ): Promise<AgentResponse> {
    return {
      success: true,
      confidence: "low" as const,
      metadata: {
        executionId: uuidv4(),
        agentType: agent.getAgentType(),
        startTime: new Date(),
        endTime: new Date(),
        duration: 50,
        tokenUsage: { input: 0, output: 0, total: 0, cost: 0 },
        cacheHit: false,
        retryCount: 0,
        circuitBreakerTripped: false,
      },
      data: {
        message: "Simplified response due to degradation",
        simplified: true,
      },
    };
  }

  private async executeDefaultResponse(
    agent: IAgent,
    request: AgentRequest,
    parameters: Record<string, unknown>
  ): Promise<AgentResponse> {
    return {
      success: false,
      confidence: "low" as const,
      metadata: {
        executionId: uuidv4(),
        agentType: agent.getAgentType(),
        startTime: new Date(),
        endTime: new Date(),
        duration: 10,
        tokenUsage: { input: 0, output: 0, total: 0, cost: 0 },
        cacheHit: false,
        retryCount: 0,
        circuitBreakerTripped: false,
      },
      data: {
        message: "Default response due to service degradation",
        degraded: true,
      },
    };
  }

  private async executeQueuedRequest(
    agent: IAgent,
    request: AgentRequest,
    parameters: Record<string, unknown>
  ): Promise<AgentResponse> {
    // Simplified queuing implementation
    throw new Error("Request queued due to degradation - please try again later");
  }

  private async executeRedirectedRequest(
    agent: IAgent,
    request: AgentRequest,
    parameters: Record<string, unknown>
  ): Promise<AgentResponse> {
    // Simplified redirection implementation
    throw new Error("Request redirected due to degradation");
  }

  /**
   * Utility methods
   */
  private simplifyParameters(parameters: Record<string, unknown>): Record<string, unknown> {
    // Simplify parameters by removing complex nested objects
    const simplified: Record<string, unknown> = {};

    Object.entries(parameters).forEach(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        simplified[key] = value;
      } else {
        simplified[key] = String(value);
      }
    });

    return simplified;
  }

  private limitParameters(
    parameters: Record<string, unknown>,
    limits: Record<string, unknown>
  ): Record<string, unknown> {
    // Apply parameter limits
    const limited: Record<string, unknown> = { ...parameters };

    Object.entries(limits).forEach(([key, limit]) => {
      if (key in limited) {
        const value = limited[key];
        if (typeof value === "string" && typeof limit === "number") {
          limited[key] = value.substring(0, limit as number);
        }
      }
    });

    return limited;
  }

  /**
   * Notify users of degradation
   */
  private notifyDegradation(agentType: AgentType, level: DegradationLevel, reason: string): void {
    level.userNotifications.forEach((notification) => {
      if (notification.showToUser) {
        logger.warn("User notification", {
          type: notification.type,
          message: notification.message,
          agentType,
          level: level.name,
          reason,
        });

        // In production, would send to actual notification system
        // This could be WebSocket, email, Slack, etc.
      }
    });
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.monitoringIntervalMs);
  }

  /**
   * Perform health checks and auto-degradation
   */
  private async performHealthChecks(): Promise<void> {
    for (const [agentType, state] of this.degradationStates.entries()) {
      const policy = this.getDegradationPolicy(agentType);
      if (!policy || !policy.autoDegradation.enabled) continue;

      // Update metrics
      this.updateMetrics(agentType, state);

      // Check auto-degradation triggers
      for (const trigger of policy.autoDegradation.triggers) {
        if (this.evaluateTrigger(trigger, state)) {
          const currentLevelIndex = policy.levels.findIndex((l) => l.name === state.currentLevel);
          const maxLevelIndex = policy.levels.findIndex(
            (l) => l.name === policy.autoDegradation.maxLevel
          );

          if (currentLevelIndex < maxLevelIndex) {
            const nextLevel = policy.levels[currentLevelIndex + 1];
            this.triggerDegradation(
              agentType,
              nextLevel.name,
              `Auto-degradation: ${trigger.type} threshold exceeded`
            );
          }
        }
      }

      // Check recovery triggers
      if (policy.recovery.enabled && state.currentLevel !== "normal") {
        for (const trigger of policy.recovery.triggers) {
          if (this.evaluateRecoveryTrigger(trigger, state)) {
            this.triggerRecovery(agentType, `Auto-recovery: ${trigger.type} condition met`);
          }
        }
      }
    }
  }

  /**
   * Update degradation metrics
   */
  private updateMetrics(agentType: AgentType, state: DegradationState): void {
    // This would integrate with actual metrics collection
    // For now, simulate metrics updates
    const telemetrySummary = agentTelemetryService.getTelemetrySummary(agentType);

    state.metrics.errorRate = telemetrySummary.errorRate;
    state.metrics.responseTime = telemetrySummary.avgExecutionTime;
    state.metrics.throughput = telemetrySummary.totalExecutions;
  }

  /**
   * Evaluate recovery trigger
   */
  private evaluateRecoveryTrigger(trigger: RecoveryTrigger, state: DegradationState): boolean {
    switch (trigger.type) {
      case "health_improvement":
        return state.metrics.errorRate < trigger.threshold;

      case "load_reduction":
        return state.metrics.activeRequests < trigger.threshold;

      case "time_based":
        const timeInLevel = Date.now() - state.levelStartTime.getTime();
        return timeInLevel > trigger.duration;

      default:
        return false;
    }
  }

  /**
   * Initialize default degradation policies
   */
  private initializeDefaultPolicies(): void {
    const normalLevel: DegradationLevel = {
      name: "normal",
      priority: 0,
      description: "Normal operation with full capabilities",
      disabledCapabilities: [],
      capabilityReductions: [],
      performanceLimits: {
        maxConcurrentRequests: 100,
        maxRequestSize: 1000000,
        maxResponseTime: 30000,
        maxMemoryUsage: 512,
        rateLimiting: {
          requestsPerSecond: 100,
          requestsPerMinute: 6000,
          burstAllowance: 10,
        },
      },
      fallbackBehaviors: [],
      userNotifications: [],
    };

    const degradedLevel: DegradationLevel = {
      name: "degraded",
      priority: 1,
      description: "Degraded operation with reduced capabilities",
      disabledCapabilities: ["advanced_analytics", "real_time_processing"],
      capabilityReductions: [
        {
          capabilityId: "response_generation",
          type: "simplify",
          parameters: { maxLength: 500 },
          reason: "Performance optimization",
        },
      ],
      performanceLimits: {
        maxConcurrentRequests: 50,
        maxRequestSize: 500000,
        maxResponseTime: 15000,
        maxMemoryUsage: 256,
        rateLimiting: {
          requestsPerSecond: 50,
          requestsPerMinute: 3000,
          burstAllowance: 5,
        },
      },
      fallbackBehaviors: [
        {
          id: "cache_fallback",
          trigger: {
            type: "response_time",
            threshold: 10000,
            duration: 30000,
          },
          action: {
            type: "use_cache",
            parameters: { ttl: 300 },
            description: "Use cached response when response time is high",
          },
          priority: 1,
          timeout: 5000,
        },
      ],
      userNotifications: [
        {
          id: "degradation_warning",
          type: "warning",
          message: "Service is running in degraded mode. Some features may be limited.",
          showToUser: true,
          duration: 30000,
        },
      ],
    };

    const criticalLevel: DegradationLevel = {
      name: "critical",
      priority: 2,
      description: "Critical degradation with minimal capabilities",
      disabledCapabilities: ["advanced_analytics", "real_time_processing", "complex_calculations"],
      capabilityReductions: [
        {
          capabilityId: "response_generation",
          type: "simplify",
          parameters: { maxLength: 100 },
          reason: "Critical performance constraints",
        },
      ],
      performanceLimits: {
        maxConcurrentRequests: 10,
        maxRequestSize: 100000,
        maxResponseTime: 5000,
        maxMemoryUsage: 128,
        rateLimiting: {
          requestsPerSecond: 10,
          requestsPerMinute: 600,
          burstAllowance: 2,
        },
      },
      fallbackBehaviors: [
        {
          id: "default_fallback",
          trigger: {
            type: "error_rate",
            threshold: 0.5,
            duration: 60000,
          },
          action: {
            type: "return_default",
            parameters: {},
            description: "Return default response when error rate is high",
          },
          priority: 1,
          timeout: 1000,
        },
      ],
      userNotifications: [
        {
          id: "critical_warning",
          type: "error",
          message: "Service is experiencing critical issues. Functionality is severely limited.",
          showToUser: true,
          duration: 60000,
        },
      ],
    };

    const defaultPolicy: DegradationPolicy = {
      id: "default-degradation-policy",
      name: "Default Degradation Policy",
      description: "Default degradation policy for all agents",
      agentTypes: ["opportunity", "target", "expansion", "integrity", "realization"],
      levels: [normalLevel, degradedLevel, criticalLevel],
      autoDegradation: {
        enabled: true,
        triggers: [
          {
            type: "error_rate",
            threshold: 0.1,
            duration: 60000,
          },
          {
            type: "response_time",
            threshold: 10000,
            duration: 30000,
          },
        ],
        cooldownPeriod: 300000,
        maxLevel: "critical",
        historyRetention: 100,
      },
      recovery: {
        enabled: true,
        triggers: [
          {
            type: "health_improvement",
            threshold: 0.05,
            duration: 120000,
          },
          {
            type: "time_based",
            threshold: 0,
            duration: 300000,
          },
        ],
        strategy: "gradual",
        requireConfirmation: false,
        cooldownPeriod: 60000,
      },
      monitoring: {
        healthCheckInterval: 30000,
        metricsInterval: 10000,
        alertThresholds: {
          errorRate: 0.1,
          responseTime: 10000,
          memoryUsage: 80,
          cpuUsage: 80,
        },
        notifications: {
          enabled: true,
          channels: ["console"],
          recipients: ["admin"],
          templates: {},
        },
      },
      enabled: true,
    };

    this.degradationPolicies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation in MB
    const policiesSize = this.degradationPolicies.size * 0.05; // ~50KB per policy
    const statesSize = this.degradationStates.size * 0.01; // ~10KB per state

    return policiesSize + statesSize;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentDegradationManager = AgentDegradationManager.getInstance();

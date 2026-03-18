/**
 * Agent Retry Types
 *
 * Interfaces and type aliases for the AgentRetryManager.
 * Extracted from AgentRetryManager.ts to keep the implementation file focused
 * on retry orchestration logic.
 */

import type { AgentType } from "../../agent-types.js";
import type { AgentResponse } from "../core/IAgent.js";
import type { IAgent } from "../core/IAgent.js";

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
  requestId: string;
  sessionId?: string;
  userId?: string;
  organizationId?: string;
  priority: "low" | "medium" | "high" | "critical";
  source: string;
  metadata?: Record<string, unknown>;
}

export interface RetryAttempt {
  attempt: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: RetryError;
  agentType: AgentType;
  response?: AgentResponse;
  delay: number;
}

export interface RetryError {
  type: string;
  message: string;
  code?: string;
  stack?: string;
  retryable: boolean;
  severity: "low" | "medium" | "high" | "critical";
  context?: Record<string, unknown>;
  timestamp: Date;
}

export interface RetryResult {
  requestId: string;
  success: boolean;
  response?: AgentResponse;
  error?: RetryError;
  totalAttempts: number;
  attempts: RetryAttempt[];
  totalDuration: number;
  successfulAgentType?: AgentType;
  fallbackUsed: boolean;
  strategy: RetryStrategy;
  statistics: RetryStatistics;
}

export interface RetryStatistics {
  avgAttemptDuration: number;
  totalRetryDelay: number;
  successRateByAttempt: Record<number, number>;
  errorDistribution: Record<string, number>;
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
  agentType: AgentType;
  agent: IAgent;
  priority: number;
  successRate: number;
  avgResponseTime: number;
  lastUsed?: Date;
  health: "healthy" | "degraded" | "unhealthy";
}

export interface RetryPolicy {
  id: string;
  name: string;
  description: string;
  agentTypes: AgentType[];
  defaultOptions: RetryOptions;
  errorMappings: Record<
    string,
    {
      retryable: boolean;
      maxRetries?: number;
      backoffMultiplier?: number;
      fallbackAgents?: AgentType[];
    }
  >;
  conditions: RetryPolicyCondition[];
  enabled: boolean;
}

export interface RetryPolicyCondition {
  id: string;
  type: "time_of_day" | "load_level" | "error_rate" | "priority" | "custom";
  parameters: Record<string, unknown>;
  overrideOptions: Partial<RetryOptions>;
  enabled: boolean;
}

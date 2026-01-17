/**
 * Unified Agent Interface
 *
 * CONSOLIDATION: This interface consolidates all agent implementations
 * into a single, consistent contract that all agents must implement.
 *
 * Replaces fragmented agent patterns across the codebase with a unified approach.
 */

import { AgentType } from "../../agent-types";
import { ConfidenceLevel } from "../../../types/agent";

// ============================================================================
// Core Types
// ============================================================================

export interface AgentRequest {
  /** Agent type to invoke */
  agentType: AgentType;
  /** Query or prompt for the agent */
  query: string;
  /** Session ID for tracking and context */
  sessionId?: string;
  /** User ID making the request */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Additional context data */
  context?: Record<string, any>;
  /** Request parameters */
  parameters?: Record<string, unknown>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

export interface AgentResponse<T = unknown> {
  /** Response success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Agent confidence in the response */
  confidence: ConfidenceLevel;
  /** Execution metadata */
  metadata: AgentExecutionMetadata;
  /** Error information if failed */
  error?: AgentError;
  /** Reasoning trace for explainability */
  reasoning?: ReasoningTrace;
  /** Suggested next actions */
  nextActions?: AgentNextAction[];
}

export interface AgentExecutionMetadata {
  /** Unique execution ID */
  executionId: string;
  /** Agent type that executed */
  agentType: AgentType;
  /** Execution start time */
  startTime: Date;
  /** Execution end time */
  endTime: Date;
  /** Total execution duration in milliseconds */
  duration: number;
  /** Token usage information */
  tokenUsage: TokenUsage;
  /** Cache hit status */
  cacheHit: boolean;
  /** Number of retries attempted */
  retryCount: number;
  /** Circuit breaker state */
  circuitBreakerTripped: boolean;
}

export interface TokenUsage {
  /** Input tokens consumed */
  input: number;
  /** Output tokens generated */
  output: number;
  /** Total tokens */
  total: number;
  /** Cost in USD */
  cost: number;
}

export interface AgentError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error information */
  details?: Record<string, unknown>;
  /** Stack trace for debugging */
  stack?: string;
  /** Whether the error is retryable */
  retryable: boolean;
}

export interface ReasoningTrace {
  /** Step-by-step reasoning process */
  steps: ReasoningStep[];
  /** Assumptions made during reasoning */
  assumptions: ReasoningAssumption[];
  /** Sources used in reasoning */
  sources: ReasoningSource[];
  /** Final confidence calculation */
  confidenceCalculation: string;
}

export interface ReasoningStep {
  /** Step number */
  step: number;
  /** Step description */
  description: string;
  /** Input to this step */
  input: unknown;
  /** Output from this step */
  output: unknown;
  /** Reasoning method used */
  method: string;
  /** Confidence in this step */
  confidence: ConfidenceLevel;
}

export interface ReasoningAssumption {
  /** Assumption ID */
  id: string;
  /** Assumption description */
  description: string;
  /** Assumption value */
  value: unknown;
  /** Source of assumption */
  source: string;
  /** Confidence in assumption */
  confidence: ConfidenceLevel;
}

export interface ReasoningSource {
  /** Source ID */
  id: string;
  /** Source type */
  type: "database" | "api" | "document" | "benchmark" | "user_input";
  /** Source URL or reference */
  reference: string;
  /** Source reliability score */
  reliability: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

export interface AgentNextAction {
  /** Action ID */
  id: string;
  /** Action type */
  type: "continue" | "clarify" | "escalate" | "complete" | "retry";
  /** Action description */
  description: string;
  /** Parameters for the action */
  parameters?: Record<string, unknown>;
  /** Priority of the action */
  priority: "low" | "medium" | "high" | "critical";
}

// ============================================================================
// Agent Capabilities
// ============================================================================

export interface AgentCapability {
  /** Capability ID */
  id: string;
  /** Capability name */
  name: string;
  /** Capability description */
  description: string;
  /** Capability category */
  category: CapabilityCategory;
  /** Supported input types */
  inputTypes: string[];
  /** Supported output types */
  outputTypes: string[];
  /** Maximum input size */
  maxInputSize?: number;
  /** Estimated execution time */
  estimatedDuration?: number;
  /** Required permissions */
  requiredPermissions: string[];
  /** Whether capability is currently enabled */
  enabled: boolean;
}

export type CapabilityCategory =
  | "analysis"
  | "generation"
  | "validation"
  | "calculation"
  | "research"
  | "communication"
  | "coordination"
  | "monitoring";

// ============================================================================
// Agent Metadata
// ============================================================================

export interface AgentMetadata {
  /** Agent type */
  type: AgentType;
  /** Agent name */
  name: string;
  /** Agent description */
  description: string;
  /** Agent version */
  version: string;
  /** Agent capabilities */
  capabilities: AgentCapability[];
  /** Supported input schemas */
  inputSchemas: Record<string, unknown>;
  /** Supported output schemas */
  outputSchemas: Record<string, unknown>;
  /** Agent configuration */
  configuration: AgentConfiguration;
  /** Health status */
  health: AgentHealthStatus;
  /** Performance metrics */
  performance: AgentPerformanceMetrics;
}

export interface AgentConfiguration {
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry backoff strategy */
  retryStrategy: "exponential" | "linear" | "fixed";
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Rate limits */
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  /** Circuit breaker thresholds */
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
}

export interface AgentHealthStatus {
  /** Overall health status */
  status: "healthy" | "degraded" | "offline" | "unknown";
  /** Last health check timestamp */
  lastCheck: Date;
  /** Response time in milliseconds */
  responseTime: number;
  /** Error rate percentage */
  errorRate: number;
  /** Uptime percentage */
  uptime: number;
  /** Active connections */
  activeConnections: number;
}

export interface AgentPerformanceMetrics {
  /** Average response time */
  avgResponseTime: number;
  /** 95th percentile response time */
  p95ResponseTime: number;
  /** Success rate percentage */
  successRate: number;
  /** Requests per minute */
  requestsPerMinute: number;
  /** Average token usage per request */
  avgTokenUsage: number;
  /** Cost per request */
  costPerRequest: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Normalized input */
  normalizedInput?: unknown;
}

export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Field that caused the error */
  field?: string;
  /** Invalid value */
  value?: unknown;
  /** Expected value or format */
  expected?: string;
}

export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Field that caused the warning */
  field?: string;
  /** Warning value */
  value?: unknown;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// Main Agent Interface
// ============================================================================

/**
 * Unified Agent Interface
 *
 * All agents in the ValueOS system must implement this interface
 * to ensure consistency and interoperability.
 */
export interface IAgent {
  /**
   * Execute the agent with the given request
   *
   * @param request - The agent request
   * @returns Promise resolving to agent response
   */
  execute<T = unknown>(request: AgentRequest): Promise<AgentResponse<T>>;

  /**
   * Get the agent's capabilities
   *
   * @returns Array of agent capabilities
   */
  getCapabilities(): AgentCapability[];

  /**
   * Validate input for the agent
   *
   * @param input - Input to validate
   * @returns Validation result
   */
  validateInput(input: unknown): ValidationResult;

  /**
   * Get agent metadata
   *
   * @returns Agent metadata
   */
  getMetadata(): AgentMetadata;

  /**
   * Check if the agent is healthy
   *
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<AgentHealthStatus>;

  /**
   * Get the agent's configuration
   *
   * @returns Agent configuration
   */
  getConfiguration(): AgentConfiguration;

  /**
   * Update the agent's configuration
   *
   * @param config - New configuration
   * @returns Promise resolving when configuration is updated
   */
  updateConfiguration(config: Partial<AgentConfiguration>): Promise<void>;

  /**
   * Get performance metrics for the agent
   *
   * @returns Performance metrics
   */
  getPerformanceMetrics(): AgentPerformanceMetrics;

  /**
   * Reset the agent's state
   *
   * @returns Promise resolving when agent is reset
   */
  reset(): Promise<void>;

  /**
   * Get the agent's type
   *
   * @returns Agent type
   */
  getAgentType(): AgentType;

  /**
   * Check if the agent supports a specific capability
   *
   * @param capabilityId - Capability ID to check
   * @returns Whether the capability is supported
   */
  supportsCapability(capabilityId: string): boolean;

  /**
   * Get the agent's input schema
   *
   * @returns Input schema
   */
  getInputSchema(): Record<string, unknown>;

  /**
   * Get the agent's output schema
   *
   * @returns Output schema
   */
  getOutputSchema(): Record<string, unknown>;
}

// ============================================================================
// Agent Factory Interface
// ============================================================================

/**
 * Agent Factory Interface
 *
 * Defines the contract for creating agents
 */
export interface IAgentFactory {
  /**
   * Create an agent of the given type
   *
   * @param agentType - Type of agent to create
   * @param config - Agent configuration
   * @returns Promise resolving to created agent
   */
  createAgent(agentType: AgentType, config?: Partial<AgentConfiguration>): Promise<IAgent>;

  /**
   * Get supported agent types
   *
   * @returns Array of supported agent types
   */
  getSupportedAgentTypes(): AgentType[];

  /**
   * Check if an agent type is supported
   *
   * @param agentType - Agent type to check
   * @returns Whether the agent type is supported
   */
  supportsAgentType(agentType: AgentType): boolean;

  /**
   * Get default configuration for an agent type
   *
   * @param agentType - Agent type
   * @returns Default configuration
   */
  getDefaultConfiguration(agentType: AgentType): AgentConfiguration;
}

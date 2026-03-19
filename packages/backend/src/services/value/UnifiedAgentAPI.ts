/**
 * Unified Agent API
 *
 * CONSOLIDATION: This module provides a unified entry point for all agent
 * invocations, consolidating:
 * - AgentAPI (HTTP client with circuit breaker)
 * - AgentFabricService (fabric processing)
 * - AgentQueryService (query handling)
 *
 * Key Features:
 * - Single circuit breaker per agent type
 * - Automatic routing between HTTP and fabric agents
 * - Consistent response format
 * - Full observability and audit logging
 */

import { env, getEnvVar, getGroundtruthConfig } from "@shared/lib/env";
import { SDUIPageDefinition, validateSDUISchema } from "@valueos/sdui";
import { v4 as uuidv4 } from "uuid";

import { AgentFactory } from "../lib/agent-fabric/AgentFactory.js";
import { logger } from "../lib/logger.js"
import { AgentHealthStatus, ConfidenceLevel } from "../types/agent";
import type { LifecycleContext } from "../types/agent.js";
import { getAgentCache, type AgentCache } from "../cache/AgentCache.js";
import { ReadThroughCacheService } from "../cache/ReadThroughCacheService.js";

import { AgentType } from "./agent-types.js"
import { getAuditLogger, logAgentResponse } from "./AgentAuditLogger.js"
import { AgentRecord, AgentRegistry } from "./AgentRegistry.js"
import { CircuitBreakerManager } from "./CircuitBreaker.js"
import {
  GroundtruthAPI,
  GroundtruthAPIConfig,
  GroundtruthRequestOptions,
  GroundtruthRequestPayload,
} from "./GroundtruthAPI";

// ============================================================================
// Types
// ============================================================================

/**
 * Unified agent request
 */
export interface UnifiedAgentRequest {
  /** Agent type to invoke */
  agent: AgentType;
  /** Query or prompt */
  query: string;
  /** Session ID for tracking */
  sessionId?: string;
  /** User ID */
  userId?: string;
  /** Additional context */
  context?: Record<string, any>;
  /** Request parameters */
  parameters?: Record<string, any>;
  /** Groundtruth integration options */
  groundtruth?: GroundtruthInvocationOptions;
  /** Trace ID for observability */
  traceId?: string;
  /** Idempotency key for duplicate request prevention */
  idempotencyKey?: string;
}

/**
 * Unified agent response
 */
export interface UnifiedAgentResponse<T = any> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Confidence level */
  confidenceLevel?: ConfidenceLevel;
  /** Confidence score (0-1) */
  confidenceScore?: number;
  /** Content (for message responses) */
  content?: string;
  /** Next workflow stage */
  nextStage?: string;
  /** Response type */
  type?: "component" | "message" | "suggestion" | "sdui-page";
  /** Response payload */
  payload?: unknown;
  /** Status (for workflow) */
  status?: string;
  /** Response metadata */
  metadata?: {
    agent: AgentType;
    duration: number;
    timestamp: string;
    model?: string;
    traceId: string;
    cached?: boolean;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
  /** Warnings */
  warnings?: string[];
}

export interface GroundtruthInvocationOptions {
  enabled?: boolean;
  endpoint?: string;
  mergeKey?: string;
  payload?: Partial<GroundtruthRequestPayload>;
  requestOptions?: GroundtruthRequestOptions;
}

/**
 * API configuration
 */
export interface UnifiedAPIConfig {
  /** Base URL for HTTP agents */
  baseUrl?: string;
  /** Request timeout (ms) */
  timeout?: number;
  /** Enable circuit breaker */
  enableCircuitBreaker?: boolean;
  /** Circuit breaker failure threshold */
  failureThreshold?: number;
  /** Circuit breaker cooldown (ms) */
  cooldownPeriod?: number;
  /** Enable audit logging */
  enableAuditLogging?: boolean;
  /** Groundtruth API configuration */
  groundtruth?: GroundtruthAPIConfig;
  /** Agent factory for local fabric agent execution (resolved from DI if not provided) */
  agentFactory?: AgentFactory;
}

const DEFAULT_CONFIG: UnifiedAPIConfig = {
  timeout: 30000,
  enableCircuitBreaker: true,
  failureThreshold: 5,
  cooldownPeriod: 60000,
  enableAuditLogging: true,
};

const PRODUCTION_ROUTING_ERROR =
  "Mock routing is disabled in production. Configure baseUrl or agent endpoints.";

/**
 * Sanitize user input for LLM prompts to prevent injection attacks
 */
function sanitizeForPrompt(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  return input
    .replace(/<system>/gi, "[SYSTEM]")
    .replace(/<\/system>/gi, "[/SYSTEM]")
    .replace(/<user_input>/gi, "[USER_INPUT]")
    .replace(/<\/user_input>/gi, "[/USER_INPUT]")
    .replace(/<instruction>/gi, "[INSTRUCTION]")
    .replace(/<\/instruction>/gi, "[/INSTRUCTION]")
    .replace(/ignore previous/gi, "[FILTERED]")
    .replace(/system prompt/gi, "[FILTERED]")
    .substring(0, 2000); // Hard limit on input length
}

/**
 * Validate and sanitize agent request
 */
function validateAndSanitizeRequest(
  request: UnifiedAgentRequest
): UnifiedAgentRequest {
  if (
    !request.query ||
    typeof request.query !== "string" ||
    request.query.trim().length === 0
  ) {
    throw new Error("Query is required and must be a non-empty string");
  }

  if (request.query.length > 2000) {
    throw new Error("Query exceeds maximum length of 2000 characters");
  }

  // Sanitize the query
  const sanitizedQuery = sanitizeForPrompt(request.query);

  return {
    ...request,
    query: sanitizedQuery,
  };
}

// ============================================================================
// Unified Agent API Class
// ============================================================================

/**
 * Unified Agent API
 *
 * Provides a single interface for invoking all agents with:
 * - Circuit breaker protection
 * - Automatic routing
 * - Consistent error handling
 * - Full observability
 */
export class UnifiedAgentAPI {
  private static readonly AGENT_OUTPUT_NAMESPACE = "unified-agent.output";
  private static readonly AGENT_OUTPUT_NEAR_CACHE = {
    enabled: process.env.UNIFIED_AGENT_OUTPUT_NEAR_CACHE_ENABLED !== "false",
    ttlMs: 5_000,
    maxEntries: 16,
  } as const;
  private static readonly IDEMPOTENCY_NAMESPACE = "unified-agent.idempotency";
  private static readonly IDEMPOTENCY_TTL_SECONDS = 120;
  private config: UnifiedAPIConfig;
  private circuitBreakers: CircuitBreakerManager;
  private registry: AgentRegistry;
  private auditLogger: ReturnType<typeof getAuditLogger> | null = null;
  private groundtruthAPI: GroundtruthAPI | null = null;
  private agentFactory: AgentFactory | null = null;
  private readonly idempotencyCache: AgentCache;

  constructor(config: Partial<UnifiedAPIConfig> = {}) {
    // NOTE: Environment variable precedence for agent API base URL:
    // - VITE_AGENT_API_URL: used in Vite/client-side bundles (must be VITE_-prefixed to be exposed)
    // - AGENT_API_URL: used in server-side / non-Vite contexts (e.g., Node services, tests)
    // If both are set, VITE_AGENT_API_URL takes precedence so client and server can share
    // a consistent default while still allowing explicit overrides via config.baseUrl.
    const envBaseUrl =
      getEnvVar("VITE_AGENT_API_URL") || getEnvVar("AGENT_API_URL");
    const resolvedBaseUrl = config.baseUrl ?? envBaseUrl;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      baseUrl: resolvedBaseUrl || undefined,
    };
    this.circuitBreakers = new CircuitBreakerManager({
      failureRateThreshold: (this.config.failureThreshold || 5) / 10,
      latencyThresholdMs: 2000,
      minimumSamples: 5,
      timeoutMs: this.config.timeout || 30000,
    });
    this.registry = new AgentRegistry();
    this.idempotencyCache = getAgentCache({
      l1Enabled: process.env.UNIFIED_AGENT_IDEMPOTENCY_NEAR_CACHE_ENABLED !== "false",
      l1DefaultTtl: 10,
      l1MaxEntries: 64,
      l1MaxSize: 4,
      l2Enabled: true,
      l2DefaultTtl: UnifiedAgentAPI.IDEMPOTENCY_TTL_SECONDS,
      l2KeyPrefix: "unified-agent-cache:",
    });

    if (this.config.enableAuditLogging) {
      this.auditLogger = getAuditLogger();
    }

    const groundtruthEnv = getGroundtruthConfig();
    const groundtruthConfig = {
      baseUrl: groundtruthEnv.apiUrl,
      apiKey: groundtruthEnv.apiKey,
      timeoutMs: groundtruthEnv.timeout,
      ...config.groundtruth,
    };
    this.groundtruthAPI = groundtruthConfig.baseUrl
      ? new GroundtruthAPI(groundtruthConfig)
      : null;

    // Resolve AgentFactory from explicit config; otherwise stays null
    // and executeLocalAgent falls back to mock.
    if (config.agentFactory) {
      this.agentFactory = config.agentFactory;
    }
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Invoke an agent with unified request/response format
   */
  async invoke<T = any>(
    request: UnifiedAgentRequest
  ): Promise<UnifiedAgentResponse<T>> {
    const traceId = request.traceId || uuidv4();
    const startTime = Date.now();

    logger.info("Agent invocation started", {
      traceId,
      agent: request.agent,
      sessionId: request.sessionId,
    });

    // Validate and sanitize the request
    let sanitizedRequest: UnifiedAgentRequest;
    try {
      sanitizedRequest = validateAndSanitizeRequest(request);
    } catch (error) {
      logger.warn("Request validation failed", {
        traceId,
        agent: request.agent,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
        metadata: {
          agent: request.agent,
          duration: 0,
          timestamp: new Date().toISOString(),
          traceId,
        },
      };
    }

    try {
      this.assertRoutingConfigured(request.agent);
      const tenantId = this.getTenantId(sanitizedRequest);

      // Add idempotency check before cache
      if (request.idempotencyKey) {
        const existingResponse = await this.checkIdempotency(
          tenantId,
          request.idempotencyKey
        );
        if (existingResponse) {
          return existingResponse;
        }
      }

      // Cache agent outputs via ReadThroughCacheService (tenant-scoped Redis). ADR-0012.
      const result = await ReadThroughCacheService.getOrLoad<UnifiedAgentResponse<T>>(
        {
          endpoint: `agent-outputs/${request.agent}`,
          namespace: UnifiedAgentAPI.AGENT_OUTPUT_NAMESPACE,
          tenantId,
          scope: request.agent,
          tier: "hot",
          nearCache: UnifiedAgentAPI.AGENT_OUTPUT_NEAR_CACHE,
          keyPayload: this.generateAgentCacheKey(sanitizedRequest),
        },
        async () => {
          const circuitBreakerKey = `agent-${request.agent}`;
          const response = await this.circuitBreakers.execute(
            circuitBreakerKey,
            () => this.executeAgentRequest(sanitizedRequest, traceId),
            {
              timeoutMs: this.config.timeout,
              failureRateThreshold: (this.config.failureThreshold || 5) / 10,
            }
          );

          const enrichedResponse = await this.attachGroundtruth(
            sanitizedRequest,
            response,
            traceId
          );
          const duration = Date.now() - startTime;

          return {
            ...enrichedResponse,
            metadata: {
              agent: request.agent,
              duration,
              timestamp: new Date().toISOString(),
              traceId,
              cached: false,
              ...enrichedResponse.metadata,
            },
          };
        }
      );

      // Stamp traceId on cached responses
      if (result.metadata) {
        result.metadata.traceId = traceId;
      }

      // Log to audit
      if (this.auditLogger) {
        await logAgentResponse(
          request.agent,
          request.query,
          result.success,
          result.data,
          result.metadata,
          result.error
        );
      }

      logger.info("Agent invocation completed", {
        traceId,
        agent: request.agent,
        duration: Date.now() - startTime,
        success: result.success,
        cached: false,
      });

      // Store response in idempotency cache if idempotency key was provided
      if (request.idempotencyKey) {
        await this.storeIdempotencyResponse(
          tenantId,
          request.idempotencyKey,
          result
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        "Agent invocation failed",
        error instanceof Error ? error : undefined,
        {
          traceId,
          agent: request.agent,
          duration,
        }
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agent: request.agent,
          duration,
          timestamp: new Date().toISOString(),
          traceId,
          cached: false,
        },
      };
    }
  }

  // ... rest of the code remains the same ...
  /**
   * Call agent (alias for invoke with simplified response)
   */
  async callAgent(
    agent: AgentType,
    query: string,
    context?: Record<string, any>
  ): Promise<UnifiedAgentResponse> {
    return this.invoke({
      agent,
      query,
      context,
    });
  }

  /**
   * Generate SDUI page
   */
  async generateSDUIPage(
    agent: AgentType,
    query: string,
    context?: Record<string, any>
  ): Promise<UnifiedAgentResponse<SDUIPageDefinition>> {
    const response = await this.invoke<SDUIPageDefinition>({
      agent,
      query,
      context,
      parameters: { outputType: "sdui" },
    });

    // Validate SDUI schema if successful
    if (response.success && response.data) {
      const validation = validateSDUISchema(response.data);
      if (!validation.success) {
        response.warnings = validation.errors || [];
      }
    }

    return response;
  }

  /**
   * Health check for an agent
   */
  async checkAgentHealth(agent: AgentType): Promise<{
    status: AgentHealthStatus;
    latencyMs: number;
    circuitBreakerState: string;
  }> {
    const startTime = Date.now();
    const circuitBreakerKey = `agent-${agent}`;

    try {
      const response = await this.invoke({
        agent,
        query: "health_check",
        parameters: { type: "health_check" },
      });

      const latencyMs = Date.now() - startTime;

      return {
        status: response.success ? "healthy" : "degraded",
        latencyMs,
        circuitBreakerState:
          this.circuitBreakers.getState(circuitBreakerKey)?.state || "closed",
      };
    } catch (error) {
      return {
        status: "offline",
        latencyMs: Date.now() - startTime,
        circuitBreakerState:
          this.circuitBreakers.getState(circuitBreakerKey)?.state || "open",
      };
    }
  }

  // ==========================================================================
  // Circuit Breaker Management
  // ==========================================================================

  /**
   * Get circuit breaker status for an agent
   */
  getCircuitBreakerStatus(agent: AgentType) {
    const key = `agent-${agent}`;
    return this.circuitBreakers.getState(key);
  }

  /**
   * Reset circuit breaker for an agent
   */
  resetCircuitBreaker(agent: AgentType) {
    const key = `agent-${agent}`;
    this.circuitBreakers.reset(key);
  }

  /**
   * Get all circuit breaker states
   */
  getAllCircuitBreakerStates() {
    return this.circuitBreakers.exportState();
  }

  // ==========================================================================
  // Registry Access
  // ==========================================================================

  /**
   * Register an agent
   */
  registerAgent(
    registration: Parameters<AgentRegistry["registerAgent"]>[0]
  ): AgentRecord {
    return this.registry.registerAgent(registration);
  }

  /**
   * Get agent from registry
   */
  getAgent(agentId: string): AgentRecord | undefined {
    return this.registry.getAgent(agentId);
  }

  /**
   * Get registry instance
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Execute the actual agent request
   */
  private async executeAgentRequest(
    request: UnifiedAgentRequest,
    traceId: string
  ): Promise<UnifiedAgentResponse> {
    // Determine routing based on agent type
    const routeType = this.determineRouteType(request.agent);

    switch (routeType) {
      case "groundtruth":
        return this.executeGroundtruthRequest(request, traceId);
      case "http":
        return this.executeHttpRequest(request, traceId);
      case "local":
        return this.executeLocalAgent(request, traceId);
      default:
        return this.executeMockAgent(request, traceId);
    }
  }

  /**
   * Determine how to route the request.
   *
   * Priority:
   * 1. Groundtruth agent → dedicated groundtruth API
   * 2. HTTP endpoint configured (env or registry) → HTTP
   * 3. Fabric agent available via AgentFactory → local execution
   * 4. Development/test → mock
   */
  private determineRouteType(
    agent: AgentType
  ): "http" | "local" | "mock" | "groundtruth" {
    if (agent === "groundtruth") {
      if (this.groundtruthAPI?.isConfigured()) {
        return "groundtruth";
      }
      if (env.isProduction) {
        throw new Error("Groundtruth API routing is not configured.");
      }
      return "mock";
    }

    // Check if we have an HTTP endpoint configured
    if (this.getResolvedBaseUrl()) {
      return "http";
    }

    // Check if agent is registered with an HTTP endpoint
    const agentRecord = this.registry.getAgent(agent);
    if (agentRecord?.endpoint) {
      return "http";
    }

    // Check if a fabric agent implementation exists
    if (this.agentFactory?.hasFabricAgent(agent)) {
      return "local";
    }

    if (env.isProduction) {
      throw new Error(PRODUCTION_ROUTING_ERROR);
    }

    // Fallback to mock for development/test
    return "mock";
  }

  /**
   * Execute HTTP request to agent endpoint
   */
  private async executeHttpRequest(
    request: UnifiedAgentRequest,
    traceId: string
  ): Promise<UnifiedAgentResponse> {
    const url = this.resolveAgentInvokeUrl(request.agent);

     
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trace-ID": traceId,
      },
      body: JSON.stringify({
        query: request.query,
        context: request.context,
        parameters: request.parameters,
        sessionId: request.sessionId,
        userId: request.userId,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(
        `Agent request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Execute request with a local fabric agent instance via AgentFactory.
   *
   * Constructs a LifecycleContext from the UnifiedAgentRequest and delegates
   * to the fabric agent's execute() method. The agent has access to the
   * shared LLMGateway, MemorySystem, and CircuitBreaker via the factory.
   */
  private async executeLocalAgent(
    request: UnifiedAgentRequest,
    traceId: string
  ): Promise<UnifiedAgentResponse> {
    if (!this.agentFactory) {
      logger.warn("AgentFactory not available, falling back to mock", {
        agent: request.agent,
        traceId,
      });
      return this.executeMockAgent(request, traceId);
    }

    const organizationId = request.context?.organizationId || request.context?.organization_id || "system";
    const startTime = Date.now();

    try {
      const agent = this.agentFactory.create(request.agent, organizationId);

      // Build a LifecycleContext from the unified request
      const lifecycleContext: LifecycleContext = {
        workspace_id: request.sessionId || traceId,
        organization_id: organizationId,
        user_id: request.userId || "system",
        lifecycle_stage: agent.lifecycleStage as LifecycleContext["lifecycle_stage"],
        workspace_data: {},
        user_inputs: {
          query: request.query,
          ...(request.parameters || {}),
        },
        previous_stage_outputs: request.context?.previousStageOutputs,
        metadata: {
          traceId,
          sessionId: request.sessionId,
          idempotencyKey: request.idempotencyKey,
          ...request.context,
        },
      };

      const agentOutput = await agent.execute(lifecycleContext);
      const duration = Date.now() - startTime;

      logger.info("Local fabric agent executed", {
        agent: request.agent,
        status: agentOutput.status,
        confidence: agentOutput.confidence,
        duration_ms: duration,
        traceId,
      });

      return {
        success: agentOutput.status === "success" || agentOutput.status === "partial_success",
        data: agentOutput.result,
        content: agentOutput.reasoning || `Agent ${request.agent} completed`,
        confidenceLevel: agentOutput.confidence,
        confidenceScore: this.mapConfidenceToScore(agentOutput.confidence),
        type: "message",
        status: agentOutput.status,
        warnings: agentOutput.warnings,
        metadata: {
          agent: request.agent,
          duration,
          timestamp: new Date().toISOString(),
          traceId,
          tokens: agentOutput.metadata?.token_usage
            ? {
                prompt: agentOutput.metadata.token_usage.prompt_tokens,
                completion: agentOutput.metadata.token_usage.completion_tokens,
                total: agentOutput.metadata.token_usage.total_tokens,
              }
            : undefined,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Local fabric agent execution failed", {
        agent: request.agent,
        error: message,
        duration_ms: duration,
        traceId,
      });

      return {
        success: false,
        error: message,
        metadata: {
          agent: request.agent,
          duration,
          timestamp: new Date().toISOString(),
          traceId,
        },
      };
    }
  }

  /**
   * Map confidence level string to a numeric score.
   */
  private mapConfidenceToScore(confidence: string): number {
    const scores: Record<string, number> = {
      very_low: 0.2,
      low: 0.4,
      medium: 0.6,
      high: 0.8,
      very_high: 0.95,
    };
    return scores[confidence] ?? 0.5;
  }

  /**
   * Execute mock agent for development/testing
   */
  private async executeMockAgent(
    request: UnifiedAgentRequest,
    _traceId: string
  ): Promise<UnifiedAgentResponse> {
    // Simulate processing time
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 500)
    );

    // Generate mock response based on agent type
    const mockResponses: Record<string, any> = {
      opportunity: {
        painPoints: ["Inefficient manual processes", "High operational costs"],
        recommendations: ["Automation", "Process optimization"],
        estimatedImpact: { roi: 0.25, paybackMonths: 12 },
      },
      "financial-modeling": {
        roi: 0.35,
        npv: 1500000,
        paybackPeriod: 18,
        projections: { year1: 500000, year2: 750000, year3: 1000000 },
      },
      coordinator: {
        taskPlan: { phases: ["Discovery", "Analysis", "Design"] },
        assignedAgents: [
          "opportunity",
          "system-mapper",
          "intervention-designer",
        ],
      },
      groundtruth: {
        verified: false,
        issues: ["Groundtruth API not configured"],
      },
    };

    return {
      success: true,
      data: mockResponses[request.agent] || {
        message: "Processed successfully",
      },
      content: `Processed query for ${request.agent} agent`,
      confidenceLevel: "medium",
      confidenceScore: 0.75,
      type: "message",
    };
  }

  private async executeGroundtruthRequest(
    request: UnifiedAgentRequest,
    traceId: string
  ): Promise<UnifiedAgentResponse> {
    if (!this.groundtruthAPI) {
      return {
        success: false,
        error: "Groundtruth API is not configured",
        metadata: {
          agent: request.agent,
          duration: 0,
          timestamp: new Date().toISOString(),
          traceId,
        },
      };
    }

    const payload: GroundtruthRequestPayload = {
      query: request.query,
      agent: request.agent,
      context: request.context,
      metadata: {
        sessionId: request.sessionId,
        userId: request.userId,
        traceId,
      },
      ...(request.groundtruth?.payload ?? {}),
    };

    const groundtruthResponse = await this.groundtruthAPI.evaluate(
      payload,
      request.groundtruth?.requestOptions
    );

    return {
      success: groundtruthResponse.success,
      data: groundtruthResponse.data,
      error: groundtruthResponse.error,
      metadata: {
        agent: request.agent,
        duration: 0,
        timestamp: new Date().toISOString(),
        traceId,
      },
      payload: {
        groundtruth: groundtruthResponse,
      },
    };
  }

  private async attachGroundtruth(
    request: UnifiedAgentRequest,
    response: UnifiedAgentResponse,
    traceId: string
  ): Promise<UnifiedAgentResponse> {
    if (!request.groundtruth?.enabled) {
      return response;
    }

    if (!this.groundtruthAPI) {
      return {
        ...response,
        warnings: [
          ...(response.warnings ?? []),
          "Groundtruth API is not configured",
        ],
      };
    }

    const groundtruthPayload: GroundtruthRequestPayload = {
      query: request.query,
      agent: request.agent,
      response: response.data ?? response.payload ?? response.content,
      context: request.context,
      metadata: {
        sessionId: request.sessionId,
        userId: request.userId,
        traceId,
      },
      ...(request.groundtruth.payload ?? {}),
    };

    const groundtruthResult = await this.groundtruthAPI.evaluate(
      groundtruthPayload,
      request.groundtruth.requestOptions
    );

    const mergeKey = request.groundtruth.mergeKey ?? "groundtruth";
    const existingPayload =
      response.payload && typeof response.payload === "object"
        ? response.payload
        : response.payload !== undefined
          ? { value: response.payload }
          : {};

    const mergedPayload = {
      ...existingPayload,
      [mergeKey]: groundtruthResult,
    };

    const nextWarnings = groundtruthResult.success
      ? response.warnings
      : [
          ...(response.warnings ?? []),
          groundtruthResult.error || "Groundtruth verification failed",
        ];

    return {
      ...response,
      payload: mergedPayload,
      warnings: nextWarnings,
    };
  }

  private getResolvedBaseUrl(): string | undefined {
    return this.config.baseUrl?.trim() || undefined;
  }

  private assertRoutingConfigured(agent: AgentType): void {
    if (!env.isProduction) {
      return;
    }

    const hasBaseUrl = Boolean(this.getResolvedBaseUrl());
    const hasEndpoint = Boolean(this.registry.getAgent(agent)?.endpoint);

    if (!hasBaseUrl && !hasEndpoint) {
      throw new Error(PRODUCTION_ROUTING_ERROR);
    }
  }

  private resolveAgentInvokeUrl(agent: AgentType): string {
    const baseUrl = this.getResolvedBaseUrl();
    const agentEndpoint = this.registry.getAgent(agent)?.endpoint;

    if (agentEndpoint) {
      const normalized = agentEndpoint.replace(/\/+$/, "");
      return normalized.endsWith("/invoke")
        ? normalized
        : `${normalized}/invoke`;
    }

    if (baseUrl) {
      const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
      const basePrefix = normalizedBaseUrl.endsWith("/agents")
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/agents`;
      return `${basePrefix}/${agent}/invoke`;
    }

    throw new Error(
      "Agent routing configuration missing. Set baseUrl or agent endpoints."
    );
  }

  /**
   * Check idempotency cache for existing response
   */
  private async checkIdempotency(
    tenantId: string,
    idempotencyKey: string
  ): Promise<UnifiedAgentResponse | null> {
    const cachedResponse = await this.idempotencyCache.get<UnifiedAgentResponse>(
      idempotencyKey,
      {
        tenantId,
        namespace: UnifiedAgentAPI.IDEMPOTENCY_NAMESPACE,
      }
    );
    if (cachedResponse) {
      logger.info("Idempotency cache hit", { idempotencyKey, tenantId });
      return cachedResponse;
    }
    return null;
  }

  /**
   * Store response in idempotency cache
   */
  private storeIdempotencyResponse(
    tenantId: string,
    idempotencyKey: string,
    response: UnifiedAgentResponse
  ): Promise<void> {
    if (idempotencyKey) {
      logger.debug("Stored idempotency response", { idempotencyKey, tenantId });
      return this.idempotencyCache.set(idempotencyKey, response, {
        tenantId,
        namespace: UnifiedAgentAPI.IDEMPOTENCY_NAMESPACE,
        ttl: UnifiedAgentAPI.IDEMPOTENCY_TTL_SECONDS,
        nearCacheTtl: 10,
      });
    }

    return Promise.resolve();
  }

  /**
   * Generate a cache key for agent requests
   */
  private generateAgentCacheKey(request: UnifiedAgentRequest): string {
    // Create a deterministic key from agent type, query, and normalized context
    const normalizedContext = this.normalizeContextForCache(request.context);
    const contextStr = JSON.stringify(normalizedContext);

    // Simple hash of the combined inputs
    const combined = `${request.agent}:${request.query}:${contextStr}`;
    return this.simpleHash(combined);
  }

  private getTenantId(request: UnifiedAgentRequest): string {
    return (
      request.context?.organizationId ||
      request.context?.organization_id ||
      "system"
    );
  }

  /**
   * Normalize context for cache key generation (remove non-deterministic fields)
   */
  private normalizeContextForCache(
    context?: Record<string, any>
  ): Record<string, any> {
    if (!context) return {};

    // Remove fields that shouldn't affect caching
    const { sessionId, userId, traceId, idempotencyKey, ...normalized } =
      context;

    // Sort keys for consistent hashing
    return Object.keys(normalized)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = normalized[key];
          return acc;
        },
        {} as Record<string, any>
      );
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: UnifiedAgentAPI | null = null;

/**
 * Get singleton instance of UnifiedAgentAPI
 */
export function getUnifiedAgentAPI(
  config?: Partial<UnifiedAPIConfig>
): UnifiedAgentAPI {
  if (!instance) {
    instance = new UnifiedAgentAPI(config);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetUnifiedAgentAPI(): void {
  instance = null;
}

/**
 * Default export
 */
export const unifiedAgentAPI = getUnifiedAgentAPI();

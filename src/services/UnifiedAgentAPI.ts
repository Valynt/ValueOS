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

import { logger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { CircuitBreakerManager } from './CircuitBreaker';
import { AgentRecord, AgentRegistry } from './AgentRegistry';
import { SDUIPageDefinition, validateSDUISchema } from '../sdui/schema';
import { getAuditLogger, logAgentResponse } from './AgentAuditLogger';
import { AgentType } from './agent-types';
import { AgentHealthStatus, ConfidenceLevel } from '../types/agent';
import { env, getEnvVar } from '../lib/env';

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
  /** Trace ID for observability */
  traceId?: string;
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
  type?: 'component' | 'message' | 'suggestion' | 'sdui-page';
  /** Response payload */
  payload?: any;
  /** Status (for workflow) */
  status?: string;
  /** Response metadata */
  metadata?: {
    agent: AgentType;
    duration: number;
    timestamp: string;
    model?: string;
    traceId: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
  /** Warnings */
  warnings?: string[];
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
}

const DEFAULT_CONFIG: UnifiedAPIConfig = {
  timeout: 30000,
  enableCircuitBreaker: true,
  failureThreshold: 5,
  cooldownPeriod: 60000,
  enableAuditLogging: true,
};

const PRODUCTION_ROUTING_ERROR =
  'Mock routing is disabled in production. Configure baseUrl or agent endpoints.';

/**
 * Sanitize user input for LLM prompts to prevent injection attacks
 */
function sanitizeForPrompt(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/<system>/gi, '[SYSTEM]')
    .replace(/<\/system>/gi, '[/SYSTEM]')
    .replace(/<user_input>/gi, '[USER_INPUT]')
    .replace(/<\/user_input>/gi, '[/USER_INPUT]')
    .replace(/<instruction>/gi, '[INSTRUCTION]')
    .replace(/<\/instruction>/gi, '[/INSTRUCTION]')
    .replace(/ignore previous/gi, '[FILTERED]')
    .replace(/system prompt/gi, '[FILTERED]')
    .substring(0, 2000); // Hard limit on input length
}

/**
 * Validate and sanitize agent request
 */
function validateAndSanitizeRequest(request: UnifiedAgentRequest): UnifiedAgentRequest {
  if (!request.query || typeof request.query !== 'string' || request.query.trim().length === 0) {
    throw new Error('Query is required and must be a non-empty string');
  }

  if (request.query.length > 2000) {
    throw new Error('Query exceeds maximum length of 2000 characters');
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
  private config: UnifiedAPIConfig;
  private circuitBreakers: CircuitBreakerManager;
  private registry: AgentRegistry;
  private auditLogger: ReturnType<typeof getAuditLogger> | null = null;

  constructor(config: Partial<UnifiedAPIConfig> = {}) {
    const envBaseUrl =
      getEnvVar('VITE_AGENT_API_URL') ||
      getEnvVar('AGENT_API_URL');
    const resolvedBaseUrl = config.baseUrl ?? envBaseUrl;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      baseUrl: resolvedBaseUrl || undefined,
    };
    this.circuitBreakers = new CircuitBreakerManager();
    this.registry = new AgentRegistry();

    if (this.config.enableAuditLogging) {
      this.auditLogger = getAuditLogger();
    }
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Invoke an agent with unified request/response format
   */
  async invoke<T = any>(request: UnifiedAgentRequest): Promise<UnifiedAgentResponse<T>> {
    const traceId = request.traceId || uuidv4();
    const startTime = Date.now();

    logger.info('Agent invocation started', {
      traceId,
      agent: request.agent,
      sessionId: request.sessionId,
    });

    // Validate and sanitize the request
    let sanitizedRequest: UnifiedAgentRequest;
    try {
      sanitizedRequest = validateAndSanitizeRequest(request);
    } catch (error) {
      logger.warn('Request validation failed', error instanceof Error ? error : undefined, {
        traceId,
        agent: request.agent,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request',
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

      // Get circuit breaker for this agent
      const circuitBreakerKey = `agent-${request.agent}`;

      // Execute with circuit breaker protection
      const response = await this.circuitBreakers.execute(
        circuitBreakerKey,
        () => this.executeAgentRequest(sanitizedRequest, traceId),
        {
          timeoutMs: this.config.timeout,
          // Convert failure threshold count to rate (e.g., 5 failures = 0.5 rate)
          failureRateThreshold: (this.config.failureThreshold || 5) / 10,
        }
      );

      const duration = Date.now() - startTime;

      // Add metadata
      const result: UnifiedAgentResponse<T> = {
        ...response,
        metadata: {
          agent: request.agent,
          duration,
          timestamp: new Date().toISOString(),
          traceId,
          ...response.metadata,
        },
      };

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

      logger.info('Agent invocation completed', {
        traceId,
        agent: request.agent,
        duration,
        success: result.success,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Agent invocation failed', error instanceof Error ? error : undefined, {
        traceId,
        agent: request.agent,
        duration,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      parameters: { outputType: 'sdui' },
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
        query: 'health_check',
        parameters: { type: 'health_check' },
      });

      const latencyMs = Date.now() - startTime;

      return {
        status: response.success ? 'healthy' : 'degraded',
        latencyMs,
        circuitBreakerState: this.circuitBreakers.getState(circuitBreakerKey)?.state || 'closed',
      };
    } catch (error) {
      return {
        status: 'offline',
        latencyMs: Date.now() - startTime,
        circuitBreakerState: this.circuitBreakers.getState(circuitBreakerKey)?.state || 'open',
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
  registerAgent(registration: Parameters<AgentRegistry['registerAgent']>[0]): AgentRecord {
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
      case 'http':
        return this.executeHttpRequest(request, traceId);
      case 'local':
        return this.executeLocalAgent(request, traceId);
      default:
        return this.executeMockAgent(request, traceId);
    }
  }

  /**
   * Determine how to route the request
   */
  private determineRouteType(agent: AgentType): 'http' | 'local' | 'mock' {
    // Check if we have an HTTP endpoint configured
    if (this.getResolvedBaseUrl()) {
      return 'http';
    }

    // Check if agent is registered locally
    const agentRecord = this.registry.getAgent(agent);
    if (agentRecord?.endpoint) {
      return 'http';
    }

    if (env.isProduction) {
      throw new Error(PRODUCTION_ROUTING_ERROR);
    }

    // For now, use mock for development/test
    return 'mock';
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-ID': traceId,
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
      throw new Error(`Agent request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute request with local agent instance
   */
  private async executeLocalAgent(
    request: UnifiedAgentRequest,
    traceId: string
  ): Promise<UnifiedAgentResponse> {
    // This would invoke the actual agent class
    // For now, fall back to mock
    return this.executeMockAgent(request, traceId);
  }

  /**
   * Execute mock agent for development/testing
   */
  private async executeMockAgent(
    request: UnifiedAgentRequest,
    traceId: string
  ): Promise<UnifiedAgentResponse> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    // Generate mock response based on agent type
    const mockResponses: Record<string, any> = {
      opportunity: {
        painPoints: ['Inefficient manual processes', 'High operational costs'],
        recommendations: ['Automation', 'Process optimization'],
        estimatedImpact: { roi: 0.25, paybackMonths: 12 },
      },
      'financial-modeling': {
        roi: 0.35,
        npv: 1500000,
        paybackPeriod: 18,
        projections: { year1: 500000, year2: 750000, year3: 1000000 },
      },
      coordinator: {
        taskPlan: { phases: ['Discovery', 'Analysis', 'Design'] },
        assignedAgents: ['opportunity', 'system-mapper', 'intervention-designer'],
      },
    };

    return {
      success: true,
      data: mockResponses[request.agent] || { message: 'Processed successfully' },
      content: `Processed query for ${request.agent} agent`,
      confidenceLevel: 'medium',
      confidenceScore: 0.75,
      type: 'message',
    };
  }

  private getResolvedBaseUrl(): string | undefined {
    const baseUrl = this.config.baseUrl?.trim();
    return baseUrl ? baseUrl : undefined;
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
      const normalized = agentEndpoint.replace(/\/$/, '');
      return normalized.endsWith('/invoke') ? normalized : `${normalized}/invoke`;
    }

    if (baseUrl) {
      const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
      const basePrefix = normalizedBaseUrl.endsWith('/agents')
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/agents`;
      return `${basePrefix}/${agent}/invoke`;
    }

    throw new Error('Agent routing configuration missing. Set baseUrl or agent endpoints.');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: UnifiedAgentAPI | null = null;

/**
 * Get singleton instance of UnifiedAgentAPI
 */
export function getUnifiedAgentAPI(config?: Partial<UnifiedAPIConfig>): UnifiedAgentAPI {
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

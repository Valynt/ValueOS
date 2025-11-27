/**
 * AgentAPI Service
 * 
 * Wraps HTTP calls to agent endpoints with circuit breaker protection
 * and comprehensive error handling.
 */

// Re-export types from shared file to maintain backwards compatibility
export type { AgentType, AgentContext } from './agent-types';

import { logger } from '../lib/logger';
import { CircuitBreaker } from './CircuitBreaker';
import { SDUIPageDefinition, validateSDUISchema } from '../sdui/schema';
import { getAuditLogger, logAgentResponse } from './AgentAuditLogger';
import { getConfig } from '../config/environment';

/**
 * Agent request payload
 */
export interface AgentRequest {
  /**
   * Agent type to invoke
   */
  agent: AgentType;

  /**
   * Query or prompt for the agent
   */
  query: string;

  /**
   * Request context
   */
  context?: AgentContext;

  /**
   * Additional parameters
   */
  parameters?: Record<string, any>;
}

/**
 * Agent response format
 */
export interface AgentResponse<T = any> {
  /**
   * Whether the request was successful
   */
  success: boolean;

  /**
   * Response data
   */
  data?: T;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Agent confidence score (0-1)
   */
  confidence?: number;

  /**
   * Response metadata
   */
  metadata?: {
    /**
     * Agent that generated the response
     */
    agent: AgentType;

    /**
     * Duration in milliseconds
     */
    duration: number;

    /**
     * Timestamp
     */
    timestamp: string;

    /**
     * Model used (if applicable)
     */
    model?: string;

    /**
     * Token usage (if applicable)
     */
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };

  /**
   * Warnings or suggestions
   */
  warnings?: string[];
}

/**
 * SDUI page generation response
 */
export interface SDUIPageResponse extends AgentResponse<SDUIPageDefinition> {
  /**
   * Validation result
   */
  validation?: {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  };
}

/**
 * Agent API configuration
 */
export interface AgentAPIConfig {
  /**
   * Base URL for agent endpoints
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Enable circuit breaker
   * @default true
   */
  enableCircuitBreaker?: boolean;

  /**
   * Circuit breaker failure threshold
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Circuit breaker cooldown period (ms)
   * @default 60000
   */
  cooldownPeriod?: number;

  /**
   * Enable request/response logging
   * @default false
   */
  enableLogging?: boolean;

  /**
   * Custom headers
   */
  headers?: Record<string, string>;
}

/**
 * Get default configuration from environment
 */
function getDefaultConfig(): Required<AgentAPIConfig> {
  const envConfig = getConfig();
  
  return {
    baseUrl: envConfig.agents.apiUrl,
    timeout: envConfig.agents.timeout,
    enableCircuitBreaker: envConfig.agents.circuitBreaker.enabled,
    failureThreshold: envConfig.agents.circuitBreaker.threshold,
    cooldownPeriod: envConfig.agents.circuitBreaker.cooldown,
    enableLogging: envConfig.agents.logging,
    headers: {},
  };
}

/**
 * AgentAPI Service Class
 * 
 * Provides methods for interacting with agent endpoints with
 * circuit breaker protection and error handling.
 */
export class AgentAPI {
  private config: Required<AgentAPIConfig>;
  private circuitBreakers: Map<AgentType, CircuitBreaker>;

  constructor(config: AgentAPIConfig = {}) {
    this.config = { ...getDefaultConfig(), ...config };
    this.circuitBreakers = new Map();

    // Initialize circuit breakers for each agent type
    if (this.config.enableCircuitBreaker) {
      const agentTypes: AgentType[] = [
        'opportunity',
        'target',
        'realization',
        'expansion',
        'integrity',
        'company-intelligence',
        'financial-modeling',
        'value-mapping',
      ];

      agentTypes.forEach((agent) => {
        this.circuitBreakers.set(
          agent,
          new CircuitBreaker(
            `agent-${agent}`,
            this.config.failureThreshold,
            this.config.cooldownPeriod
          )
        );
      });
    }
  }

  /**
   * Get circuit breaker for an agent
   */
  private getCircuitBreaker(agent: AgentType): CircuitBreaker | null {
    if (!this.config.enableCircuitBreaker) {
      return null;
    }
    return this.circuitBreakers.get(agent) || null;
  }

  /**
   * Make HTTP request with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Execute agent request with circuit breaker protection
   */
  private async executeRequest<T>(
    agent: AgentType,
    endpoint: string,
    body: any
  ): Promise<AgentResponse<T>> {
    const startTime = Date.now();
    const circuitBreaker = this.getCircuitBreaker(agent);

    // Check circuit breaker state
    if (circuitBreaker && !circuitBreaker.canExecute()) {
      return {
        success: false,
        error: `Circuit breaker is open for ${agent} agent. Please try again later.`,
        metadata: {
          agent,
          duration: 0,
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      // Log request if enabled
      if (this.config.enableLogging) {
        logger.debug(`[AgentAPI] Request to ${agent}:`, { endpoint, body });
      }

      // Make HTTP request
      const url = `${this.config.baseUrl}${endpoint}`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(body),
        },
        this.config.timeout
      );

      const duration = Date.now() - startTime;

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      // Parse response
      const data = await response.json();

      // Record success in circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }

      // Log response if enabled
      if (this.config.enableLogging) {
        logger.debug(`[AgentAPI] Response from ${agent}:`, data);
      }

      const result = {
        success: true,
        data: data.data || data,
        confidence: data.confidence,
        metadata: {
          agent,
          duration,
          timestamp: new Date().toISOString(),
          model: data.model,
          tokens: data.tokens,
        },
        warnings: data.warnings,
      };

      // Log to audit system
      await logAgentResponse(
        agent,
        body.query || '',
        true,
        data.data || data,
        result.metadata,
        undefined,
        body.context
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure in circuit breaker
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }

      // Log error if enabled
      if (this.config.enableLogging) {
        logger.error(`[AgentAPI] Error from ${agent}:`, error);
      }

      const result = {
        success: false,
        error: (error as Error).message,
        metadata: {
          agent,
          duration,
          timestamp: new Date().toISOString(),
        },
      };

      // Log to audit system
      await logAgentResponse(
        agent,
        body.query || '',
        false,
        undefined,
        result.metadata,
        (error as Error).message,
        body.context
      );

      return result;
    }
  }

  /**
   * Generate value case (Opportunity Agent)
   */
  async generateValueCase(
    query: string,
    context?: AgentContext
  ): Promise<SDUIPageResponse> {
    const response = await this.executeRequest<SDUIPageDefinition>(
      'opportunity',
      '/opportunity/generate',
      { query, context }
    );

    // Validate SDUI schema if successful
    if (response.success && response.data) {
      const validation = validateSDUISchema(response.data);
      return {
        ...response,
        validation: {
          valid: validation.success,
          errors: validation.success ? undefined : validation.errors,
          warnings: validation.success ? validation.warnings : undefined,
        },
      };
    }

    return response as SDUIPageResponse;
  }

  /**
   * Generate KPI hypothesis (Target Agent)
   */
  async generateKPIHypothesis(
    query: string,
    context?: AgentContext
  ): Promise<AgentResponse<any>> {
    return this.executeRequest('target', '/target/kpi-hypothesis', {
      query,
      context,
    });
  }

  /**
   * Generate ROI model (Financial Modeling Agent)
   */
  async generateROIModel(
    query: string,
    assumptions: Record<string, any>,
    context?: AgentContext
  ): Promise<AgentResponse<any>> {
    return this.executeRequest('financial-modeling', '/financial/roi-model', {
      query,
      assumptions,
      context,
    });
  }

  /**
   * Generate realization dashboard (Realization Agent)
   */
  async generateRealizationDashboard(
    query: string,
    context?: AgentContext
  ): Promise<SDUIPageResponse> {
    const response = await this.executeRequest<SDUIPageDefinition>(
      'realization',
      '/realization/dashboard',
      { query, context }
    );

    if (response.success && response.data) {
      const validation = validateSDUISchema(response.data);
      return {
        ...response,
        validation: {
          valid: validation.success,
          errors: validation.success ? undefined : validation.errors,
          warnings: validation.success ? validation.warnings : undefined,
        },
      };
    }

    return response as SDUIPageResponse;
  }

  /**
   * Generate expansion opportunities (Expansion Agent)
   */
  async generateExpansionOpportunities(
    query: string,
    context?: AgentContext
  ): Promise<SDUIPageResponse> {
    const response = await this.executeRequest<SDUIPageDefinition>(
      'expansion',
      '/expansion/opportunities',
      { query, context }
    );

    if (response.success && response.data) {
      const validation = validateSDUISchema(response.data);
      return {
        ...response,
        validation: {
          valid: validation.success,
          errors: validation.success ? undefined : validation.errors,
          warnings: validation.success ? validation.warnings : undefined,
        },
      };
    }

    return response as SDUIPageResponse;
  }

  /**
   * Validate integrity (Integrity Agent)
   */
  async validateIntegrity(
    artifact: any,
    context?: AgentContext
  ): Promise<AgentResponse<any>> {
    return this.executeRequest('integrity', '/integrity/validate', {
      artifact,
      context,
    });
  }

  /**
   * Research company (Company Intelligence Agent)
   */
  async researchCompany(
    companyName: string,
    context?: AgentContext
  ): Promise<AgentResponse<any>> {
    return this.executeRequest('company-intelligence', '/company/research', {
      companyName,
      context,
    });
  }

  /**
   * Map value drivers (Value Mapping Agent)
   */
  async mapValueDrivers(
    query: string,
    context?: AgentContext
  ): Promise<AgentResponse<any>> {
    return this.executeRequest('value-mapping', '/value/map-drivers', {
      query,
      context,
    });
  }

  /**
   * Generic agent invocation
   */
  async invokeAgent<T = any>(
    request: AgentRequest
  ): Promise<AgentResponse<T>> {
    const endpoint = `/${request.agent}/invoke`;
    return this.executeRequest<T>(request.agent, endpoint, {
      query: request.query,
      context: request.context,
      parameters: request.parameters,
    });
  }

  /**
   * Get circuit breaker status for an agent
   */
  getCircuitBreakerStatus(agent: AgentType): {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureTime: number | null;
  } | null {
    const breaker = this.getCircuitBreaker(agent);
    if (!breaker) {
      return null;
    }

    return {
      state: breaker.canExecute()
        ? 'closed'
        : Date.now() - (breaker['lastFailureTime'] || 0) > this.config.cooldownPeriod
        ? 'half-open'
        : 'open',
      failureCount: breaker['failureCount'] || 0,
      lastFailureTime: breaker['lastFailureTime'] || null,
    };
  }

  /**
   * Reset circuit breaker for an agent
   */
  resetCircuitBreaker(agent: AgentType): void {
    const breaker = this.getCircuitBreaker(agent);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach((breaker) => breaker.reset());
  }
}

/**
 * Singleton instance
 */
let agentAPIInstance: AgentAPI | null = null;

/**
 * Get or create AgentAPI instance
 */
export function getAgentAPI(config?: AgentAPIConfig): AgentAPI {
  if (!agentAPIInstance) {
    agentAPIInstance = new AgentAPI(config);
  }
  return agentAPIInstance;
}

/**
 * Reset AgentAPI instance (useful for testing)
 */
export function resetAgentAPI(): void {
  agentAPIInstance = null;
}

/**
 * Default export
 */
export default AgentAPI;

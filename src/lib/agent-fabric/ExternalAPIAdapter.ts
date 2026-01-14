/**
 * External API Adapter
 *
 * Provides secure wrapper for external API calls with audit logging,
 * circuit breaker protection, and PII filtering.
 *
 * Replaces direct fetch/axios calls with secure alternatives.
 */

import { logger } from "../../lib/logger";
import { sanitizeForLogging } from "../../lib/piiFilter";
import { secureMessageBus, MessagePriority } from "./SecureMessageBus";
import { AgentIdentity, createAgentIdentity } from "../auth/AgentIdentity";

export interface ExternalAPIOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  priority?: MessagePriority;
  auditContext?: Record<string, any>;
}

export interface ExternalAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
  requestId: string;
  duration: number;
  auditLogged: boolean;
}

/**
 * Secure adapter for external API calls
 */
export class ExternalAPIAdapter {
  private serviceIdentity: AgentIdentity;
  private serviceName: string;
  private organizationId: string;
  private circuitBreakerState: Map<string, { failures: number; lastFailure: number }> = new Map();

  constructor(serviceName: string, organizationId: string = "default") {
    this.serviceName = serviceName;
    this.organizationId = organizationId;

    this.serviceIdentity = createAgentIdentity({
      role: "system" as any,
      organizationId,
      parentSessionId: "external-api-session",
      initiatingUserId: "system",
      expirationSeconds: 7200,
    });

    secureMessageBus.registerAgent(this.serviceIdentity);
  }

  /**
   * Make secure external API call
   */
  async call<T = any>(
    apiName: string,
    endpoint: string,
    options: ExternalAPIOptions = {}
  ): Promise<ExternalAPIResponse<T>> {
    const startTime = Date.now();
    const requestId = `${this.serviceName}-${apiName}-${Date.now()}`;

    try {
      // Check circuit breaker
      if (this.isCircuitOpen(apiName)) {
        throw new Error(`Circuit breaker open for ${apiName}`);
      }

      // Sanitize request data for logging
      const sanitizedOptions = this.sanitizeRequestForLogging(options);

      // Log the API call initiation
      logger.info("External API call initiated", {
        service: this.serviceName,
        apiName,
        endpoint,
        method: options.method || "GET",
        requestId,
        hasBody: !!options.body,
        timeout: options.timeout,
      });

      // Make the actual API call
      const response = await this.makeRequest(endpoint, options);

      const duration = Date.now() - startTime;
      const responseData = await this.parseResponse<T>(response);

      // Log successful completion
      logger.info("External API call completed", {
        service: this.serviceName,
        apiName,
        endpoint,
        status: response.status,
        duration,
        requestId,
        success: true,
      });

      // Record success in circuit breaker
      this.recordSuccess(apiName);

      // Audit log the call
      await this.auditLogCall(apiName, endpoint, options, response, duration, true);

      return {
        success: true,
        data: responseData,
        status: response.status,
        headers: this.extractHeaders(response),
        requestId,
        duration,
        auditLogged: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failure in circuit breaker
      this.recordFailure(apiName);

      // Log failure
      logger.error("External API call failed", error instanceof Error ? error : undefined, {
        service: this.serviceName,
        apiName,
        endpoint,
        duration,
        requestId,
        error: errorMessage,
      });

      // Audit log the failed call
      await this.auditLogCall(apiName, endpoint, options, null, duration, false, errorMessage);

      return {
        success: false,
        error: errorMessage,
        requestId,
        duration,
        auditLogged: true,
      };
    }
  }

  /**
   * Make the actual HTTP request
   */
  private async makeRequest(endpoint: string, options: ExternalAPIOptions): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = options.timeout
      ? setTimeout(() => controller.abort(), options.timeout)
      : null;

    try {
      const response = await fetch(endpoint, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `${this.serviceName}/1.0`,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      return response;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      return await response.json();
    } else if (contentType?.includes("text/")) {
      return (await response.text()) as unknown as T;
    } else {
      return response.arrayBuffer() as unknown as T;
    }
  }

  /**
   * Extract headers from response
   */
  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  /**
   * Sanitize request data for logging (PII filtering)
   */
  private sanitizeRequestForLogging(options: ExternalAPIOptions): ExternalAPIOptions {
    return {
      ...options,
      headers: options.headers ? sanitizeForLogging(options.headers) : undefined,
      body: options.body ? sanitizeForLogging(options.body) : undefined,
    };
  }

  /**
   * Check if circuit breaker is open for an API
   */
  private isCircuitOpen(apiName: string): boolean {
    const state = this.circuitBreakerState.get(apiName);
    if (!state) return false;

    const now = Date.now();
    const timeSinceLastFailure = now - state.lastFailure;

    // Open for 5 minutes after 5 failures
    return state.failures >= 5 && timeSinceLastFailure < 5 * 60 * 1000;
  }

  /**
   * Record successful API call
   */
  private recordSuccess(apiName: string): void {
    const state = this.circuitBreakerState.get(apiName);
    if (state) {
      state.failures = Math.max(0, state.failures - 1);
    }
  }

  /**
   * Record failed API call
   */
  private recordFailure(apiName: string): void {
    const state = this.circuitBreakerState.get(apiName) || { failures: 0, lastFailure: 0 };
    state.failures += 1;
    state.lastFailure = Date.now();
    this.circuitBreakerState.set(apiName, state);
  }

  /**
   * Audit log the API call
   */
  private async auditLogCall(
    apiName: string,
    endpoint: string,
    options: ExternalAPIOptions,
    response: Response | null,
    duration: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const auditData = {
        service: this.serviceName,
        apiName,
        endpoint,
        method: options.method || "GET",
        success,
        duration,
        status: response?.status,
        error,
        timestamp: new Date().toISOString(),
        requestId: `${this.serviceName}-${apiName}-${Date.now()}`,
        auditContext: options.auditContext,
      };

      // Send audit log via SecureMessageBus
      await secureMessageBus.send(this.serviceIdentity, "audit-service", auditData, {
        priority: success ? "normal" : "high",
        encrypted: true,
      });
    } catch (auditError) {
      logger.warn("Failed to audit log external API call", {
        service: this.serviceName,
        apiName,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<
    string,
    { isOpen: boolean; failures: number; lastFailure: number }
  > {
    const status: Record<string, { isOpen: boolean; failures: number; lastFailure: number }> = {};

    for (const [apiName, state] of this.circuitBreakerState.entries()) {
      status[apiName] = {
        isOpen: this.isCircuitOpen(apiName),
        failures: state.failures,
        lastFailure: state.lastFailure,
      };
    }

    return status;
  }

  /**
   * Reset circuit breaker for an API
   */
  resetCircuitBreaker(apiName: string): void {
    this.circuitBreakerState.delete(apiName);
    logger.info("Circuit breaker reset", { service: this.serviceName, apiName });
  }
}

/**
 * Factory function to create adapters
 */
export function createExternalAPIAdapter(
  serviceName: string,
  organizationId?: string
): ExternalAPIAdapter {
  return new ExternalAPIAdapter(serviceName, organizationId);
}

/**
 * Default adapter for general use
 */
export const defaultExternalAPIAdapter = createExternalAPIAdapter("default-service");

/**
 * MCP Standardized Response Types
 *
 * Provides unified response format across all MCP servers with consistent
 * structure for success, error, and metadata handling.
 */

import { createErrorResponse, MCPBaseError, MCPErrorMetadata, MCPErrorDetails } from "../errors/MCPBaseError";

// ============================================================================
// Base Response Interface
// ============================================================================

export interface MCPResponseMetadata {
  requestId?: string;
  timestamp: string;
  duration?: number; // Response time in milliseconds
  provider?: string;
  tool?: string;
  tier?: string;
  cacheHit?: boolean;
  rateLimitRemaining?: number;
  warnings?: string[];
  debug?: {
    executionPath?: string[];
    performanceMetrics?: Record<string, number>;
    dependencies?: string[];
  };
}

export interface MCPBaseResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    category: string;
    metadata: MCPErrorMetadata;
    details?: MCPErrorDetails;
  };
  metadata: MCPResponseMetadata;
}

// ============================================================================
// Success Response Types
// ============================================================================

export interface MCPSuccessResponse<T = unknown> extends MCPBaseResponse<T> {
  success: true;
  data: T;
  error?: never;
}

export interface MCPErrorResponse extends MCPBaseResponse {
  success: false;
  data?: never;
  error: {
    code: string;
    message: string;
    category: string;
    metadata: MCPErrorMetadata;
    details?: MCPErrorDetails;
  };
}

// ============================================================================
// Tool-Specific Response Types
// ============================================================================

export interface MCPToolResponse<T = unknown> extends MCPSuccessResponse<T> {
  metadata: MCPResponseMetadata & {
    tool: string;
    provider?: string;
    tier?: string;
  };
}

export interface MCPFinancialToolResponse<T = unknown> extends MCPToolResponse<T> {
  metadata: MCPResponseMetadata & {
    tool: string;
    provider: "edgar" | "xbrl" | "marketdata" | "private" | "benchmark";
    tier: "tier1" | "tier2" | "tier3";
    audit: {
      traceId: string;
      verificationHash?: string;
      provenance: {
        source: string;
        filingType?: string;
        accessionNumber?: string;
        extractionMethod: string;
      };
    };
  };
}

export interface MCPCRMToolResponse<T = unknown> extends MCPToolResponse<T> {
  metadata: MCPResponseMetadata & {
    tool: string;
    provider: "hubspot" | "salesforce" | "dynamics";
    tenantId: string;
    connectionStatus: "connected" | "degraded" | "disconnected";
  };
}

// ============================================================================
// Response Builder Classes
// ============================================================================

export class MCPResponseBuilder {
  private metadata: MCPResponseMetadata;

  constructor(
    private tool?: string,
    private provider?: string,
    private requestId?: string
  ) {
    this.metadata = {
      timestamp: new Date().toISOString(),
      ...(tool && { tool }),
      ...(provider && { provider }),
      ...(requestId && { requestId }),
    };
  }

  /**
   * Get current metadata (for utility functions)
   */
  getMetadata(): MCPResponseMetadata {
    return { ...this.metadata };
  }

  /**
   * Set request ID
   */
  withRequestId(requestId: string): MCPResponseBuilder {
    this.metadata.requestId = requestId;
    return this;
  }

  /**
   * Set provider
   */
  withProvider(provider: string): MCPResponseBuilder {
    this.metadata.provider = provider;
    return this;
  }

  /**
   * Set tier (for financial responses)
   */
  withTier(tier: string): MCPResponseBuilder {
    this.metadata.tier = tier;
    return this;
  }

  /**
   * Set cache hit status
   */
  withCacheHit(cacheHit: boolean): MCPResponseBuilder {
    this.metadata.cacheHit = cacheHit;
    return this;
  }

  /**
   * Set rate limit remaining
   */
  withRateLimitRemaining(remaining: number): MCPResponseBuilder {
    this.metadata.rateLimitRemaining = remaining;
    return this;
  }

  /**
   * Add warning
   */
  withWarning(warning: string): MCPResponseBuilder {
    if (!this.metadata.warnings) {
      this.metadata.warnings = [];
    }
    this.metadata.warnings.push(warning);
    return this;
  }

  /**
   * Set duration
   */
  withDuration(duration: number): MCPResponseBuilder {
    this.metadata.duration = duration;
    return this;
  }

  /**
   * Add debug information
   */
  withDebug(debug: {
    executionPath?: string[];
    performanceMetrics?: Record<string, number>;
    dependencies?: string[];
  }): MCPResponseBuilder {
    this.metadata.debug = debug;
    return this;
  }

  /**
   * Create success response
   */
  success<T>(data: T): MCPSuccessResponse<T> {
    return {
      success: true,
      data,
      metadata: this.metadata as MCPResponseMetadata,
    };
  }

  /**
   * Create error response
   */
  error(error: Error | MCPBaseError, requestId?: string): MCPErrorResponse {
    if (error instanceof MCPBaseError) {
      return {
        success: false,
        error: error.toJSON().error,
        metadata: {
          ...this.metadata,
          ...(requestId && { requestId }),
        },
      };
    }

    return {
      success: false,
      error: createErrorResponse(error, requestId || this.metadata.requestId).error,
      metadata: this.metadata as MCPResponseMetadata,
    };
  }

  /**
   * Create financial tool response with audit metadata
   */
  financialSuccess<T>(
    data: T,
    audit: {
      traceId: string;
      verificationHash?: string;
      provenance: {
        source: string;
        filingType?: string;
        accessionNumber?: string;
        extractionMethod: string;
      };
    }
  ): MCPFinancialToolResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        ...this.metadata,
        tool: this.tool || "unknown",
        provider: this.provider || "unknown",
        tier: this.metadata.tier || "unknown",
        audit,
      } as MCPFinancialToolResponse<T>["metadata"],
    };
  }

  /**
   * Create CRM tool response with connection metadata
   */
  crmSuccess<T>(
    data: T,
    tenantId: string,
    connectionStatus: "connected" | "degraded" | "disconnected" = "connected"
  ): MCPCRMToolResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        ...this.metadata,
        tool: this.tool || "unknown",
        provider: this.provider || "unknown",
        tenantId,
        connectionStatus,
      } as MCPCRMToolResponse<T>["metadata"],
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a response builder for tool responses
 */
export function createResponseBuilder(
  tool?: string,
  provider?: string,
  requestId?: string
): MCPResponseBuilder {
  return new MCPResponseBuilder(tool, provider, requestId);
}

/**
 * Create simple success response
 */
export function createSuccessResponse<T>(
  data: T,
  metadata?: Partial<MCPResponseMetadata>
): MCPSuccessResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };
}

/**
 * Create simple error response
 */
export function createErrorResponseFromError(
  error: Error | MCPBaseError,
  metadata?: Partial<MCPResponseMetadata>
): MCPErrorResponse {
  const builder = new MCPResponseBuilder();
  if (metadata) {
    // Use builder methods to set metadata instead of direct access
    if (metadata.requestId) builder.withRequestId(metadata.requestId);
    if (metadata.provider) builder.withProvider(metadata.provider);
    if (metadata.tier) builder.withTier(metadata.tier);
    if (metadata.cacheHit !== undefined) builder.withCacheHit(metadata.cacheHit);
    if (metadata.rateLimitRemaining !== undefined)
      builder.withRateLimitRemaining(metadata.rateLimitRemaining);
    if (metadata.warnings) metadata.warnings.forEach((w) => builder.withWarning(w));
    if (metadata.duration !== undefined) builder.withDuration(metadata.duration);
    if (metadata.debug) builder.withDebug(metadata.debug);
  }
  return builder.error(error);
}

/**
 * Check if response is successful
 */
export function isSuccessResponse<T>(
  response: MCPBaseResponse<T>
): response is MCPSuccessResponse<T> {
  return response.success === true;
}

/**
 * Check if response is an error
 */
export function isErrorResponse(response: MCPBaseResponse): response is MCPErrorResponse {
  return response.success === false;
}

/**
 * Extract data from response with type safety
 */
export function getResponseData<T>(response: MCPSuccessResponse<T>): T;
export function getResponseData<T>(response: MCPErrorResponse): undefined;
export function getResponseData<T>(response: MCPBaseResponse<T>): T | undefined;
export function getResponseData<T>(response: MCPBaseResponse<T>): T | undefined {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  return undefined;
}

/**
 * Extract error from response with type safety
 */
export function getResponseError(response: MCPErrorResponse): MCPErrorResponse["error"];
export function getResponseError(response: MCPSuccessResponse): undefined;
export function getResponseError(response: MCPBaseResponse): MCPErrorResponse["error"] | undefined;
export function getResponseError(response: MCPBaseResponse): MCPErrorResponse["error"] | undefined {
  if (isErrorResponse(response)) {
    return response.error;
  }
  return undefined;
}

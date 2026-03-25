/**
 * MCP Base Error Classes
 *
 * Provides unified error handling across all MCP servers (Financial, CRM, Integrated)
 * with consistent structure, error codes, and metadata.
 */

// ============================================================================
// Error Code Constants
// ============================================================================

export const MCPErrorCodes = {
  // General errors
  INVALID_REQUEST: "INVALID_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  TIMEOUT: "TIMEOUT",
  UPSTREAM_FAILURE: "UPSTREAM_FAILURE",
  INTERNAL_ERROR: "INTERNAL_ERROR",

  // Financial server specific
  NO_DATA_FOUND: "NO_DATA_FOUND",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  CACHE_ERROR: "CACHE_ERROR",
  PARSE_ERROR: "PARSE_ERROR",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  TIER_UNAVAILABLE: "TIER_UNAVAILABLE",

  // CRM server specific
  CRM_CONNECTION_FAILED: "CRM_CONNECTION_FAILED",
  CRM_TOKEN_EXPIRED: "CRM_TOKEN_EXPIRED",
  CRM_PERMISSION_DENIED: "CRM_PERMISSION_DENIED",
  CRM_QUOTA_EXCEEDED: "CRM_QUOTA_EXCEEDED",
  CRM_INVALID_FIELD: "CRM_INVALID_FIELD",
  CRM_SYNC_FAILED: "CRM_SYNC_FAILED",

  // Configuration errors
  CONFIG_INVALID: "CONFIG_INVALID",
  CONFIG_MISSING: "CONFIG_MISSING",
  INTEGRATION_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",
} as const;

export type MCPErrorCode = (typeof MCPErrorCodes)[keyof typeof MCPErrorCodes];

// ============================================================================
// Base Error Classes
// ============================================================================

export interface MCPErrorMetadata {
  timestamp: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  provider?: string;
  tool?: string;
  retryable?: boolean;
  retryAfter?: number; // seconds
  upstreamService?: string;
  additionalContext?: Record<string, unknown>;
}

export interface MCPErrorDetails {
  field?: string;
  value?: unknown;
  expectedType?: string;
  allowedValues?: unknown[];
  validationErrors?: string[];
  upstreamErrorCode?: string;
  upstreamErrorMessage?: string;
}

/**
 * Base MCP Error class with common structure
 */
export abstract class MCPBaseError extends Error {
  public readonly code: MCPErrorCode;
  public readonly category: "general" | "financial" | "crm" | "config";
  public readonly metadata: MCPErrorMetadata;
  public readonly details?: MCPErrorDetails;


  constructor(
    code: MCPErrorCode,
    message: string,
    category: "general" | "financial" | "crm" | "config",
    metadata: Partial<MCPErrorMetadata> = {},
    details?: MCPErrorDetails,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.category = category;
    this.metadata = {
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    this.details = details;
    // Use Object.defineProperty to set cause without a class-level declaration.
    // A class property declaration triggers TS4113/TS4114 depending on whether
    // the consuming tsconfig's lib includes Error.cause (ES2022+).
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", { value: cause, enumerable: false, writable: false, configurable: true });
    }

    // Maintain stack trace for proper error handling
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to standardized JSON format
   */
  toJSON(): {
    error: {
      code: MCPErrorCode;
      message: string;
      category: string;
      metadata: MCPErrorMetadata;
      details?: MCPErrorDetails;
    };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        metadata: this.metadata,
        details: this.details,
      },
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.metadata.retryable ?? false;
  }

  /**
   * Get retry delay in seconds
   */
  getRetryDelay(): number {
    return this.metadata.retryAfter ?? 60;
  }
}

// ============================================================================
// Financial Server Errors
// ============================================================================

export class MCPFinancialError extends MCPBaseError {
  constructor(
    code: MCPErrorCode,
    message: string,
    metadata: Partial<MCPErrorMetadata> = {},
    details?: MCPErrorDetails,
    cause?: Error
  ) {
    super(code, message, "financial", metadata, details, cause);
  }
}

// ============================================================================
// CRM Server Errors
// ============================================================================

export class MCPCRMError extends MCPBaseError {
  constructor(
    code: MCPErrorCode,
    message: string,
    metadata: Partial<MCPErrorMetadata> = {},
    details?: MCPErrorDetails,
    cause?: Error
  ) {
    super(code, message, "crm", metadata, details, cause);
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

export class MCPConfigError extends MCPBaseError {
  constructor(
    code: MCPErrorCode,
    message: string,
    metadata: Partial<MCPErrorMetadata> = {},
    details?: MCPErrorDetails,
    cause?: Error
  ) {
    super(code, message, "config", metadata, details, cause);
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

export class MCPErrorFactory {
  /**
   * Create error based on context and code
   */
  static create(
    code: MCPErrorCode,
    message: string,
    context: {
      category: "general" | "financial" | "crm" | "config";
      metadata?: Partial<MCPErrorMetadata>;
      details?: MCPErrorDetails;
      cause?: Error;
    }
  ): MCPBaseError {
    switch (context.category) {
      case "financial":
        return new MCPFinancialError(
          code,
          message,
          context.metadata,
          context.details,
          context.cause
        );
      case "crm":
        return new MCPCRMError(code, message, context.metadata, context.details, context.cause);
      case "config":
        return new MCPConfigError(code, message, context.metadata, context.details, context.cause);
      default:
        return new MCPGeneralError(code, message, context.metadata, context.details, context.cause);
    }
  }

  /**
   * Create from existing error with context
   */
  static fromError(
    error: Error,
    code: MCPErrorCode = MCPErrorCodes.INTERNAL_ERROR,
    context: {
      category: "general" | "financial" | "crm" | "config";
      metadata?: Partial<MCPErrorMetadata>;
      details?: MCPErrorDetails;
    }
  ): MCPBaseError {
    return this.create(code, error.message, {
      ...context,
      cause: error,
    });
  }
}

// ============================================================================
// General Error (fallback)
// ============================================================================

export class MCPGeneralError extends MCPBaseError {
  constructor(
    code: MCPErrorCode,
    message: string,
    metadata: Partial<MCPErrorMetadata> = {},
    details?: MCPErrorDetails,
    cause?: Error
  ) {
    super(code, message, "general", metadata, details, cause);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if error is an MCP error
 */
export function isMCPError(error: unknown): error is MCPBaseError {
  return error instanceof MCPBaseError;
}

/**
 * Extract error code from any error
 */
export function getErrorCode(error: unknown): MCPErrorCode {
  if (isMCPError(error)) {
    return error.code;
  }
  return MCPErrorCodes.INTERNAL_ERROR;
}

/**
 * Extract user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (isMCPError(error)) {
    return error.message;
  }
  return error instanceof Error ? error.message : "An unknown error occurred";
}

/**
 * Create standardized error response
 */
export function createErrorResponse(error: unknown, requestId?: string) {
  if (isMCPError(error)) {
    const response = error.toJSON();
    if (requestId) {
      response.error.metadata.requestId = requestId;
    }
    return response;
  }

  // Handle non-MCP errors
  return {
    error: {
      code: MCPErrorCodes.INTERNAL_ERROR,
      message: getErrorMessage(error),
      category: "general",
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    },
  };
}

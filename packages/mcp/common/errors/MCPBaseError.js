"use strict";
/**
 * MCP Base Error Classes
 *
 * Provides unified error handling across all MCP servers (Financial, CRM, Integrated)
 * with consistent structure, error codes, and metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPGeneralError = exports.MCPErrorFactory = exports.MCPConfigError = exports.MCPCRMError = exports.MCPFinancialError = exports.MCPBaseError = exports.MCPErrorCodes = void 0;
exports.isMCPError = isMCPError;
exports.getErrorCode = getErrorCode;
exports.getErrorMessage = getErrorMessage;
exports.createErrorResponse = createErrorResponse;
// ============================================================================
// Error Code Constants
// ============================================================================
exports.MCPErrorCodes = {
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
};
/**
 * Base MCP Error class with common structure
 */
class MCPBaseError extends Error {
    code;
    category;
    metadata;
    details;
    cause;
    constructor(code, message, category, metadata = {}, details, cause) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.category = category;
        this.metadata = {
            timestamp: new Date().toISOString(),
            ...metadata,
        };
        this.details = details;
        this.cause = cause;
        // Maintain stack trace for proper error handling
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * Convert error to standardized JSON format
     */
    toJSON() {
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
    isRetryable() {
        return this.metadata.retryable ?? false;
    }
    /**
     * Get retry delay in seconds
     */
    getRetryDelay() {
        return this.metadata.retryAfter ?? 60;
    }
}
exports.MCPBaseError = MCPBaseError;
// ============================================================================
// Financial Server Errors
// ============================================================================
class MCPFinancialError extends MCPBaseError {
    constructor(code, message, metadata = {}, details, cause) {
        super(code, message, "financial", metadata, details, cause);
    }
}
exports.MCPFinancialError = MCPFinancialError;
// ============================================================================
// CRM Server Errors
// ============================================================================
class MCPCRMError extends MCPBaseError {
    constructor(code, message, metadata = {}, details, cause) {
        super(code, message, "crm", metadata, details, cause);
    }
}
exports.MCPCRMError = MCPCRMError;
// ============================================================================
// Configuration Errors
// ============================================================================
class MCPConfigError extends MCPBaseError {
    constructor(code, message, metadata = {}, details, cause) {
        super(code, message, "config", metadata, details, cause);
    }
}
exports.MCPConfigError = MCPConfigError;
// ============================================================================
// Error Factory Functions
// ============================================================================
class MCPErrorFactory {
    /**
     * Create error based on context and code
     */
    static create(code, message, context) {
        switch (context.category) {
            case "financial":
                return new MCPFinancialError(code, message, context.metadata, context.details, context.cause);
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
    static fromError(error, code = exports.MCPErrorCodes.INTERNAL_ERROR, context) {
        return this.create(code, error.message, {
            ...context,
            cause: error,
        });
    }
}
exports.MCPErrorFactory = MCPErrorFactory;
// ============================================================================
// General Error (fallback)
// ============================================================================
class MCPGeneralError extends MCPBaseError {
    constructor(code, message, metadata = {}, details, cause) {
        super(code, message, "general", metadata, details, cause);
    }
}
exports.MCPGeneralError = MCPGeneralError;
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Check if error is an MCP error
 */
function isMCPError(error) {
    return error instanceof MCPBaseError;
}
/**
 * Extract error code from any error
 */
function getErrorCode(error) {
    if (isMCPError(error)) {
        return error.code;
    }
    return exports.MCPErrorCodes.INTERNAL_ERROR;
}
/**
 * Extract user-friendly message from any error
 */
function getErrorMessage(error) {
    if (isMCPError(error)) {
        return error.message;
    }
    return error instanceof Error ? error.message : "An unknown error occurred";
}
/**
 * Create standardized error response
 */
function createErrorResponse(error, requestId) {
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
            code: exports.MCPErrorCodes.INTERNAL_ERROR,
            message: getErrorMessage(error),
            category: "general",
            metadata: {
                timestamp: new Date().toISOString(),
                requestId,
            },
        },
    };
}
//# sourceMappingURL=MCPBaseError.js.map
/**
 * MCP Standardized Response Types
 *
 * Provides unified response format across all MCP servers with consistent
 * structure for success, error, and metadata handling.
 */
import { MCPBaseError, createErrorResponse } from "../errors/MCPBaseError";
// ============================================================================
// Response Builder Classes
// ============================================================================
export class MCPResponseBuilder {
    tool;
    provider;
    requestId;
    metadata;
    constructor(tool, provider, requestId) {
        this.tool = tool;
        this.provider = provider;
        this.requestId = requestId;
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
    getMetadata() {
        return { ...this.metadata };
    }
    /**
     * Set request ID
     */
    withRequestId(requestId) {
        this.metadata.requestId = requestId;
        return this;
    }
    /**
     * Set provider
     */
    withProvider(provider) {
        this.metadata.provider = provider;
        return this;
    }
    /**
     * Set tier (for financial responses)
     */
    withTier(tier) {
        this.metadata.tier = tier;
        return this;
    }
    /**
     * Set cache hit status
     */
    withCacheHit(cacheHit) {
        this.metadata.cacheHit = cacheHit;
        return this;
    }
    /**
     * Set rate limit remaining
     */
    withRateLimitRemaining(remaining) {
        this.metadata.rateLimitRemaining = remaining;
        return this;
    }
    /**
     * Add warning
     */
    withWarning(warning) {
        if (!this.metadata.warnings) {
            this.metadata.warnings = [];
        }
        this.metadata.warnings.push(warning);
        return this;
    }
    /**
     * Set duration
     */
    withDuration(duration) {
        this.metadata.duration = duration;
        return this;
    }
    /**
     * Add debug information
     */
    withDebug(debug) {
        this.metadata.debug = debug;
        return this;
    }
    /**
     * Create success response
     */
    success(data) {
        return {
            success: true,
            data,
            metadata: this.metadata,
        };
    }
    /**
     * Create error response
     */
    error(error, requestId) {
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
            metadata: this.metadata,
        };
    }
    /**
     * Create financial tool response with audit metadata
     */
    financialSuccess(data, audit) {
        return {
            success: true,
            data,
            metadata: {
                ...this.metadata,
                tool: this.tool || "unknown",
                provider: this.provider || "unknown",
                tier: this.metadata.tier || "unknown",
                audit,
            },
        };
    }
    /**
     * Create CRM tool response with connection metadata
     */
    crmSuccess(data, tenantId, connectionStatus = "connected") {
        return {
            success: true,
            data,
            metadata: {
                ...this.metadata,
                tool: this.tool || "unknown",
                provider: this.provider || "unknown",
                tenantId,
                connectionStatus,
            },
        };
    }
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Create a response builder for tool responses
 */
export function createResponseBuilder(tool, provider, requestId) {
    return new MCPResponseBuilder(tool, provider, requestId);
}
/**
 * Create simple success response
 */
export function createSuccessResponse(data, metadata) {
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
export function createErrorResponseFromError(error, metadata) {
    const builder = new MCPResponseBuilder();
    if (metadata) {
        // Use builder methods to set metadata instead of direct access
        if (metadata.requestId)
            builder.withRequestId(metadata.requestId);
        if (metadata.provider)
            builder.withProvider(metadata.provider);
        if (metadata.tier)
            builder.withTier(metadata.tier);
        if (metadata.cacheHit !== undefined)
            builder.withCacheHit(metadata.cacheHit);
        if (metadata.rateLimitRemaining !== undefined)
            builder.withRateLimitRemaining(metadata.rateLimitRemaining);
        if (metadata.warnings)
            metadata.warnings.forEach((w) => builder.withWarning(w));
        if (metadata.duration !== undefined)
            builder.withDuration(metadata.duration);
        if (metadata.debug)
            builder.withDebug(metadata.debug);
    }
    return builder.error(error);
}
/**
 * Check if response is successful
 */
export function isSuccessResponse(response) {
    return response.success === true;
}
/**
 * Check if response is an error
 */
export function isErrorResponse(response) {
    return response.success === false;
}
export function getResponseData(response) {
    if (isSuccessResponse(response)) {
        return response.data;
    }
    return undefined;
}
export function getResponseError(response) {
    if (isErrorResponse(response)) {
        return response.error;
    }
    return undefined;
}
//# sourceMappingURL=Response.js.map
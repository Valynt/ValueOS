/**
 * MCP Financial Ground Truth Server - Type Definitions
 *
 * Defines all core types for the tiered truth model, data contracts,
 * and module interfaces.
 */
// ============================================================================
// Error Types
// ============================================================================
export class GroundTruthError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "GroundTruthError";
    }
}
export const ErrorCodes = {
    NO_DATA_FOUND: "NO_DATA_FOUND",
    UPSTREAM_FAILURE: "UPSTREAM_FAILURE",
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
    INVALID_REQUEST: "INVALID_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    CACHE_ERROR: "CACHE_ERROR",
    PARSE_ERROR: "PARSE_ERROR",
    TIMEOUT: "TIMEOUT",
};
//# sourceMappingURL=index.js.map
"use strict";
/**
 * @valueos/shared Feature Flags
 *
 * Shared feature flag definitions and parsing utilities.
 * This is the single source of truth for feature flag types and defaults.
 *
 * Usage:
 *   import { FeatureFlags, parseBoolean, getSecurityFlagDefaults } from '@valueos/shared';
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBoolean = parseBoolean;
exports.getSecurityFlagDefaults = getSecurityFlagDefaults;
exports.getDefaultFlags = getDefaultFlags;
exports.shouldEnableForUser = shouldEnableForUser;
/**
 * Parse boolean from environment variable
 */
function parseBoolean(value, defaultValue = false) {
    if (value === undefined)
        return defaultValue;
    return value.toLowerCase() === "true" || value === "1";
}
/**
 * Get security-safe defaults for production
 * Sprint 0: These MUST be false in production
 */
function getSecurityFlagDefaults(isProduction) {
    return {
        ENABLE_VALUE_COMMITMENT_SERVICE: false, // Always false until fully implemented
        ENABLE_AGENT_PLACEHOLDER_MODE: !isProduction,
        ENABLE_CLIENT_LLM_STREAMING: !isProduction,
    };
}
/**
 * Get full defaults for all flags
 */
function getDefaultFlags(isProduction) {
    const securityDefaults = getSecurityFlagDefaults(isProduction);
    return {
        // Orchestration - enabled by default
        ENABLE_UNIFIED_ORCHESTRATION: true,
        ENABLE_STATELESS_ORCHESTRATION: false, // deprecated
        // Security - enabled by default
        ENABLE_SAFE_JSON_PARSER: true,
        ENABLE_INPUT_SANITIZATION: true,
        ENABLE_CIRCUIT_BREAKER: true,
        ENABLE_RATE_LIMITING: true,
        ENABLE_AUDIT_LOGGING: true,
        // Observability - enabled by default
        ENABLE_TRACE_LOGGING: true,
        // Async - gradual rollout
        ENABLE_ASYNC_AGENT_EXECUTION: false,
        // Legacy - maintain backward compatibility
        DISABLE_LEGACY_BUSINESS_CASES: false,
        // Sprint 0: Security flags with safe defaults
        ENABLE_VALUE_COMMITMENT_SERVICE: securityDefaults.ENABLE_VALUE_COMMITMENT_SERVICE ?? false,
        ENABLE_AGENT_PLACEHOLDER_MODE: securityDefaults.ENABLE_AGENT_PLACEHOLDER_MODE ?? false,
        ENABLE_CLIENT_LLM_STREAMING: securityDefaults.ENABLE_CLIENT_LLM_STREAMING ?? false,
    };
}
/**
 * Rollout percentage for gradual feature enablement
 *
 * Usage:
 *   if (shouldEnableForUser(userId, 10)) { // 10% rollout
 *     // Use new feature
 *   }
 */
function shouldEnableForUser(userId, percentage) {
    if (percentage >= 100)
        return true;
    if (percentage <= 0)
        return false;
    // Deterministic hash-based rollout
    const hash = simpleHash(userId);
    return hash % 100 < percentage;
}
/**
 * Simple hash function for deterministic rollout
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}
//# sourceMappingURL=featureFlags.js.map
/**
 * Feature Flags Configuration
 *
 * Usage:
 *   import { featureFlags } from '@/config/featureFlags';
 *   if (featureFlags.ENABLE_UNIFIED_ORCHESTRATION) { ... }
 */

import { logger } from "../lib/logger.js";

/**
 * Feature flag configuration
 */
export interface FeatureFlags {
  /**
   * Enable unified orchestration (consolidates all orchestrators).
   * Retained for backward compatibility; runtime now uses ExecutionRuntime unconditionally.
   */
  ENABLE_UNIFIED_ORCHESTRATION: boolean;

  /**
   * @deprecated Use ENABLE_UNIFIED_ORCHESTRATION instead
   * Enable stateless orchestration (fixes singleton state bug)
   */
  ENABLE_STATELESS_ORCHESTRATION: boolean;

  /** Enable SafeJSON parser (fixes fragile JSON parsing) */
  ENABLE_SAFE_JSON_PARSER: boolean;

  /** Enable input sanitization at entry points */
  ENABLE_INPUT_SANITIZATION: boolean;

  /** Enable trace ID logging for observability */
  ENABLE_TRACE_LOGGING: boolean;

  /** Enable circuit breaker for agent execution */
  ENABLE_CIRCUIT_BREAKER: boolean;

  /** Enable rate limiting */
  ENABLE_RATE_LIMITING: boolean;

  /** Enable audit logging */
  ENABLE_AUDIT_LOGGING: boolean;

  /** Enable asynchronous agent execution (prevents blocking requests) */
  ENABLE_ASYNC_AGENT_EXECUTION: boolean;

  /**
   * Disable access to legacy 'business_cases' table
   * When enabled: Services will NOT fallback to business_cases
   * When disabled: Services maintain backward compatibility
   */
  DISABLE_LEGACY_BUSINESS_CASES: boolean;

  /**
   * Enable Value Commitment Service
   * Sprint 0: Disabled until fully implemented
   */
  ENABLE_VALUE_COMMITMENT_SERVICE: boolean;

  /**
   * Enable Agent placeholder/mock mode
   * Sprint 0: Must be false in production
   */
  ENABLE_AGENT_PLACEHOLDER_MODE: boolean;

  /**
   * Enable client-side LLM streaming
   * Sprint 0: Disabled in production until breaker integration complete
   */
  ENABLE_CLIENT_LLM_STREAMING: boolean;

  /**
   * Enable domain pack context loading in agents.
   * When enabled, agents load KPIs and assumptions from the attached domain pack.
   */
  ENABLE_DOMAIN_PACK_CONTEXT: boolean;
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Load feature flags from environment
 */
function loadFeatureFlags(): FeatureFlags {
  // Each flag reads a plain env var (e.g. ENABLE_CIRCUIT_BREAKER) so it can be
  // overridden at runtime in Node.js. VITE_* vars are injected by Vite at
  // frontend build time and are never present in the server process environment.
  const flags: FeatureFlags = {
    // Unified orchestration (consolidation flag)
    ENABLE_UNIFIED_ORCHESTRATION: parseBoolean(
      process.env.ENABLE_UNIFIED_ORCHESTRATION,
      true // Default: enabled (use consolidated orchestrator)
    ),
    // Legacy stateless flag (deprecated, kept for backward compatibility)
    ENABLE_STATELESS_ORCHESTRATION: parseBoolean(
      process.env.ENABLE_STATELESS_ORCHESTRATION,
      false // Default: disabled (superseded by unified)
    ),
    ENABLE_SAFE_JSON_PARSER: parseBoolean(
      process.env.ENABLE_SAFE_JSON_PARSER,
      true // Default: enabled (low risk, high benefit)
    ),
    ENABLE_INPUT_SANITIZATION: parseBoolean(
      process.env.ENABLE_INPUT_SANITIZATION,
      true // Default: enabled (security)
    ),
    ENABLE_TRACE_LOGGING: parseBoolean(
      process.env.ENABLE_TRACE_LOGGING,
      true // Default: enabled (observability)
    ),
    ENABLE_CIRCUIT_BREAKER: parseBoolean(
      process.env.ENABLE_CIRCUIT_BREAKER,
      true // Default: enabled (safety)
    ),
    ENABLE_RATE_LIMITING: parseBoolean(
      process.env.ENABLE_RATE_LIMITING,
      true // Default: enabled (security)
    ),
    ENABLE_AUDIT_LOGGING: parseBoolean(
      process.env.ENABLE_AUDIT_LOGGING,
      true // Default: enabled (compliance)
    ),
    ENABLE_ASYNC_AGENT_EXECUTION: parseBoolean(
      process.env.ENABLE_ASYNC_AGENT_EXECUTION,
      false // Default: disabled (gradual rollout)
    ),
    DISABLE_LEGACY_BUSINESS_CASES: parseBoolean(
      process.env.DISABLE_LEGACY_BUSINESS_CASES,
      false // Default: disabled (maintain backward compatibility)
    ),
    // Sprint 0: Security flags - default OFF in production
    ENABLE_VALUE_COMMITMENT_SERVICE: parseBoolean(
      process.env.ENABLE_VALUE_COMMITMENT_SERVICE,
      false // Default: disabled (stubbed implementation)
    ),
    ENABLE_AGENT_PLACEHOLDER_MODE: parseBoolean(
      process.env.ENABLE_AGENT_PLACEHOLDER_MODE,
      false // Default: disabled in all environments; set ENABLE_AGENT_PLACEHOLDER_MODE=true only in test
    ),
    ENABLE_CLIENT_LLM_STREAMING: parseBoolean(
      process.env.ENABLE_CLIENT_LLM_STREAMING,
      process.env.NODE_ENV !== "production" // Default: disabled in prod
    ),
    ENABLE_DOMAIN_PACK_CONTEXT: parseBoolean(
      process.env.ENABLE_DOMAIN_PACK_CONTEXT,
      true // Default: enabled; agents receive domain pack KPI context when a pack is assigned
    ),
  };

  // Log feature flag status on startup
  logger.info("Feature flags loaded", {
    unifiedOrchestration: flags.ENABLE_UNIFIED_ORCHESTRATION,
    statelessOrchestration: flags.ENABLE_STATELESS_ORCHESTRATION,
    safeJsonParser: flags.ENABLE_SAFE_JSON_PARSER,
    inputSanitization: flags.ENABLE_INPUT_SANITIZATION,
    traceLogging: flags.ENABLE_TRACE_LOGGING,
    circuitBreaker: flags.ENABLE_CIRCUIT_BREAKER,
    rateLimiting: flags.ENABLE_RATE_LIMITING,
    auditLogging: flags.ENABLE_AUDIT_LOGGING,
    asyncAgentExecution: flags.ENABLE_ASYNC_AGENT_EXECUTION,
    valueCommitmentService: flags.ENABLE_VALUE_COMMITMENT_SERVICE,
    agentPlaceholderMode: flags.ENABLE_AGENT_PLACEHOLDER_MODE,
    clientLlmStreaming: flags.ENABLE_CLIENT_LLM_STREAMING,
    domainPackContext: flags.ENABLE_DOMAIN_PACK_CONTEXT,
  });

  return flags;
}

/**
 * Global feature flags instance
 */
export const featureFlags = loadFeatureFlags();

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return featureFlags[feature];
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(featureFlags)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Get all disabled features
 */
export function getDisabledFeatures(): string[] {
  return Object.entries(featureFlags)
    .filter(([_, enabled]) => !enabled)
    .map(([feature]) => feature);
}

/**
 * Rollout percentage for gradual feature enablement
 *
 * Usage:
 *   if (shouldEnableForUser(userId, 10)) { // 10% rollout
 *     // Use new feature
 *   }
 */
export function shouldEnableForUser(userId: string, percentage: number): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;

  // Deterministic hash-based rollout
  const hash = simpleHash(userId);
  return hash % 100 < percentage;
}

/**
 * Simple hash function for deterministic rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

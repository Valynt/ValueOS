/**
 * Feature Flags Configuration
 * 
 * PHASE 3: Gradual rollout controls for critical remediation
 * 
 * Usage:
 *   import { featureFlags } from '@/config/featureFlags';
 *   if (featureFlags.ENABLE_STATELESS_ORCHESTRATION) { ... }
 */

import { logger } from '../lib/logger';

/**
 * Feature flag configuration
 */
export interface FeatureFlags {
  /** Enable stateless orchestration (fixes singleton state bug) */
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
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Load feature flags from environment
 */
function loadFeatureFlags(): FeatureFlags {
  const flags: FeatureFlags = {
    ENABLE_STATELESS_ORCHESTRATION: parseBoolean(
      import.meta.env.VITE_ENABLE_STATELESS_ORCHESTRATION,
      false // Default: disabled for safety
    ),
    ENABLE_SAFE_JSON_PARSER: parseBoolean(
      import.meta.env.VITE_ENABLE_SAFE_JSON_PARSER,
      true // Default: enabled (low risk, high benefit)
    ),
    ENABLE_INPUT_SANITIZATION: parseBoolean(
      import.meta.env.VITE_ENABLE_INPUT_SANITIZATION,
      true // Default: enabled (security)
    ),
    ENABLE_TRACE_LOGGING: parseBoolean(
      import.meta.env.VITE_ENABLE_TRACE_LOGGING,
      true // Default: enabled (observability)
    ),
    ENABLE_CIRCUIT_BREAKER: parseBoolean(
      import.meta.env.VITE_ENABLE_CIRCUIT_BREAKER,
      true // Default: enabled (safety)
    ),
    ENABLE_RATE_LIMITING: parseBoolean(
      import.meta.env.VITE_ENABLE_RATE_LIMITING,
      true // Default: enabled (security)
    ),
    ENABLE_AUDIT_LOGGING: parseBoolean(
      import.meta.env.VITE_ENABLE_AUDIT_LOGGING,
      true // Default: enabled (compliance)
    ),
  };

  // Log feature flag status on startup
  logger.info('Feature flags loaded', {
    statelessOrchestration: flags.ENABLE_STATELESS_ORCHESTRATION,
    safeJsonParser: flags.ENABLE_SAFE_JSON_PARSER,
    inputSanitization: flags.ENABLE_INPUT_SANITIZATION,
    traceLogging: flags.ENABLE_TRACE_LOGGING,
    circuitBreaker: flags.ENABLE_CIRCUIT_BREAKER,
    rateLimiting: flags.ENABLE_RATE_LIMITING,
    auditLogging: flags.ENABLE_AUDIT_LOGGING,
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
  return (hash % 100) < percentage;
}

/**
 * Simple hash function for deterministic rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

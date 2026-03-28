/**
 * Configuration Entry Point
 *
 * Central export for all configuration modules.
 * Provides easy access to env config, LLM config, and validation utilities.
 */

// Core configuration
export { getConfig, isProduction, isDevelopment, isTest, isFeatureEnabled } from './environment.js'
export type { EnvironmentConfig, AppEnvironment, LogLevel } from './environment.js'

// LLM configuration
export { llmConfig } from './llm.js'

// Validation
export {
  validateEnv,
  validateLLMConfig,
  validateEnvOrThrow,
} from './validateEnv';
export type { ValidationResult } from './validateEnv.js'

// Governance and entrypoint configuration
export {
  entrypointConfig,
  getEntryPointConfig,
  getIntentBinding,
  assertEntryPointAccess,
  EntryPointViolationError,
} from './entrypoints';
export type { EntryPoint, KernelIntent, EntryPointConfig, IntentBinding } from './entrypoints.js'

// Health check types (safe for client-side, moved to avoid importing server code)
export type { ConfigHealth, ComponentHealth, HealthStatus } from '../types/health';

// Health check functions (SERVER-SIDE ONLY - import directly from api/health/config in Node.js code)
// DO NOT export here as this file is used by client-side code

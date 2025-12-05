/**
 * Configuration Entry Point
 * 
 * Central export for all configuration modules.
 * Provides easy access to env config, LLM config, and validation utilities.
 */

// Core configuration
export { getConfig, isProduction, isDevelopment, isTest, isFeatureEnabled } from './environment';
export type { EnvironmentConfig, AppEnvironment, LogLevel } from './environment';

// LLM configuration
export { llmConfig } from './llm';

// Validation
export {
  validateEnv,
  validateLLMConfig,
  validateEnvOrThrow,
  logValidationResults,
} from './validateEnv';
export type { ValidationResult, LLMValidationResult } from './validateEnv';

// Health check types (safe for client-side, moved to avoid importing server code)
export type { ConfigHealth, ComponentHealth, HealthStatus } from '../types/health';

// Health check functions (SERVER-SIDE ONLY - import directly from api/health/config in Node.js code)
// DO NOT export here as this file is used by client-side code

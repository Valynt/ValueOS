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

// Health checks
export { getConfigHealth, logConfigHealth, getConfigHealthJSON } from '../api/health/config';
export type { ConfigHealth, ComponentHealth, HealthStatus } from '../api/health/config';

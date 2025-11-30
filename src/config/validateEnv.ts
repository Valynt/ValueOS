/**
 * Environment Variable Validation
 * 
 * Validates LLM and critical environment variables at application startup.
 * Complements the existing environment.ts validation with LLM-specific checks.
 * 
 * Architecture: Strict typing, fail-fast in production, warnings in development
 */

import { llmConfig } from './llm';
import type { LLMProvider } from '../lib/agent-fabric/llm-types';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * LLM configuration validation result
 */
export interface LLMValidationResult extends ValidationResult {
  provider: LLMProvider;
  gatingEnabled: boolean;
  providerAvailable: boolean;
}

/**
 * Get environment variable safely
 */
function getEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Check if running in production
 */
function isProduction(): boolean {
  const env = getEnv('VITE_APP_ENV') || getEnv('NODE_ENV');
  return env === 'production';
}

/**
 * Validate LLM configuration
 * 
 * Checks:
 * - Provider is valid
 * - Required API keys are present (server-side)
 * - No sensitive keys leaked to client
 */
export function validateLLMConfig(): LLMValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get current provider from llmConfig
  const { provider, gatingEnabled } = llmConfig;

  // Validate provider configuration
  if (!provider || (provider !== 'together' && provider !== 'openai')) {
    errors.push(
      `Invalid LLM provider: "${provider}". Must be "together" or "openai"`
    );
  }

  // Server-side validation (if in Node.js environment)
  const isNodeEnv = typeof process !== 'undefined' && process.env;
  let providerAvailable = false;

  if (isNodeEnv) {
    const togetherKey = process.env.TOGETHER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const leakedClientKeys = [
      'VITE_TOGETHER_API_KEY',
      'VITE_OPENAI_API_KEY',
      'VITE_SUPABASE_SERVICE_ROLE_KEY',
    ].filter((key) => Boolean(process.env[key]));

    if (leakedClientKeys.length > 0) {
      errors.push(
        `SECURITY: API keys must not use VITE_ prefix or be present in client builds: ${leakedClientKeys.join(', ')}`
      );
    }

    // Check provider-specific keys
    if (provider === 'together') {
      if (!togetherKey) {
        errors.push(
          'TOGETHER_API_KEY is required when VITE_LLM_PROVIDER=together'
        );
      } else {
        providerAvailable = true;
      }

      // Warn if OpenAI fallback unavailable
      if (!openaiKey) {
        warnings.push(
          'OPENAI_API_KEY not set - fallback to OpenAI will not be available'
        );
      }
    } else if (provider === 'openai') {
      if (!openaiKey) {
        errors.push('OPENAI_API_KEY is required when VITE_LLM_PROVIDER=openai');
      } else {
        providerAvailable = true;
      }
    }

    // Production-specific checks
    if (isProduction()) {
      // In production, we must have at least one provider configured
      if (!togetherKey && !openaiKey) {
        errors.push(
          'At least one LLM provider API key must be configured in production (TOGETHER_API_KEY or OPENAI_API_KEY)'
        );
      }
    }
  } else {
    // Client-side: can't validate server keys, assume available
    providerAvailable = true;
  }

  // Validate gating configuration
  if (typeof gatingEnabled !== 'boolean') {
    warnings.push(
      `Invalid VITE_LLM_GATING_ENABLED value. Expected "true" or "false", got: ${gatingEnabled}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    provider,
    gatingEnabled,
    providerAvailable,
  };
}

/**
 * Validate all critical environment variables
 * 
 * This is a comprehensive check that includes LLM + other critical vars
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate LLM configuration
  const llmValidation = validateLLMConfig();
  errors.push(...llmValidation.errors);
  warnings.push(...llmValidation.warnings);

  // 2. Validate Supabase configuration
  const supabaseUrl = getEnv('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl) {
    if (isProduction()) {
      errors.push('VITE_SUPABASE_URL is required in production');
    } else {
      warnings.push('VITE_SUPABASE_URL not set - database features will be disabled');
    }
  }

  if (!supabaseAnonKey) {
    if (isProduction()) {
      errors.push('VITE_SUPABASE_ANON_KEY is required in production');
    } else {
      warnings.push(
        'VITE_SUPABASE_ANON_KEY not set - authentication will not work'
      );
    }
  }

  // 3. Validate URLs in production
  if (isProduction()) {
    const appUrl = getEnv('VITE_APP_URL');
    const httpsOnly = getEnv('VITE_HTTPS_ONLY');

    if (appUrl && !appUrl.startsWith('https://') && httpsOnly !== 'false') {
      errors.push(
        'VITE_APP_URL must use HTTPS in production (or set VITE_HTTPS_ONLY=false)'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log validation results
 */
export function logValidationResults(result: ValidationResult): void {
  if (result.errors.length > 0) {
    console.error('[ENV Validation] Errors:', result.errors);
  }

  if (result.warnings.length > 0) {
    console.warn('[ENV Validation] Warnings:', result.warnings);
  }

  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    console.info('[ENV Validation] ✓ All environment variables valid');
  }
}

/**
 * Validate and throw on critical errors in production
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();

  // Log all results
  logValidationResults(result);

  // Throw in production if invalid
  if (!result.valid && isProduction()) {
    throw new Error(
      `Environment validation failed with ${result.errors.length} error(s). Check console for details.`
    );
  }
}

/**
 * Environment Variable Validation
 *
 * Validates LLM and critical environment variables at application startup.
 * Complements the existing environment.ts validation with LLM-specific checks.
 *
 * Architecture: Strict typing, fail-fast in production, warnings in development
 */

import { llmConfig } from "./llm";
import type { LLMProvider } from "../lib/agent-fabric/llm-types";
import { createLogger } from "../lib/logger";

const validationLogger = createLogger({ component: "EnvValidation" });

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  isValid: boolean;
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
  if (typeof import.meta !== "undefined" && (import.meta as any)?.env) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Check if running in production
 */
function isProduction(): boolean {
  const env = getEnv("VITE_APP_ENV") || getEnv("NODE_ENV");
  return env === "production";
}

/**
 * Check if a value is valid (not empty and not a placeholder)
 */
function isValidValue(val: string | undefined): boolean {
  return !!val && !val.includes("placeholder") && !val.includes("your-");
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

  // Validate provider configuration - Together AI is the only supported provider
  if (!provider || provider !== "together") {
    errors.push(
      `Invalid LLM provider: "${provider}". Must be "together" (Together AI is the only supported provider)`
    );
  }

  // Server-side validation (if in Node.js environment)
  const isNodeEnv = typeof process !== "undefined" && process.env;
  let providerAvailable = false;

  if (isNodeEnv) {
    const togetherKey = process.env.TOGETHER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const leakedClientKeys = [
      "VITE_TOGETHER_API_KEY",
      "VITE_SUPABASE_SERVICE_ROLE_KEY",
    ].filter((key) => Boolean(process.env[key]));

    if (leakedClientKeys.length > 0) {
      errors.push(
        `SECURITY: API keys must not use VITE_ prefix or be present in client builds: ${leakedClientKeys.join(", ")}`
      );
    }

    // Check Together AI API key
    if (provider === "together") {
      if (!isValidValue(togetherKey)) {
        errors.push(
          "TOGETHER_API_KEY is required and must not be a placeholder"
        );
      } else {
        providerAvailable = true;
      }
    }

    // Production-specific checks
    if (isProduction()) {
      // In production, Together AI API key must be configured
      if (!togetherKey) {
        errors.push("TOGETHER_API_KEY must be configured in production");
      }
    }
  } else {
    // Client-side: can't validate server keys, assume available
    providerAvailable = true;
  }

  // Validate gating configuration
  if (typeof gatingEnabled !== "boolean") {
    warnings.push(
      `Invalid VITE_LLM_GATING_ENABLED value. Expected "true" or "false", got: ${gatingEnabled}`
    );
  }

  const isValid = errors.length === 0;
  return {
    valid: isValid,
    isValid,
    errors,
    warnings,
    provider,
    gatingEnabled,
    providerAvailable,
  };
}

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const supabaseUrl = getEnv("VITE_SUPABASE_URL");
  const supabaseAnonKey = getEnv("VITE_SUPABASE_ANON_KEY");

  if (!isValidValue(supabaseUrl)) {
    if (isProduction()) {
      errors.push("VITE_SUPABASE_URL is required in production");
    } else {
      warnings.push(
        "VITE_SUPABASE_URL not set or invalid - database features will be disabled"
      );
    }
  }

  if (!isValidValue(supabaseAnonKey)) {
    if (isProduction()) {
      errors.push("VITE_SUPABASE_ANON_KEY is required in production");
    } else {
      warnings.push(
        "VITE_SUPABASE_ANON_KEY not set or invalid - authentication will not work"
      );
    }
  }

  // Server-side configuration
  const isNodeEnv = typeof process !== "undefined" && process.env;
  if (isNodeEnv) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const databaseUrl = process.env.DATABASE_URL;

    if (!isValidValue(serviceRoleKey)) {
      if (isProduction()) {
        errors.push("SUPABASE_SERVICE_ROLE_KEY is required in production");
      } else {
        warnings.push("SUPABASE_SERVICE_ROLE_KEY not set or invalid");
      }
    }

    if (!isValidValue(databaseUrl)) {
      if (isProduction()) {
        errors.push("DATABASE_URL is required in production");
      } else {
        warnings.push("DATABASE_URL not set or invalid");
      }
    }
  }

  const isValid = errors.length === 0;
  return {
    valid: isValid,
    isValid,
    errors,
    warnings,
  };
}

/**
 * Validate all critical environment variables
 *
 * This is a comprehensive check that includes LLM + other critical vars
 */
export function validateEnv(): ValidationResult & {
  llm: LLMValidationResult;
  supabase: ValidationResult;
  summary: { totalErrors: number; totalWarnings: number };
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate LLM configuration
  const llmValidation = validateLLMConfig();
  errors.push(...llmValidation.errors);
  warnings.push(...llmValidation.warnings);

  // 2. Validate Supabase configuration
  const supabaseValidation = validateSupabaseConfig();
  errors.push(...supabaseValidation.errors);
  warnings.push(...supabaseValidation.warnings);

  // 3. Validate URLs in production
  if (isProduction()) {
    const appUrl = getEnv("VITE_APP_URL");
    const httpsOnly = getEnv("VITE_HTTPS_ONLY");

    if (appUrl && !appUrl.startsWith("https://") && httpsOnly !== "false") {
      errors.push(
        "VITE_APP_URL must use HTTPS in production (or set VITE_HTTPS_ONLY=false)"
      );
    }
  }

  const isValid = errors.length === 0;

  return {
    valid: isValid,
    isValid,
    errors,
    warnings,
    llm: llmValidation,
    supabase: supabaseValidation,
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
    },
  };
}

/**
 * Log validation results
 */
export function logValidationResults(result: ValidationResult): void {
  if (result.errors.length > 0) {
    validationLogger.error(
      "ENV validation errors",
      new Error("Invalid environment configuration"),
      {
        errors: result.errors,
      }
    );
  }

  if (result.warnings.length > 0) {
    validationLogger.warn("ENV validation warnings", {
      warnings: result.warnings,
    });
  }

  if (
    result.isValid &&
    result.errors.length === 0 &&
    result.warnings.length === 0
  ) {
    validationLogger.info("ENV validation passed");
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
  if (!result.isValid && isProduction()) {
    throw new Error(
      `Environment validation failed with ${result.errors.length} error(s). Check console for details.`
    );
  }
}

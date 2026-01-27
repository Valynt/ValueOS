/**
 * Secret Validation System
 *
 * Validates that all required secrets are properly configured
 * at application startup with detailed error reporting
 */

import { z } from "zod";
import { logger } from "../../lib/logger.js"
import { createProviderFromEnv as getSecretProvider } from "./ProviderFactory.js"
import {
  createSecretVolumeWatcher,
  secretVolumeWatcher,
} from "./SecretVolumeWatcher";

/**
 * Secret definition with validation rules
 */
export interface SecretDefinition {
  key: string;
  required: boolean;
  requiredIf?: (env: NodeJS.ProcessEnv) => boolean;
  description: string;
  pattern?: RegExp;
  minLength?: number;
  environment?: string[]; // Environments where this secret is required
  category:
    | "database"
    | "auth"
    | "api"
    | "security"
    | "infrastructure"
    | "external";
  critical?: boolean; // If true, missing secret prevents startup
}

/**
 * Secret validation result
 */
export interface SecretValidationResult {
  isValid: boolean;
  missingSecrets: string[];
  invalidSecrets: Array<{ key: string; error: string }>;
  warnings: Array<{ key: string; message: string }>;
  criticalFailures: string[];
}

/**
 * Comprehensive secret definitions for ValueOS
 */
export const SECRET_DEFINITIONS: SecretDefinition[] = [
  // Database Secrets
  {
    key: "DATABASE_URL",
    required: false,
    description: "Optional direct Postgres connection URL (Supabase admin tasks)",
    pattern: /^postgres:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^\/]+$/,
    category: "database",
    critical: false,
  },
  {
    key: "SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
    pattern: /^https:\/\/[^\.]+\.supabase\.co$/,
    category: "database",
    critical: true,
  },
  {
    key: "SUPABASE_SERVICE_KEY",
    required: true,
    description: "Supabase service role key (server-only)",
    minLength: 20,
    category: "auth",
    critical: true,
  },
  {
    key: "SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key (server-side usage)",
    minLength: 20,
    category: "auth",
    critical: true,
  },
  {
    key: "VITE_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key (client-safe)",
    minLength: 20,
    category: "auth",
    critical: true,
  },

  // Authentication & Security
  {
    key: "JWT_SECRET",
    required: true,
    description: "JWT signing secret",
    minLength: 32,
    category: "security",
    critical: true,
  },
  {
    key: "ENCRYPTION_KEY",
    required: true,
    description: "Data encryption key",
    minLength: 32,
    category: "security",
    critical: true,
  },

  // External API Keys
  {
    key: "TOGETHER_API_KEY",
    required: true,
    description: "Together AI API key for LLM services",
    minLength: 20,
    category: "external",
    critical: false,
  },
  {
    key: "OPENAI_API_KEY",
    required: false,
    description: "OpenAI API key (alternative LLM provider)",
    pattern: /^sk-[A-Za-z0-9]{48}$/,
    category: "external",
    critical: false,
  },

  // Infrastructure Services
  {
    key: "REDIS_URL",
    required: true,
    description: "Redis cache connection URL",
    pattern: /^redis:\/\/[^:]+:\d+$/,
    category: "infrastructure",
    critical: false, // Can run without Redis (degraded mode)
  },

  // Billing Secrets
  {
    key: "STRIPE_SECRET_KEY",
    required: false,
    requiredIf: (env) => env.ENABLE_BILLING === "true",
    description: "Stripe secret key for billing operations",
    category: "external",
    critical: false,
  },
  {
    key: "VITE_STRIPE_PUBLISHABLE_KEY",
    required: false,
    requiredIf: (env) => env.ENABLE_BILLING === "true",
    description: "Stripe publishable key for billing UI",
    category: "external",
    critical: false,
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    required: false,
    requiredIf: (env) => env.ENABLE_BILLING === "true",
    description: "Stripe webhook signing secret",
    category: "external",
    critical: false,
  },
  {
    key: "SENTRY_DSN",
    required: false,
    description: "Sentry error tracking DSN",
    pattern: /^https:\/\/[^@]+@[^\/]+\/\d+$/,
    category: "infrastructure",
    critical: false,
  },

  // Monitoring & Observability
  {
    key: "PROMETHEUS_METRICS_ENABLED",
    required: false,
    description: "Enable Prometheus metrics collection",
    category: "infrastructure",
    critical: false,
  },
  {
    key: "AWS_REGION",
    required: false,
    description: "AWS region for cloud services",
    pattern: /^[a-z]{2}-[a-z]+-\d+$/,
    category: "infrastructure",
    critical: false,
  },
];

/**
 * Secret Validator class
 */
export class SecretValidator {
  private secretProvider = getSecretProvider();
  private environment = process.env.NODE_ENV || "development";

  /**
   * Validate all configured secrets
   */
  async validateAllSecrets(): Promise<SecretValidationResult> {
    logger.info("Starting comprehensive secret validation", {
      environment: this.environment,
      totalSecrets: SECRET_DEFINITIONS.length,
    });

    const result: SecretValidationResult = {
      isValid: true,
      missingSecrets: [],
      invalidSecrets: [],
      warnings: [],
      criticalFailures: [],
    };

    // Group secrets by category for better error reporting
    const secretsByCategory = this.groupSecretsByCategory();

    for (const [category, secrets] of Object.entries(secretsByCategory)) {
      logger.debug(`Validating ${category} secrets`, { count: secrets.length });

      for (const secretDef of secrets) {
        await this.validateSingleSecret(secretDef, result);
      }
    }

    // Log validation summary
    this.logValidationSummary(result);

    return result;
  }

  /**
   * Validate a single secret
   */
  private async validateSingleSecret(
    secretDef: SecretDefinition,
    result: SecretValidationResult
  ): Promise<void> {
    const {
      key,
      required,
      requiredIf,
      description,
      pattern,
      minLength,
      critical,
      environment,
    } = secretDef;

    const isRequired = required || (requiredIf ? requiredIf(process.env) : false);

    // Skip if not required in current environment
    if (environment && !environment.includes(this.environment)) {
      return;
    }

    try {
      let secretValue: string | undefined;

      // Try to get from secret provider first
      if (this.secretProvider) {
        secretValue = await this.secretProvider.getSecret(key);
      }

      // Fall back to environment variables
      if (!secretValue) {
        secretValue = process.env[key];
      }

      // Check if secret exists
      if (!secretValue) {
        if (isRequired) {
          result.missingSecrets.push(key);
          result.isValid = false;
          if (critical) {
            result.criticalFailures.push(key);
          }
        } else {
          result.warnings.push({
            key,
            message: `Optional secret not configured: ${description}`,
          });
        }
        return;
      }

      // Validate secret format
      const validationError = this.validateSecretFormat(secretValue, secretDef);
      if (validationError) {
        result.invalidSecrets.push({
          key,
          error: validationError,
        });
        result.isValid = false;
        if (critical) {
          result.criticalFailures.push(key);
        }
      }
    } catch (error) {
      const errorMessage = `Failed to validate secret ${key}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;

      result.invalidSecrets.push({
        key,
        error: errorMessage,
      });
      result.isValid = false;

      if (critical) {
        result.criticalFailures.push(key);
      }

      logger.error(
        "Secret validation error",
        error instanceof Error ? error : new Error(errorMessage),
        {
          secretKey: key,
        }
      );
    }
  }

  /**
   * Validate secret format against rules
   */
  private validateSecretFormat(
    value: string,
    secretDef: SecretDefinition
  ): string | null {
    const { pattern, minLength, key } = secretDef;

    // Check minimum length
    if (minLength && value.length < minLength) {
      return `Secret too short (minimum ${minLength} characters, got ${value.length})`;
    }

    // Check pattern
    if (pattern && !pattern.test(value)) {
      return `Secret format invalid (does not match required pattern)`;
    }

    // Check for common weak patterns
    if (key.includes("PASSWORD") && value.length < 16) {
      return "Password should be at least 16 characters long";
    }

    if (
      key.includes("KEY") &&
      (value === "dev_password" || value === "test-key")
    ) {
      return "Using development/placeholder secret in non-development environment";
    }

    return null;
  }

  /**
   * Group secrets by category for organized validation
   */
  private groupSecretsByCategory(): Record<string, SecretDefinition[]> {
    const grouped: Record<string, SecretDefinition[]> = {};

    for (const secret of SECRET_DEFINITIONS) {
      if (!grouped[secret.category]) {
        grouped[secret.category] = [];
      }
      grouped[secret.category].push(secret);
    }

    return grouped;
  }

  /**
   * Log validation summary with appropriate severity
   */
  private logValidationSummary(result: SecretValidationResult): void {
    const {
      isValid,
      missingSecrets,
      invalidSecrets,
      warnings,
      criticalFailures,
    } = result;

    if (isValid) {
      logger.info("✅ All secrets validated successfully", {
        totalChecked: SECRET_DEFINITIONS.length,
        warnings: warnings.length,
      });
      return;
    }

    // Log critical failures first
    if (criticalFailures.length > 0) {
      logger.error("🚨 CRITICAL: Missing or invalid critical secrets", {
        criticalFailures,
        environment: this.environment,
      });
    }

    // Log missing secrets
    if (missingSecrets.length > 0) {
      logger.error("❌ Missing required secrets", {
        missingSecrets,
        count: missingSecrets.length,
      });
    }

    // Log invalid secrets
    if (invalidSecrets.length > 0) {
      logger.error("❌ Invalid secret formats", {
        invalidSecrets,
        count: invalidSecrets.length,
      });
    }

    // Log warnings
    if (warnings.length > 0) {
      logger.warn("⚠️ Secret validation warnings", {
        warnings,
        count: warnings.length,
      });
    }

    // Overall summary
    logger.error("🔒 Secret validation failed", {
      isValid,
      criticalFailures: criticalFailures.length,
      missingSecrets: missingSecrets.length,
      invalidSecrets: invalidSecrets.length,
      warnings: warnings.length,
      environment: this.environment,
    });
  }

  /**
   * Get secret health check for monitoring
   */
  async getSecretHealthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    details: Record<string, any>;
  }> {
    const result = await this.validateAllSecrets();

    let status: "healthy" | "degraded" | "unhealthy";

    if (result.criticalFailures.length > 0) {
      status = "unhealthy";
    } else if (!result.isValid) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return {
      status,
      details: {
        totalSecrets: SECRET_DEFINITIONS.length,
        validSecrets:
          SECRET_DEFINITIONS.length -
          result.missingSecrets.length -
          result.invalidSecrets.length,
        missingSecrets: result.missingSecrets.length,
        invalidSecrets: result.invalidSecrets.length,
        warnings: result.warnings.length,
        criticalFailures: result.criticalFailures.length,
        secretVolumeWatcherActive: secretVolumeWatcher?.isActive() || false,
      },
    };
  }

  /**
   * Generate secret configuration report
   */
  generateSecretReport(): {
    categories: Record<
      string,
      { total: number; required: number; critical: number }
    >;
    environmentSpecific: Record<string, string[]>;
  } {
    const categories: Record<
      string,
      { total: number; required: number; critical: number }
    > = {};
    const environmentSpecific: Record<string, string[]> = {};

    for (const secret of SECRET_DEFINITIONS) {
      // Categorize
      if (!categories[secret.category]) {
        categories[secret.category] = { total: 0, required: 0, critical: 0 };
      }
      categories[secret.category].total++;
      if (secret.required) categories[secret.category].required++;
      if (secret.critical) categories[secret.category].critical++;

      // Environment-specific
      if (secret.environment) {
        for (const env of secret.environment) {
          if (!environmentSpecific[env]) {
            environmentSpecific[env] = [];
          }
          environmentSpecific[env].push(secret.key);
        }
      }
    }

    return { categories, environmentSpecific };
  }
}

/**
 * Validate secrets at application startup
 */
export async function validateSecretsOnStartup(): Promise<void> {
  try {
    const secretValidator = new SecretValidator();
    const result = await secretValidator.validateAllSecrets();

    // Fail startup if critical secrets are missing
    if (result.criticalFailures.length > 0) {
      const errorMessage = `CRITICAL: Application cannot start due to ${result.criticalFailures.length} missing/invalid critical secrets: ${result.criticalFailures.join(", ")}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Log warnings but continue startup
    if (!result.isValid) {
      logger.warn("Application starting with secret validation warnings", {
        issues: result.missingSecrets.length + result.invalidSecrets.length,
      });
    }
  } catch (error) {
    logger.error(
      "Secret validation failed at startup",
      error instanceof Error ? error : new Error("Unknown error")
    );
    throw error;
  }
}

/**
 * Express middleware for secret health check endpoint
 */
const secretValidator = new SecretValidator();

export function secretHealthMiddleware() {
  return async (req: any, res: any) => {
    try {
      const health = await secretValidator.getSecretHealthCheck();
      const statusCode =
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 200
            : 503;

      res.status(statusCode).json({
        service: "secret-validator",
        status: health.status,
        timestamp: new Date().toISOString(),
        details: health.details,
      });
    } catch (error) {
      res.status(503).json({
        service: "secret-validator",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

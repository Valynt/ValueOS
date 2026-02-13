/**
 * Environment Variable Validation with Zod Schemas
 *
 * Provides comprehensive validation for all environment variables with safe defaults,
 * maintenance mode flags, and detailed error reporting for HA deployment.
 */

import { z } from "zod";
import { writeStdout, writeStderr } from "./environment";

/**
 * Base environment schema with common validations
 */
const baseEnvSchema = z.object({
  // Application Environment
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),

  // Server Configuration
  PORT: z.string().transform(Number).pipe(z.number().positive().max(65535)).default("5173"),
  HOST: z.string().ip().default("0.0.0.0"),

  // Database Configuration
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(65535))
    .default("5432"),
  POSTGRES_DB: z.string().default("valueos_dev"),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().min(1).default("dev_password"),

  // Redis Configuration
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().positive().max(65535)).default("6379"),

  // Supabase Configuration
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // API Configuration
  API_URL: z.string().url().optional(),
  VITE_API_BASE_URL: z.string().default("/api"),

  // HA Configuration
  INSTANCE_ID: z.string().default("primary"),
  REGION: z.enum(["us-east-1", "eu-west-1", "ap-southeast-1"]).default("us-east-1"),
  CLUSTER_NAME: z.string().default("valueos-ha"),

  // Monitoring and Observability
  PROMETHEUS_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("true"),
  PROMETHEUS_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(65535))
    .default("9090"),
  GRAFANA_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("true"),
  GRAFANA_PORT: z.string().transform(Number).pipe(z.number().positive().max(65535)).default("3000"),

  // Security Configuration
  CSRF_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("true"),
  CSP_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("true"),
  HTTPS_ONLY: z.enum(["true", "false"]).transform(Boolean).default("false"),

  // Feature Flags
  ENABLE_AGENT_FABRIC: z.enum(["true", "false"]).transform(Boolean).default("true"),
  ENABLE_WORKFLOW: z.enum(["true", "false"]).transform(Boolean).default("true"),
  ENABLE_COMPLIANCE: z.enum(["true", "false"]).transform(Boolean).default("true"),
  ENABLE_MULTI_TENANT: z.enum(["true", "false"]).transform(Boolean).default("false"),
  ENABLE_USAGE_TRACKING: z.enum(["true", "false"]).transform(Boolean).default("true"),
  ENABLE_BILLING: z.enum(["true", "false"]).transform(Boolean).default("false"),

  // HA Specific Configuration
  MAINTENANCE_MODE: z.enum(["true", "false"]).transform(Boolean).default("false"),
  AUTO_ROLLBACK_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("true"),
  HEALTH_CHECK_INTERVAL: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(300))
    .default("15"),
  HEALTH_CHECK_TIMEOUT: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(60))
    .default("5"),
  HEALTH_CHECK_RETRIES: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(10))
    .default("3"),

  // CDN Configuration
  CDN_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("false"),
  CDN_PROVIDER: z.enum(["cloudflare", "cloudfront", "fastly"]).optional(),
  CDN_CACHE_TTL: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(31536000))
    .default("3600"),

  // External Services
  TOGETHER_API_KEY: z.string().min(1).optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // Development Configuration
  VITE_HMR_HOST: z.string().default("localhost"),
  VITE_HMR_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().positive().max(65535))
    .default("24678"),
});

/**
 * Production-specific schema with stricter validations
 */
const productionEnvSchema = baseEnvSchema.extend({
  NODE_ENV: z.literal("production"),

  // Production requires secure defaults
  HTTPS_ONLY: z.literal("true").transform(Boolean),
  CSRF_ENABLED: z.literal("true").transform(Boolean),
  CSP_ENABLED: z.literal("true").transform(Boolean),

  // Production requires database configuration
  DATABASE_URL: z.string().url("Production requires DATABASE_URL"),
  SUPABASE_URL: z.string().url("Production requires SUPABASE_URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "Production requires SUPABASE_ANON_KEY"),
  VITE_SUPABASE_URL: z.string().url("Production requires VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, "Production requires VITE_SUPABASE_ANON_KEY"),

  // Production monitoring requirements
  PROMETHEUS_ENABLED: z.literal("true").transform(Boolean),
  GRAFANA_ENABLED: z.literal("true").transform(Boolean),

  // Production HA requirements
  AUTO_ROLLBACK_ENABLED: z.literal("true").transform(Boolean),
  CDN_ENABLED: z.literal("true").transform(Boolean),
  CDN_PROVIDER: z.enum(["cloudflare", "cloudfront", "fastly"], "Production requires CDN_PROVIDER"),
});

/**
 * Development-specific schema with relaxed validations
 */
const developmentEnvSchema = baseEnvSchema.extend({
  NODE_ENV: z.enum(["development", "test"]),

  // Development allows optional services
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),

  // Development defaults
  HTTPS_ONLY: z.enum(["true", "false"]).transform(Boolean).default("false"),
  PROMETHEUS_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("false"),
  GRAFANA_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("false"),
  CDN_ENABLED: z.enum(["true", "false"]).transform(Boolean).default("false"),
});

/**
 * Validation result interface
 */
export interface EnvValidationResult {
  success: boolean;
  data: any;
  errors: string[];
  warnings: string[];
  maintenanceMode: boolean;
  safeDefaults: Record<string, any>;
}

/**
 * Validate environment variables with appropriate schema
 */
export function validateEnvironment(
  env: Record<string, string> = process.env
): EnvValidationResult {
  const nodeEnv = env.NODE_ENV || "development";
  const errors: string[] = [];
  const warnings: string[] = [];
  let safeDefaults: Record<string, any> = {};

  writeStdout(`🔍 Validating environment configuration for ${nodeEnv}...`);

  try {
    // Select appropriate schema based on environment
    let schema;
    if (nodeEnv === "production") {
      schema = productionEnvSchema;
    } else if (nodeEnv === "development" || nodeEnv === "test") {
      schema = developmentEnvSchema;
    } else {
      schema = baseEnvSchema;
    }

    // Parse and validate
    const result = schema.safeParse(env);

    if (!result.success) {
      // Format Zod errors for better readability
      result.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        const message = issue.message;

        if (issue.code === "invalid_type") {
          errors.push(
            `Invalid type for ${path}: expected ${issue.expected}, received ${issue.received}`
          );
        } else if (issue.code === "invalid_literal") {
          errors.push(`Invalid value for ${path}: ${issue.received} is not allowed`);
        } else {
          errors.push(`${path}: ${message}`);
        }
      });

      writeStderr(`❌ Environment validation failed with ${errors.length} errors`);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        maintenanceMode: true,
        safeDefaults: {},
      };
    }

    const validatedData = result.data;

    // Check for maintenance mode
    const maintenanceMode = validatedData.MAINTENANCE_MODE;

    // Generate warnings for non-critical issues
    if (nodeEnv === "production" && !validatedData.TOGETHER_API_KEY) {
      warnings.push("TOGETHER_API_KEY not set - AI features will be disabled");
    }

    if (nodeEnv === "production" && !validatedData.SLACK_WEBHOOK_URL) {
      warnings.push("SLACK_WEBHOOK_URL not set - notifications will be disabled");
    }

    if (validatedData.CDN_ENABLED && !validatedData.CDN_PROVIDER) {
      warnings.push("CDN enabled but no provider specified - CDN will be disabled");
    }

    // Create safe defaults for missing optional values
    safeDefaults = {
      ...validatedData,
      // Ensure critical values have fallbacks
      DATABASE_URL:
        validatedData.DATABASE_URL ||
        `postgresql://${validatedData.POSTGRES_USER}:${validatedData.POSTGRES_PASSWORD}@${validatedData.POSTGRES_HOST}:${validatedData.POSTGRES_PORT}/${validatedData.POSTGRES_DB}`,
      REDIS_URL:
        validatedData.REDIS_URL ||
        `redis://${validatedData.REDIS_HOST}:${validatedData.REDIS_PORT}`,
      SUPABASE_URL:
        validatedData.SUPABASE_URL || validatedData.VITE_SUPABASE_URL || "https://your-project.supabase.co",
      SUPABASE_ANON_KEY:
        validatedData.SUPABASE_ANON_KEY || validatedData.VITE_SUPABASE_ANON_KEY || "dev-key",
    };

    writeStdout(`✅ Environment validation successful`);
    if (warnings.length > 0) {
      writeStdout(`⚠️  ${warnings.length} warnings detected`);
    }

    return {
      success: true,
      data: validatedData,
      errors,
      warnings,
      maintenanceMode,
      safeDefaults,
    };
  } catch (error) {
    const errorMsg = `Unexpected error during validation: ${error instanceof Error ? error.message : String(error)}`;
    writeStderr(`💥 ${errorMsg}`);

    return {
      success: false,
      data: null,
      errors: [errorMsg],
      warnings,
      maintenanceMode: true,
      safeDefaults: {},
    };
  }
}

/**
 * Get validated environment with safe defaults
 * This is the main function to use in application code
 */
export function getValidatedEnvironment(): EnvValidationResult & { config: Record<string, any> } {
  const result = validateEnvironment();

  if (!result.success) {
    writeStderr("🚨 Critical environment validation errors detected");
    writeStderr("Application will run in maintenance mode");

    // Return minimal safe configuration for maintenance mode
    return {
      ...result,
      config: {
        NODE_ENV: "maintenance",
        MAINTENANCE_MODE: true,
        PORT: 5173,
        HOST: "0.0.0.0",
        // Minimal safe defaults
        DATABASE_URL: "postgresql://postgres:password@localhost:5432/maintenance",
        REDIS_URL: "redis://localhost:6379",
        SUPABASE_URL: "https://your-project.supabase.co",
        SUPABASE_ANON_KEY: "maintenance-key",
        VITE_SUPABASE_URL: "https://your-project.supabase.co",
        VITE_SUPABASE_ANON_KEY: "maintenance-key",
        VITE_API_BASE_URL: "/api",
        INSTANCE_ID: "maintenance",
        REGION: "us-east-1",
        HTTPS_ONLY: false,
        CSRF_ENABLED: true,
        CSP_ENABLED: true,
        PROMETHEUS_ENABLED: false,
        GRAFANA_ENABLED: false,
        CDN_ENABLED: false,
        ENABLE_AGENT_FABRIC: false,
        ENABLE_WORKFLOW: false,
        ENABLE_COMPLIANCE: false,
        ENABLE_MULTI_TENANT: false,
        ENABLE_USAGE_TRACKING: false,
        ENABLE_BILLING: false,
        AUTO_ROLLBACK_ENABLED: false,
        HEALTH_CHECK_INTERVAL: 30,
        HEALTH_CHECK_TIMEOUT: 10,
        HEALTH_CHECK_RETRIES: 1,
      },
    };
  }

  return {
    ...result,
    config: result.safeDefaults,
  };
}

/**
 * Check if application should run in maintenance mode
 */
export function isMaintenanceMode(): boolean {
  const result = validateEnvironment();
  return result.maintenanceMode || !result.success;
}

/**
 * Get health check configuration
 */
export function getHealthCheckConfig() {
  const result = getValidatedEnvironment();
  return {
    enabled: true,
    interval: result.config.HEALTH_CHECK_INTERVAL * 1000,
    timeout: result.config.HEALTH_CHECK_TIMEOUT * 1000,
    retries: result.config.HEALTH_CHECK_RETRIES,
    endpoints: ["/health", "/ready", "/live"],
  };
}

/**
 * Get HA configuration
 */
export function getHAConfig() {
  const result = getValidatedEnvironment();
  return {
    instanceId: result.config.INSTANCE_ID,
    region: result.config.REGION,
    clusterName: result.config.CLUSTER_NAME,
    maintenanceMode: result.maintenanceMode,
    autoRollback: result.config.AUTO_ROLLBACK_ENABLED,
    cdnEnabled: result.config.CDN_ENABLED,
    cdnProvider: result.config.CDN_PROVIDER,
    cdnCacheTtl: result.config.CDN_CACHE_TTL,
  };
}

export default validateEnvironment;

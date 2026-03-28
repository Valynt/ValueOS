/**
 * Unified Configuration Schema with Runtime Validation
 *
 * This file provides a single source of truth for all configuration validation
 * across environments with fail-fast startup behavior and comprehensive error reporting.
 */

import { z } from "zod";

// NodeJS process may not exist in all environments (e.g. browser bundles)
const nodeProcess = (globalThis as { process?: NodeJS.Process }).process;

function writeStdout(message: string) {
  nodeProcess?.stdout?.write(`${message}\n`);
}

function writeStderr(message: string) {
  nodeProcess?.stderr?.write(`${message}\n`);
}

/**
 * Core configuration schema with strict validation
 */
export const ConfigSchema = z.object({
  // Application Environment
  app: z.object({
    environment: z.enum(["development", "staging", "production", "test"]),
    version: z.string().min(1),
    instanceId: z.string().min(1),
    region: z
      .enum(["us-east-1", "eu-west-1", "ap-southeast-1"])
      .default("us-east-1"),
    clusterName: z.string().default("valueos-ha"),
  }),

  // Server Configuration
  server: z.object({
    port: z.number().positive().max(65535),
    host: z.string().ip(),
    url: z.string().url().optional(),
  }),

  // Database Configuration
  database: z.object({
    url: z.string().url(),
    host: z.string().min(1),
    port: z.number().positive().max(65535),
    name: z.string().min(1),
    user: z.string().min(1),
    password: z.string().min(1),
    ssl: z.boolean().default(true),
    poolSize: z.number().positive().max(100).default(10),
    timeout: z.number().positive().max(30000).default(5000),
  }),

  // Supabase Configuration
  supabase: z.object({
    url: z.string().url(),
    anonKey: z
      .string()
      .min(100, "Supabase anon key must be at least 100 characters"),
    serviceRoleKey: z.string().min(100).optional(),
    functionsUrl: z.string().url().optional(),
  }),

  // LLM Configuration
  llm: z.object({
    provider: z.enum(["together", "openai", "anthropic"]),
    apiKey: z.string().min(20, "LLM API key must be at least 20 characters"),
    model: z.string().min(1),
    maxTokensPerRequest: z.number().positive().max(100000),
    costLimitPerSession: z.number().positive().default(25),
    timeout: z.number().positive().max(60000).default(30000),
    temperature: z.number().min(0).max(2).default(0.7),
  }),

  // Redis Configuration
  redis: z.object({
    url: z.string().url(),
    host: z.string().min(1),
    port: z.number().positive().max(65535),
    password: z.string().optional(),
    db: z.number().min(0).max(15).default(0),
    maxConnections: z.number().positive().max(50).default(10),
    keyPrefix: z.string().default("valueos:"),
  }),

  // Feature Flags
  features: z.object({
    enableAgentFabric: z.boolean().default(true),
    enableRealtime: z.boolean().default(true),
    enableWorkflow: z.boolean().default(true),
    enableCompliance: z.boolean().default(true),
    enableMultiTenant: z.boolean().default(false),
    enableUsageTracking: z.boolean().default(true),
    enableBilling: z.boolean().default(false),
    enableAI: z.boolean().default(true),
    enableAnalytics: z.boolean().default(false),
  }),

  // Security Configuration
  security: z.object({
    csrfEnabled: z.boolean().default(true),
    cspEnabled: z.boolean().default(true),
    httpsOnly: z.boolean().default(false),
    sessionTimeout: z.number().positive().max(86400).default(3600),
    maxLoginAttempts: z.number().positive().max(10).default(5),
    passwordMinLength: z.number().positive().max(128).default(8),
  }),

  // Monitoring and Observability
  monitoring: z.object({
    prometheusEnabled: z.boolean().default(true),
    prometheusPort: z.number().positive().max(65535).default(9090),
    grafanaEnabled: z.boolean().default(true),
    grafanaPort: z.number().positive().max(65535).default(3000),
    logLevel: z.enum(["error", "warn", "info", "debug"]).default("info"),
    tracingEnabled: z.boolean().default(false),
    metricsInterval: z.number().positive().max(300).default(60),
  }),

  // High Availability Configuration
  ha: z.object({
    maintenanceMode: z.boolean().default(false),
    autoRollbackEnabled: z.boolean().default(true),
    healthCheckInterval: z.number().positive().max(300).default(15),
    healthCheckTimeout: z.number().positive().max(60).default(5),
    healthCheckRetries: z.number().positive().max(10).default(3),
    circuitBreakerThreshold: z.number().positive().max(100).default(5),
    circuitBreakerTimeout: z.number().positive().max(300).default(60),
  }),

  // CDN Configuration
  cdn: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(["cloudflare", "cloudfront", "fastly"]).optional(),
    cacheTtl: z.number().positive().max(31536000).default(3600),
    edgeLocations: z.array(z.string()).optional(),
  }),

  // External Services
  external: z.object({
    slackWebhookUrl: z.string().url().optional(),
    googleAnalyticsId: z.string().optional(),
    stripePublicKey: z.string().optional(),
    stripeSecretKey: z.string().optional(),
  }),
});

/**
 * Production-specific schema with stricter requirements
 */
const ProductionConfigSchema = ConfigSchema.extend({
  app: ConfigSchema.shape.app.extend({
    environment: z.literal("production"),
  }),

  server: ConfigSchema.shape.server.extend({
    url: z.string().url("Production requires server URL"),
  }),

  security: ConfigSchema.shape.security.extend({
    httpsOnly: z.literal(true),
    csrfEnabled: z.literal(true),
    cspEnabled: z.literal(true),
  }),

  database: ConfigSchema.shape.database.extend({
    ssl: z.literal(true),
  }),

  monitoring: ConfigSchema.shape.monitoring.extend({
    prometheusEnabled: z.literal(true),
    grafanaEnabled: z.literal(true),
    logLevel: z.enum(["error", "warn"]).default("warn"),
  }),

  ha: ConfigSchema.shape.ha.extend({
    autoRollbackEnabled: z.literal(true),
  }),

  cdn: ConfigSchema.shape.cdn.extend({
    enabled: z.literal(true),
    provider: z.enum(["cloudflare", "cloudfront", "fastly"]),
  }),
});

/**
 * Development-specific schema with relaxed requirements
 */
const DevelopmentConfigSchema = ConfigSchema.extend({
  app: ConfigSchema.shape.app.extend({
    environment: z.enum(["development", "test"]),
  }),

  security: ConfigSchema.shape.security.extend({
    httpsOnly: z.boolean().default(false),
  }),

  monitoring: ConfigSchema.shape.monitoring.extend({
    prometheusEnabled: z.boolean().default(false),
    grafanaEnabled: z.boolean().default(false),
    logLevel: z.enum(["info", "debug"]).default("debug"),
  }),

  ha: ConfigSchema.shape.ha.extend({
    autoRollbackEnabled: z.boolean().default(false),
  }),

  cdn: ConfigSchema.shape.cdn.extend({
    enabled: z.boolean().default(false),
  }),
});

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  success: boolean;
  config: z.infer<typeof ConfigSchema> | null;
  errors: string[];
  warnings: string[];
  environment: string;
}

/**
 * Map environment variables to configuration object
 */
function mapEnvVarsToConfig(
  env: Record<string, string>
): Record<string, unknown> {
  return {
    app: {
      environment: env.NODE_ENV || "development",
      version: env.APP_VERSION || "1.0.0",
      instanceId: env.INSTANCE_ID || "local",
      region: env.REGION || "us-east-1",
      clusterName: env.CLUSTER_NAME || "valueos-ha",
    },
    server: {
      port: parseInt(env.PORT || "5173"),
      host: env.HOST || "0.0.0.0",
      url: env.SERVER_URL,
    },
    database: {
      url: env.DATABASE_URL,
      host: env.POSTGRES_HOST || "localhost",
      port: parseInt(env.POSTGRES_PORT || "5432"),
      name: env.POSTGRES_DB || "valueos_dev",
      user: env.POSTGRES_USER || "postgres",
      password: env.POSTGRES_PASSWORD || "dev_password",
      ssl: env.DATABASE_SSL === "true",
      poolSize: parseInt(env.DATABASE_POOL_SIZE || "10"),
      timeout: parseInt(env.DATABASE_TIMEOUT || "5000"),
    },
    supabase: {
      url: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      functionsUrl: env.SUPABASE_FUNCTIONS_URL,
    },
    llm: {
      provider: (env.LLM_PROVIDER || "together") as
        | "together"
        | "openai"
        | "anthropic",
      apiKey:
        env.TOGETHER_API_KEY || env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY,
      model: env.LLM_MODEL || "meta-llama/Llama-2-70b-chat-hf",
      maxTokensPerRequest: parseInt(env.LLM_MAX_TOKENS || "4096"),
      costLimitPerSession: parseFloat(env.LLM_COST_LIMIT || "25"),
      timeout: parseInt(env.LLM_TIMEOUT || "30000"),
      temperature: parseFloat(env.LLM_TEMPERATURE || "0.7"),
    },
    redis: {
      url: env.REDIS_URL,
      host: env.REDIS_HOST || "localhost",
      port: parseInt(env.REDIS_PORT || "6379"),
      password: env.REDIS_PASSWORD,
      db: parseInt(env.REDIS_DB || "0"),
      maxConnections: parseInt(env.REDIS_MAX_CONNECTIONS || "10"),
      keyPrefix: env.REDIS_KEY_PREFIX || "valueos:",
    },
    features: {
      enableAgentFabric: env.ENABLE_AGENT_FABRIC !== "false",
      enableRealtime: env.ENABLE_REALTIME !== "false",
      enableWorkflow: env.ENABLE_WORKFLOW !== "false",
      enableCompliance: env.ENABLE_COMPLIANCE !== "false",
      enableMultiTenant: env.ENABLE_MULTI_TENANT === "true",
      enableUsageTracking: env.ENABLE_USAGE_TRACKING !== "false",
      enableBilling: env.ENABLE_BILLING === "true",
      enableAI: env.ENABLE_AI !== "false",
      enableAnalytics: env.ENABLE_ANALYTICS === "true",
    },
    security: {
      csrfEnabled: env.CSRF_ENABLED !== "false",
      cspEnabled: env.CSP_ENABLED !== "false",
      httpsOnly: env.HTTPS_ONLY === "true",
      sessionTimeout: parseInt(env.SESSION_TIMEOUT || "3600"),
      maxLoginAttempts: parseInt(env.MAX_LOGIN_ATTEMPTS || "5"),
      passwordMinLength: parseInt(env.PASSWORD_MIN_LENGTH || "8"),
    },
    monitoring: {
      prometheusEnabled: env.PROMETHEUS_ENABLED === "true",
      prometheusPort: parseInt(env.PROMETHEUS_PORT || "9090"),
      grafanaEnabled: env.GRAFANA_ENABLED === "true",
      grafanaPort: parseInt(env.GRAFANA_PORT || "3000"),
      logLevel: (env.LOG_LEVEL || "info") as
        | "error"
        | "warn"
        | "info"
        | "debug",
      tracingEnabled: env.TRACING_ENABLED === "true",
      metricsInterval: parseInt(env.METRICS_INTERVAL || "60"),
    },
    ha: {
      maintenanceMode: env.MAINTENANCE_MODE === "true",
      autoRollbackEnabled: env.AUTO_ROLLBACK_ENABLED !== "false",
      healthCheckInterval: parseInt(env.HEALTH_CHECK_INTERVAL || "15"),
      healthCheckTimeout: parseInt(env.HEALTH_CHECK_TIMEOUT || "5"),
      healthCheckRetries: parseInt(env.HEALTH_CHECK_RETRIES || "3"),
      circuitBreakerThreshold: parseInt(env.CIRCUIT_BREAKER_THRESHOLD || "5"),
      circuitBreakerTimeout: parseInt(env.CIRCUIT_BREAKER_TIMEOUT || "60"),
    },
    cdn: {
      enabled: env.CDN_ENABLED === "true",
      provider: (env.CDN_PROVIDER || undefined) as
        | "cloudflare"
        | "cloudfront"
        | "fastly"
        | undefined,
      cacheTtl: parseInt(env.CDN_CACHE_TTL || "3600"),
      edgeLocations: env.CDN_EDGE_LOCATIONS?.split(",") || undefined,
    },
    external: {
      slackWebhookUrl: env.SLACK_WEBHOOK_URL,
      googleAnalyticsId: env.GOOGLE_ANALYTICS_ID,
      stripePublicKey: env.STRIPE_PUBLIC_KEY,
      stripeSecretKey: env.STRIPE_SECRET_KEY,
    },
  };
}

/**
 * Load and validate configuration with fail-fast behavior.
 *
 * @deprecated Use `validateEnvironment()` from `env-validation.ts` instead.
 * This function now delegates to the unified validator and maps the result
 * to the legacy ConfigValidationResult shape for backward compatibility.
 * It will be removed in a future release.
 */
export function loadAndValidateConfig(
  env: Record<string, string> = process.env as Record<string, string>
): ConfigValidationResult {
  writeStderr(
    "[DEPRECATION] loadAndValidateConfig() is deprecated. Use validateEnvironment() from env-validation.ts instead."
  );

  const environment = env.NODE_ENV || "development";
  const errors: string[] = [];
  const warnings: string[] = [];

  writeStdout(`🔍 Loading and validating configuration for ${environment}...`);

  try {
    // Map environment variables to config structure
    const rawConfig = mapEnvVarsToConfig(env);

    // Select appropriate schema based on environment
    let schema;
    if (environment === "production") {
      schema = ProductionConfigSchema;
    } else if (environment === "development" || environment === "test") {
      schema = DevelopmentConfigSchema;
    } else {
      schema = ConfigSchema;
    }

    // Validate configuration
    const result = schema.safeParse(rawConfig);

    if (!result.success) {
      // Format validation errors for better readability
      result.error.issues.forEach(issue => {
        const path = issue.path.join(".");
        const message = issue.message;

        if (issue.code === "invalid_type") {
          errors.push(
            `Invalid type for ${path}: expected ${issue.expected}, received ${issue.received}`
          );
        } else if (issue.code === "invalid_literal") {
          errors.push(
            `Invalid value for ${path}: ${issue.received} is not allowed`
          );
        } else {
          errors.push(`${path}: ${message}`);
        }
      });

      writeStderr(
        `❌ Configuration validation failed with ${errors.length} errors:`
      );
      errors.forEach(error => writeStderr(`  - ${error}`));

      return {
        success: false,
        config: null,
        errors,
        warnings,
        environment,
      };
    }

    const config = result.data;

    // Generate warnings for non-critical issues
    if (environment === "production" && !config.external.slackWebhookUrl) {
      warnings.push(
        "SLACK_WEBHOOK_URL not set - notifications will be disabled"
      );
    }

    if (
      config.features.enableBilling &&
      (!config.external.stripePublicKey || !config.external.stripeSecretKey)
    ) {
      warnings.push(
        "Billing enabled but Stripe keys not configured - billing features will be disabled"
      );
    }

    if (config.cdn.enabled && !config.cdn.provider) {
      warnings.push(
        "CDN enabled but no provider specified - CDN will be disabled"
      );
    }

    // Check for maintenance mode
    if (config.ha.maintenanceMode) {
      warnings.push("Application is running in maintenance mode");
    }

    writeStdout(`✅ Configuration validation successful`);
    if (warnings.length > 0) {
      writeStdout(`⚠️  ${warnings.length} warnings detected`);
      warnings.forEach(warning => writeStdout(`  - ${warning}`));
    }

    return {
      success: true,
      config,
      errors,
      warnings,
      environment,
    };
  } catch (error) {
    const errorMsg = `Unexpected error during configuration validation: ${error instanceof Error ? error.message : String(error)}`;
    writeStderr(`💥 ${errorMsg}`);

    return {
      success: false,
      config: null,
      errors: [errorMsg],
      warnings,
      environment,
    };
  }
}

/**
 * Get validated configuration or exit with error
 * This is the main function to use in application entry points
 */
export function getValidatedConfig(): z.infer<typeof ConfigSchema> {
  const result = loadAndValidateConfig();

  if (!result.success) {
    writeStderr("🚨 Critical configuration errors detected");
    writeStderr("Application cannot start with invalid configuration");
    writeStderr("");
    writeStderr("Please fix the following errors:");
    result.errors.forEach(error => writeStderr(`  - ${error}`));
    writeStderr("");
    writeStderr("For help, check the configuration documentation or run:");
    writeStderr("  npm run config:validate");
    writeStderr("  npm run config:diff");

    if (nodeProcess) {
      nodeProcess.exit(1);
    } else {
      throw new Error("Configuration validation failed");
    }
  }

  return result.config;
}

/**
 * Check if application should run in maintenance mode
 */
export function isMaintenanceMode(): boolean {
  const result = loadAndValidateConfig();
  return !result.success || result.config.ha.maintenanceMode;
}

/**
 * Get configuration for health checks
 */
export function getHealthCheckConfig() {
  const config = getValidatedConfig();
  return {
    enabled: true,
    interval: config.ha.healthCheckInterval * 1000,
    timeout: config.ha.healthCheckTimeout * 1000,
    retries: config.ha.healthCheckRetries,
    endpoints: ["/health", "/ready", "/live"],
    circuitBreaker: {
      threshold: config.ha.circuitBreakerThreshold,
      timeout: config.ha.circuitBreakerTimeout * 1000,
    },
  };
}

/**
 * Export types for use in other modules
 */
export type AppConfig = z.infer<typeof ConfigSchema>;
export type ProductionConfig = z.infer<typeof ProductionConfigSchema>;
export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;

export default loadAndValidateConfig;

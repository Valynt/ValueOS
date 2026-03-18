/**
 * Environment Configuration - Re-export from shared
 */

/* eslint-disable security/detect-object-injection -- Controlled feature flag access with template literal */

import { parseCorsAllowlist } from "@shared/config/cors";

// Re-exports from shared utility
export {
  getEnvironment,
  isProduction,
  isDevelopment,
  isTest,
} from "@shared/config/environment";

/**
 * Types and Interfaces
 */
export type AppEnvironment = "development" | "staging" | "production" | "test";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface EnvironmentConfig {
  environment: AppEnvironment;
  logLevel: LogLevel;
  [key: string]: unknown;
}

/**
 * Standard I/O Helpers
 */
export function writeStderr(msg: string): void {
  process.stderr.write(msg + "\n");
}

export function writeStdout(msg: string): void {
  process.stdout.write(msg + "\n");
}

/**
 * Feature Flag Helper
 * Converts environment variables to booleans following the FEATURE_ prefix convention.
 */
export function isFeatureEnabled(feature: string): boolean {
  // Simple implementation - can be enhanced with actual feature flags
  return process.env[`FEATURE_${feature.toUpperCase()}`] === "true";
}

/**
 * CORS compatibility shim.
 *
 * Historically the backend reads CORS_ORIGINS (via getConfig()) while security
 * middleware reads CORS_ALLOWED_ORIGINS. Operators had to set both. This shim
 * lets them set either one -- whichever is provided is copied to the other so
 * both consumers see the same value.
 */
function normaliseCorsEnv(): void {
  const allowed = process.env.CORS_ALLOWED_ORIGINS;
  const origins = process.env.CORS_ORIGINS;

  if (allowed && !origins) {
    process.env.CORS_ORIGINS = allowed;
  } else if (origins && !allowed) {
    process.env.CORS_ALLOWED_ORIGINS = origins;
  }
  // When both are set we leave them as-is (operator made a deliberate choice).
}

/**
 * Full structured config shape — built from environment variables.
 */
function buildConfig() {
  normaliseCorsEnv();

  const corsOrigins = parseCorsAllowlist(process.env.CORS_ORIGINS, {
    source: "CORS_ORIGINS",
    credentials: true,
    requireNonEmpty: true,
  });

  const mfaEnabled = process.env.MFA_ENABLED === "true";
  const env = (process.env.NODE_ENV || "development") as AppEnvironment;

  return {
    auth: { mfaEnabled },
    features: {
      billing: false,
      usageTracking: false,
      agentFabric: process.env.AGENT_FABRIC_ENABLED !== "false",
      workflow: process.env.WORKFLOW_ENABLED !== "false",
      compliance: process.env.COMPLIANCE_ENABLED !== "false",
    },
    email: { enabled: false },
    app: {
      url: process.env.APP_URL || "http://localhost:3001",
      env,
    },
    database: {
      url: process.env.SUPABASE_URL || process.env.DATABASE_URL || "",
      poolSize: Number(process.env.DB_POOL_SIZE) || 10,
      anonKey:
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        "",
    },
    agents: {
      enabled: process.env.AGENTS_ENABLED !== "false",
      maxConcurrent: Number(process.env.AGENTS_MAX_CONCURRENT) || 5,
      apiUrl:
        process.env.AGENT_API_URL ||
        process.env.AGENTS_API_URL ||
        "http://localhost:3001/api/agents",
      timeout: Number(process.env.AGENTS_TIMEOUT) || 30_000,
      logging: process.env.AGENTS_LOGGING !== "false",
      circuitBreaker: {
        enabled: process.env.AGENTS_CIRCUIT_BREAKER_ENABLED !== "false",
        threshold: Number(process.env.AGENTS_CB_THRESHOLD) || 5,
        cooldown: Number(process.env.AGENTS_CB_COOLDOWN) || 30_000,
      },
    },
    cache: {
      enabled: process.env.CACHE_ENABLED !== "false",
      ttl: Number(process.env.CACHE_TTL) || 300,
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== "false",
      metricsEndpoint: process.env.METRICS_ENDPOINT || "/metrics",
    },
    security: {
      csrfEnabled: process.env.CSRF_ENABLED !== "false",
      cspEnabled: process.env.CSP_ENABLED !== "false",
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
      rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE) || 60,
      httpsOnly: process.env.HTTPS_ONLY === "true",
      corsOrigins,
    },
  };
}

export type AppConfig = ReturnType<typeof buildConfig>;

// Singleton cache — cleared by resetConfig()
let _configCache: AppConfig | null = null;

/**
 * Returns the cached config singleton, building it on first call.
 */
export function getConfig(): AppConfig {
  if (!_configCache) {
    _configCache = buildConfig();
  }
  return _configCache;
}

/**
 * Clears the config cache so the next getConfig() call re-reads env vars.
 * Primarily used in tests.
 */
export function resetConfig(): void {
  _configCache = null;
}

/**
 * Alias for getConfig() — returns the full structured config.
 */
export function loadEnvironmentConfig(): AppConfig {
  return getConfig();
}

/**
 * Validates a config object and returns an array of error strings.
 * Returns an empty array when the config is valid.
 */
export function validateEnvironmentConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  if (config.app.env === "production") {
    if (!config.database.url) {
      errors.push("SUPABASE_URL is required in production");
    }
    if (!config.database.anonKey) {
      errors.push("SUPABASE_ANON_KEY is required in production");
    }
    if (process.env.DEV_MOCKS_ENABLED === "true") {
      errors.push("DEV_MOCKS_ENABLED must not be true in production");
    }
  }

  if (config.features.agentFabric && !config.agents.apiUrl) {
    errors.push(
      "AGENT_API_URL is required when agentFabric feature is enabled"
    );
  }

  return errors;
}

/**
 * Configuration utilities for ValueOS agents
 * Handles environment variables and configuration validation
 */

import { z } from "zod";

/**
 * Base agent configuration schema
 */
export const baseConfigSchema = z.object({
  // Server configuration
  PORT: z.string().default("8080").transform(Number),
  HOST: z.string().default("0.0.0.0"),

  // Environment
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  ENVIRONMENT: z.string().default("development"),

  // Agent-specific
  AGENT_TYPE: z.string(),

  // Database
  DATABASE_URL: z.string().optional(),

  // External services
  REDIS_URL: z.string().optional(),
  QUEUE_URL: z.string().optional(),

  // Monitoring
  METRICS_PORT: z.string().default("9090").transform(Number),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Security
  JWT_SECRET: z.string().optional(),
  API_KEY: z.string().optional(),

  // Feature flags
  ENABLE_METRICS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  ENABLE_HEALTH_CHECKS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Resource limits
  MAX_CONCURRENT_REQUESTS: z.string().default("10").transform(Number),
  REQUEST_TIMEOUT_MS: z.string().default("30000").transform(Number),
});

/**
 * Agent configuration type
 */
export type AgentConfig = z.infer<typeof baseConfigSchema>;

/**
 * Load configuration from environment
 */
export function loadConfig(): AgentConfig {
  const env = process.env;

  try {
    return baseConfigSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      throw new Error(`Configuration validation failed:\n${issues.join("\n")}`);
    }
    throw error;
  }
}

/**
 * Get current configuration (memoized)
 */
let cachedConfig: AgentConfig | null = null;

export function getConfig(): AgentConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === "development";
}

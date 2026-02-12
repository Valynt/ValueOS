/**
 * Environment Configuration - Re-export from shared
 */

export { getEnvironment, isProduction, isDevelopment, isTest } from "@shared/config/environment";

export function isFeatureEnabled(feature: string): boolean {
  // Simple implementation - can be enhanced with actual feature flags
  return process.env[`FEATURE_${feature.toUpperCase()}`] === "true";
}

export function getConfig() {
  return {
    auth: { mfaEnabled: false },
    features: { billing: false, usageTracking: false },
    email: { enabled: false },
    app: { url: process.env.APP_URL || "http://localhost:3001" },
    database: {
      url: process.env.DATABASE_URL || "",
      poolSize: Number(process.env.DB_POOL_SIZE) || 10,
    },
    agents: {
      enabled: process.env.AGENTS_ENABLED !== "false",
      maxConcurrent: Number(process.env.AGENTS_MAX_CONCURRENT) || 5,
    },
    cache: {
      enabled: process.env.CACHE_ENABLED !== "false",
      ttl: Number(process.env.CACHE_TTL) || 300,
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== "false",
      metricsEndpoint: process.env.METRICS_ENDPOINT || "/metrics",
    },
  };
}

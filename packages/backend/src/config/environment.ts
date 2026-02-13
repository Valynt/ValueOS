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
    features: {
      billing: false,
      usageTracking: false,
      agentFabric: process.env.AGENT_FABRIC_ENABLED !== "false",
      workflow: process.env.WORKFLOW_ENABLED !== "false",
      compliance: process.env.COMPLIANCE_ENABLED !== "false",
    },
    email: { enabled: false },
    app: { url: process.env.APP_URL || "http://localhost:3001" },
    database: {
      url: process.env.DATABASE_URL || "",
      poolSize: Number(process.env.DB_POOL_SIZE) || 10,
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    },
    agents: {
      enabled: process.env.AGENTS_ENABLED !== "false",
      maxConcurrent: Number(process.env.AGENTS_MAX_CONCURRENT) || 5,
      apiUrl: process.env.AGENTS_API_URL || "http://localhost:3001/api/agents",
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
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
      corsOrigins: process.env.CORS_ORIGINS || "*",
    },
  };
}

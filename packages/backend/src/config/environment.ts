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
  };
}

/**
 * Environment Configuration
 */

export type AppEnvironment = "development" | "staging" | "production" | "test";

export interface AppConfig {
  env: AppEnvironment;
  appUrl: string;
  apiBaseUrl: string;
  supabase: {
    url: string;
    anonKey: string;
  };
  features: {
    billing: boolean;
  };
}

function getEnv(key: string, defaultValue = ""): string {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (import.meta.env as Record<string, string>)[key] || defaultValue;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

function getBoolEnv(key: string, defaultValue = false): boolean {
  const value = getEnv(key, String(defaultValue));
  return value === "true" || value === "1";
}

function getAppEnvironment(): AppEnvironment {
  const nodeEnv = getEnv("NODE_ENV");
  if (["development", "staging", "production", "test"].includes(nodeEnv)) {
    return nodeEnv as AppEnvironment;
  }
  return "development";
}

export function loadConfig(): AppConfig {
  const env = getAppEnvironment();

  return {
    env,
    appUrl: getEnv("VITE_APP_URL", "http://localhost:5173"),
    apiBaseUrl: getEnv("VITE_API_BASE_URL", ""),
    supabase: {
      url: getEnv("VITE_SUPABASE_URL", ""),
      anonKey: getEnv("VITE_SUPABASE_ANON_KEY", ""),
    },
    features: {
      billing: getBoolEnv("VITE_BILLING_ENABLED", false),
    },
  };
}

let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function isProduction(): boolean {
  return getConfig().env === "production";
}

export function isDevelopment(): boolean {
  return getConfig().env === "development";
}

export function isTest(): boolean {
  return getConfig().env === "test";
}

export default getConfig;

/**
 * Runtime Config Injection
 *
 * Eliminates "wrong .env" issues by loading configuration at runtime
 * instead of baking VITE_ variables at build time.
 *
 * Pattern:
 * - Local Dev: Generates window.__CONFIG__ from environment
 * - Docker/Prod: Server injects config into index.html
 * - Result: Same build artifact works everywhere
 */

export interface RuntimeConfig {
  api: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  agentApiUrl: string;
  sentryDsn?: string;
  environment: "development" | "staging" | "production";
  version: string;
  buildTime?: string;
  features?: Record<string, boolean>;
}

declare global {
  interface Window {
    __CONFIG__?: Partial<RuntimeConfig>;
    __RUNTIME_CONFIG_LOADED__?: boolean;
  }
}

const DEFAULT_CONFIG: RuntimeConfig = {
  api: "/api",
  supabaseUrl: "",
  supabaseAnonKey: "",
  agentApiUrl: "/api/agents",
  environment: "development",
  version: "0.0.0-dev",
};

let cachedConfig: RuntimeConfig | null = null;

/**
 * Get runtime configuration
 * Priority: window.__CONFIG__ > VITE_ env vars > defaults
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const windowConfig = typeof window !== "undefined" ? window.__CONFIG__ : {};
  const envConfig = getEnvConfig();

  cachedConfig = {
    ...DEFAULT_CONFIG,
    ...envConfig,
    ...windowConfig,
  };

  if (typeof window !== "undefined") {
    window.__RUNTIME_CONFIG_LOADED__ = true;
  }

  return cachedConfig;
}

/**
 * Get configuration from VITE_ environment variables (build-time fallback)
 */
function getEnvConfig(): Partial<RuntimeConfig> {
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return {};
  }

  return {
    api: import.meta.env.VITE_API_BASE_URL || undefined,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || undefined,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || undefined,
    agentApiUrl: import.meta.env.VITE_AGENT_API_URL || undefined,
    sentryDsn: import.meta.env.VITE_SENTRY_DSN || undefined,
    environment:
      (import.meta.env.MODE as RuntimeConfig["environment"]) || undefined,
    version: import.meta.env.VITE_APP_VERSION || undefined,
  };
}

/**
 * Override runtime config (for Dev HUD)
 */
export function overrideRuntimeConfig(
  overrides: Partial<RuntimeConfig>
): RuntimeConfig {
  cachedConfig = {
    ...getRuntimeConfig(),
    ...overrides,
  };

  if (typeof window !== "undefined") {
    window.__CONFIG__ = cachedConfig;
    window.dispatchEvent(
      new CustomEvent("config:changed", { detail: cachedConfig })
    );
  }

  return cachedConfig;
}

/**
 * Reset runtime config to defaults
 */
export function resetRuntimeConfig(): RuntimeConfig {
  cachedConfig = null;
  return getRuntimeConfig();
}

/**
 * Get API base URL
 */
export function getApiUrl(): string {
  return getRuntimeConfig().api;
}

/**
 * Get Supabase URL
 */
export function getSupabaseUrl(): string {
  return getRuntimeConfig().supabaseUrl;
}

/**
 * Get Supabase Anon Key
 */
export function getSupabaseAnonKey(): string {
  return getRuntimeConfig().supabaseAnonKey;
}

/**
 * Get Agent API URL
 */
export function getAgentApiUrl(): string {
  return getRuntimeConfig().agentApiUrl;
}

/**
 * Check if running in development
 */
export function isDevEnvironment(): boolean {
  return getRuntimeConfig().environment === "development";
}

/**
 * Check if running in production
 */
export function isProdEnvironment(): boolean {
  return getRuntimeConfig().environment === "production";
}

/**
 * Generate config script for injection into index.html
 * Used by build/deploy scripts
 */
export function generateConfigScript(config: Partial<RuntimeConfig>): string {
  const safeConfig = JSON.stringify(config)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return `<script>window.__CONFIG__=${safeConfig};</script>`;
}

/**
 * Validate runtime config
 */
export function validateRuntimeConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const config = getRuntimeConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.api) {
    warnings.push("API URL not configured, using default /api");
  }

  if (!config.supabaseUrl) {
    errors.push("Supabase URL not configured");
  }

  if (!config.supabaseAnonKey) {
    errors.push("Supabase Anon Key not configured");
  }

  if (config.environment === "production" && !config.sentryDsn) {
    warnings.push("Sentry DSN not configured for production");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Environment Variable Utilities
 * Browser-safe implementation that avoids process references
 */

// Check once at module load time
const _isBrowser = typeof globalThis !== "undefined" && "window" in globalThis;

// Vite injects import.meta.env at build time; this type avoids `any` casts.
type ViteImportMeta = ImportMeta & { env?: Record<string, string | undefined> };

export const REQUIRED_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

export function validateRequiredEnv(): void {
  // Skip validation in browser (validation is server-side)
  if (_isBrowser) return;

  // Server-side validation (self-contained, no cross-package imports)
  const missing: string[] = [];
  for (const key of REQUIRED_ENV_VARS) {
    if (typeof process !== "undefined" && process.env && !process.env[key]) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    console.warn(`[env] Missing environment variables: ${missing.join(", ")}`);
  }
}

export function validateEnv() {
  validateRequiredEnv();
}

// Helper function to safely access environment variables
function getEnvValue(key: string): string | undefined {
  if (_isBrowser) {
    // In browser environments, use import.meta.env if available (Vite)
    return ( import.meta as ViteImportMeta)?.env?.[key];
  } else {
    // In Node.js environments, use process.env
    return typeof process !== "undefined" && process.env ? process.env[key] : undefined;
  }
}

export const env = {
  isDevelopment: _isBrowser ? getEnvValue("DEV") === "true" : false,
  isProduction: _isBrowser ? getEnvValue("PROD") === "true" : false,
  isTest: false,
  isBrowser: _isBrowser,
  isServer: !_isBrowser,
};

export interface GetEnvVarOptions {
  required?: boolean;
  defaultValue?: string;
  scope?: "browser" | "server";
}

export function getEnvVar(key: string, options: GetEnvVarOptions = {}): string | undefined {
  const { required = false, defaultValue, scope } = options;

  let value: string | undefined = getEnvValue(key);

  if (!value && defaultValue) {
    value = defaultValue;
  }

  if (!value && required) {
    const errorScope = scope || (_isBrowser ? "browser" : "server");
    throw new Error(`Missing required ${errorScope} environment variable: ${key}`);
  }

  return value;
}

export function setEnvVar(key: string, value: string): void {
  if (_isBrowser) {
    const metaEnv = (import.meta as ViteImportMeta).env;
    if (metaEnv) {
      metaEnv[key] = value;
    }
  } else {
    if (typeof process !== "undefined" && process.env) {
      process.env[key] = value;
    }
  }
}

export function checkIsBrowser(): boolean {
  return _isBrowser;
}

export function __setEnvSourceForTests(envSource: Record<string, string>): void {
  if (_isBrowser) {
    const metaEnv = (import.meta as ViteImportMeta).env;
    if (metaEnv) {
      Object.assign(metaEnv, envSource);
    }
  } else {
    if (typeof process !== "undefined" && process.env) {
      Object.assign(process.env, envSource);
    }
  }
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
} {
  const serviceRoleKey =
    getEnvVar("SUPABASE_SERVICE_ROLE_KEY") || getEnvVar("SUPABASE_SERVICE_KEY");
  const config: { url: string; anonKey: string; serviceRoleKey?: string } = {
    url: getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_PUBLIC_URL") || getEnvVar("SUPABASE_URL") || getEnvVar("SUPABASE_INTERNAL_URL") || "",
    anonKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || getEnvVar("SUPABASE_ANON_KEY") || "",
  };
  if (serviceRoleKey) {
    config.serviceRoleKey = serviceRoleKey;
  }
  return config;
}

/**
 * Server-only Supabase config. Returns service_role key from process.env.
 * Never call from browser code.
 */
export function getSupabaseServerConfig(): {
  url: string;
  serviceRoleKey: string;
} {
  if (_isBrowser) {
    throw new Error("getSupabaseServerConfig must not be called in browser context");
  }
  return {
    url: getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_PUBLIC_URL") || getEnvVar("SUPABASE_URL") || getEnvVar("SUPABASE_INTERNAL_URL") || "",
    serviceRoleKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY") || getEnvVar("SUPABASE_SERVICE_KEY") || "",
  };
}

export function getGroundtruthConfig(): {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
} {
  const apiKey = getEnvVar("VITE_GROUNDTRUTH_API_KEY") || getEnvVar("GROUNDTRUTH_API_KEY");
  const config: { baseUrl: string; apiKey?: string; timeout: number } = {
    baseUrl:
      getEnvVar("VITE_GROUNDTRUTH_URL") ||
      getEnvVar("GROUNDTRUTH_URL") ||
      "https://api.groundtruth.example.com",
    timeout: Number(getEnvVar("GROUNDTRUTH_TIMEOUT") || "30000"),
  };
  if (apiKey) {
    config.apiKey = apiKey;
  }
  return config;
}

export function getLLMCostTrackerConfig(): {
  supabaseUrl: string;
  supabaseKey: string;
  tableName: string;
} {
  return {
    supabaseUrl: getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_PUBLIC_URL") || getEnvVar("SUPABASE_URL") || getEnvVar("SUPABASE_INTERNAL_URL") || "",
    supabaseKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || getEnvVar("SUPABASE_ANON_KEY") || "",
    tableName: getEnvVar("LLM_COST_TABLE_NAME") || "llm_costs",
  };
}

export function setEnvVarForTests(envSource: Record<string, string>): void {
  __setEnvSourceForTests(envSource);
}

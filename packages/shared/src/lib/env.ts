/**
 * Environment Variable Utilities
 * Browser-safe implementation that avoids process references
 */

// Check once at module load time
const _isBrowser = typeof window !== "undefined";

export const REQUIRED_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
] as const;

export function validateRequiredEnv() {
  // Skip validation in browser (validation is server-side)
  if (_isBrowser) return;

  // Server-side validation
  import("../../../backend/src/config/validateEnv")
    .then(({ validateEnvOrThrow }) => {
      validateEnvOrThrow();
    })
    .catch(() => {
      // Validation module failed to load, skip
    });
}

export function validateEnv() {
  validateRequiredEnv();
}

const nodeEnvironment =
  !_isBrowser && typeof process !== "undefined" ? process.env.NODE_ENV : undefined;

export const env = {
  isDevelopment: _isBrowser
    ? import.meta.env?.DEV === true
    : nodeEnvironment === "development",
  isProduction: _isBrowser
    ? import.meta.env?.PROD === true
    : nodeEnvironment === "production",
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

  let value: string | undefined;

  if (_isBrowser) {
    value = (import.meta.env as any)?.[key];
  } else {
    // Server-side only
    if (typeof process !== "undefined" && process.env) {
      value = process.env[key];
    }
  }

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
    (import.meta.env as any)[key] = value;
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
    Object.assign(import.meta.env, envSource);
  } else {
    if (typeof process !== "undefined" && process.env) {
      Object.assign(process.env, envSource);
    }
  }
}

export function __getEnvSourceForTests(): Record<string, string> {
  if (_isBrowser) {
    return { ...(import.meta.env as Record<string, string>) };
  }

  if (typeof process !== "undefined" && process.env) {
    return { ...(process.env as Record<string, string>) };
  }

  return {};
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
} {
  return {
    url: getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_URL") || "",
    anonKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || getEnvVar("SUPABASE_ANON_KEY") || "",
    serviceRoleKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY") || getEnvVar("SUPABASE_SERVICE_KEY"),
  };
}

export function getServerSupabaseConfig(options: { required?: boolean } = {}): {
  url: string;
  serviceRoleKey: string;
} {
  const { required = false } = options;

  const url =
    getEnvVar("VITE_SUPABASE_URL", { scope: "server" }) ||
    getEnvVar("SUPABASE_URL", { scope: "server" }) ||
    "";
  const serviceRoleKey =
    getEnvVar("SUPABASE_SERVICE_ROLE_KEY", { scope: "server" }) ||
    getEnvVar("SUPABASE_SERVICE_KEY", { scope: "server" }) ||
    "";

  if (required && !url) {
    throw new Error(
      "Missing required server environment variable: VITE_SUPABASE_URL (or SUPABASE_URL)"
    );
  }

  if (required && !serviceRoleKey) {
    throw new Error(
      "Missing required server environment variable: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)"
    );
  }

  return { url, serviceRoleKey };
}

export function getGroundtruthConfig(): {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
} {
  return {
    baseUrl:
      getEnvVar("VITE_GROUNDTRUTH_URL") ||
      getEnvVar("GROUNDTRUTH_URL") ||
      "https://api.groundtruth.example.com",
    apiKey: getEnvVar("VITE_GROUNDTRUTH_API_KEY") || getEnvVar("GROUNDTRUTH_API_KEY"),
    timeout: Number(getEnvVar("GROUNDTRUTH_TIMEOUT") || "30000"),
  };
}

export function getLLMCostTrackerConfig(): {
  supabaseUrl: string;
  supabaseKey: string;
  tableName: string;
} {
  return {
    supabaseUrl: getEnvVar("VITE_SUPABASE_URL") || getEnvVar("SUPABASE_URL") || "",
    supabaseKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || getEnvVar("SUPABASE_ANON_KEY") || "",
    tableName: getEnvVar("LLM_COST_TABLE_NAME") || "llm_costs",
  };
}

export function setEnvVarForTests(envSource: Record<string, string>): void {
  __setEnvSourceForTests(envSource);
}

/**
 * Environment Variable Utilities
 */

const isBrowser = typeof window !== "undefined";
const nodeEnvValue = typeof process !== "undefined" && process.env ? process.env["NODE_ENV"] : undefined;

export const env = {
  isDevelopment: isBrowser ? import.meta.env?.DEV === true : nodeEnvValue === "development",
  isProduction: isBrowser ? import.meta.env?.PROD === true : nodeEnvValue === "production",
  isTest: nodeEnvValue === "test",
  isBrowser,
  isServer: !isBrowser,
};

export interface GetEnvVarOptions {
  required?: boolean;
  defaultValue?: string;
}

export function getEnvVar(
  key: string,
  options: GetEnvVarOptions = {},
): string | undefined {
  const { required = false, defaultValue } = options;

  let value: string | undefined;

  if (isBrowser) {
    value = (import.meta.env as Record<string, string>)?.[key];
  } else if (typeof process !== "undefined" && process.env) {
    value = process.env[key];
  }

  if (!value && defaultValue) {
    value = defaultValue;
  }

  if (!value && required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getSupabaseConfig() {
  return {
    url: getEnvVar("VITE_SUPABASE_URL") || "",
    anonKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || "",
  };
}

export function getApiBaseUrl(): string {
  return getEnvVar("VITE_API_BASE_URL") || "/api";
}

/** Test-only: override the env source. No-op in production. */
export function __setEnvSourceForTests(_source: Record<string, string>): void {}

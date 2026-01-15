/**
 * Environment Variable Utilities
 */

const isBrowser = typeof window !== "undefined";

export const env = {
  isDevelopment: isBrowser
    ? import.meta.env?.DEV === true
    : process.env.NODE_ENV === "development",
  isProduction: isBrowser
    ? import.meta.env?.PROD === true
    : process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
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
  } else {
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

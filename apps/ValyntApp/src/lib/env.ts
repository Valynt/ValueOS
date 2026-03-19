/**
 * Browser-only environment utilities for ValyntApp.
 */

const viteEnv =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export const env = {
  isDevelopment: viteEnv.DEV === true || viteEnv.MODE === "development",
  isProduction: viteEnv.PROD === true || viteEnv.MODE === "production",
  isTest: viteEnv.MODE === "test",
  isBrowser: true,
  isServer: false,
};

export interface GetEnvVarOptions {
  required?: boolean;
  defaultValue?: string;
}

export function getEnvVar(key: string, options: GetEnvVarOptions = {}): string | undefined {
  const { required = false, defaultValue } = options;

  const value = viteEnv[key] ?? defaultValue;

  if (!value && required) {
    throw new Error(`Missing required browser environment variable: ${key}`);
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

/**
 * Browser-only Environment Utilities
 * Used by Preview Mode - no Node.js/process references
 */

export const REQUIRED_ENV_VARS: readonly string[] = [];

export function validateRequiredEnv() {
  // No-op in browser preview
}

export function validateEnv() {
  validateRequiredEnv();
}

export const env = {
  isDevelopment: true,
  isProduction: false,
  isTest: false,
  isBrowser: true,
  isServer: false,
};

export interface GetEnvVarOptions {
  required?: boolean;
  defaultValue?: string;
  scope?: "browser" | "server";
}

export function getEnvVar(
  key: string,
  options: GetEnvVarOptions = {}
): string | undefined {
  const { defaultValue } = options;
  return (import.meta.env as any)?.[key] ?? defaultValue;
}

export function setEnvVar(key: string, value: string): void {
  (import.meta.env as any)[key] = value;
}

export function checkIsBrowser(): boolean {
  return true;
}

export function __setEnvSourceForTests(
  envSource: Record<string, string>
): void {
  Object.assign(import.meta.env, envSource);
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
} {
  return {
    url: getEnvVar("VITE_SUPABASE_URL") || "",
    anonKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || "",
    serviceRoleKey: undefined,
  };
}

export function getGroundtruthConfig(): {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
} {
  return {
    baseUrl:
      getEnvVar("VITE_GROUNDTRUTH_URL") ||
      "https://api.groundtruth.example.com",
    apiKey: undefined,
    timeout: 30000,
  };
}

export function getLLMCostTrackerConfig(): {
  supabaseUrl: string;
  supabaseKey: string;
  tableName: string;
} {
  return {
    supabaseUrl: getEnvVar("VITE_SUPABASE_URL") || "",
    supabaseKey: getEnvVar("VITE_SUPABASE_ANON_KEY") || "",
    tableName: "llm_costs",
  };
}

export function setEnvVarForTests(envSource: Record<string, string>): void {
  __setEnvSourceForTests(envSource);
}

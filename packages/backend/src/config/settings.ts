/**
 * Centralized, environment-aware, and schema-validated configuration.
 */
import { z } from "zod";
import { getEnvVar, env as runtimeEnv } from "@shared/lib/env";

// Define the schema for all environment variables
const SettingsSchema = z.object({
  // Vite/Frontend variables (must be prefixed with VITE_)
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_APP_URL: z.string().url().optional(),
  VITE_SENTRY_DSN: z.string().optional(),

  // Backend/Server-side variables
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  API_PORT: z.string().optional().default("3001"),
  // Canonical name: SUPABASE_SERVICE_ROLE_KEY (not SUPABASE_SERVICE_KEY)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_RECIPIENT: z.string().email().optional(),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).optional(),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).optional(),
  DATABASE_POOL_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).optional(),
  DATABASE_POOL_QUERY_TIMEOUT_MS: z.coerce.number().int().min(1000).optional(),

  // Shared variables
  // Add any env vars that might be used in both frontend and backend here.
  // Make sure they are also prefixed with VITE_ if the frontend needs them.
});

// Determine if we are in a server-side (Node.js) or client-side (browser) environment
const isServer = typeof window === "undefined";

// Load managed secrets on the server before parsing the environment
// Use dynamic import to avoid bundling Node.js-only code in the browser
let managedSecrets: Record<string, string> = {};
// optimization: Skip secret hydration in development to prevent startup hangs
// caused by unreachable Vault/AWS endpoints
// We use import.meta.env.SSR check if available (Vite), otherwise runtime check
const isViteSsrBuild = import.meta.env?.SSR;

// Async initialization for server-side secret hydration
// Wrapped in IIFE to avoid top-level await which isn't supported in all build targets
const initSecrets = async () => {
  if ((isViteSsrBuild || isServer) && !runtimeEnv.isDevelopment) {
    try {
      // Use a variable to prevent Vite from analyzing this as a static import in client build
      const hydratorPath = "./secrets/SecretHydrator";
      const { hydrateServerSecretsFromManager } = await import(
        /* @vite-ignore */ hydratorPath
      );
      managedSecrets = await hydrateServerSecretsFromManager();
    } catch {
      // SecretHydrator not available in browser or failed to load
    }
  }
};

// Fire and forget - secrets will be available after initialization
initSecrets();

// We need to handle the case where the server might not have the VITE_ prefix.
// This function helps merge the two possibilities.
const readEnv = (key: string, fallback?: string) => {
  if (isServer && managedSecrets[key]) {
    return managedSecrets[key];
  }

  return getEnvVar(key, { defaultValue: fallback });
};

// Resolve service role key with deprecation support
const resolveServiceRoleKey = () => {
  // Canonical name first
  const canonical = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (canonical) return canonical;

  // Deprecated name with warning
  const deprecated = readEnv("SUPABASE_SERVICE_KEY");
  if (deprecated && isServer) {
    console.warn(
      "[DEPRECATION] SUPABASE_SERVICE_KEY is deprecated. Use SUPABASE_SERVICE_ROLE_KEY instead."
    );
  }
  return deprecated;
};

const resolvedEnv = {
  VITE_SUPABASE_URL: readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY:
    readEnv("VITE_SUPABASE_ANON_KEY") || readEnv("SUPABASE_ANON_KEY"),
  VITE_APP_URL: readEnv("VITE_APP_URL"),
  VITE_SENTRY_DSN: readEnv("VITE_SENTRY_DSN") || readEnv("SENTRY_DSN"),
  NODE_ENV: readEnv("NODE_ENV"),
  API_PORT: readEnv("API_PORT", "3001"),
  SUPABASE_SERVICE_ROLE_KEY: resolveServiceRoleKey(),
  REDIS_URL: readEnv("REDIS_URL"),
  CORS_ALLOWED_ORIGINS: readEnv("CORS_ALLOWED_ORIGINS"),
  ALERT_WEBHOOK_URL: readEnv("ALERT_WEBHOOK_URL"),
  ALERT_EMAIL_RECIPIENT: readEnv("ALERT_EMAIL_RECIPIENT"),
  DATABASE_URL: readEnv("DATABASE_URL"),
  DATABASE_POOL_MAX: readEnv("DATABASE_POOL_MAX"),
  DATABASE_POOL_IDLE_TIMEOUT_MS: readEnv("DATABASE_POOL_IDLE_TIMEOUT_MS"),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: readEnv("DATABASE_POOL_CONNECTION_TIMEOUT_MS"),
  DATABASE_POOL_STATEMENT_TIMEOUT_MS: readEnv("DATABASE_POOL_STATEMENT_TIMEOUT_MS"),
  DATABASE_POOL_QUERY_TIMEOUT_MS: readEnv("DATABASE_POOL_QUERY_TIMEOUT_MS"),
};

let parsedSettings;

try {
  parsedSettings = SettingsSchema.parse(resolvedEnv);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:", error.format());
    throw new Error(
      "Invalid environment variables. Please check your .env file."
    );
  }
  throw error;
}

const defaultCorsOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

const DEFAULT_API_PORT = 3001;
const DEFAULT_DB_POOL_MAX = 10;
const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_DB_POOL_STATEMENT_TIMEOUT_MS = 30_000;
const DEFAULT_DB_POOL_QUERY_TIMEOUT_MS = 30_000;

const parseCorsOrigins = (value?: string) =>
  (value ? value.split(",") : defaultCorsOrigins)
    .map((origin) => origin.trim())
    .filter(Boolean);

export const settings = {
  ...parsedSettings,
  API_PORT: Number(parsedSettings.API_PORT) || DEFAULT_API_PORT,
  databasePool: {
    max: parsedSettings.DATABASE_POOL_MAX ?? DEFAULT_DB_POOL_MAX,
    idleTimeoutMs:
      parsedSettings.DATABASE_POOL_IDLE_TIMEOUT_MS ?? DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMs:
      parsedSettings.DATABASE_POOL_CONNECTION_TIMEOUT_MS ?? DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS,
    statementTimeoutMs:
      parsedSettings.DATABASE_POOL_STATEMENT_TIMEOUT_MS ?? DEFAULT_DB_POOL_STATEMENT_TIMEOUT_MS,
    queryTimeoutMs:
      parsedSettings.DATABASE_POOL_QUERY_TIMEOUT_MS ?? DEFAULT_DB_POOL_QUERY_TIMEOUT_MS,
  },
  security: {
    corsOrigins: parseCorsOrigins(parsedSettings.CORS_ALLOWED_ORIGINS),
  },
};

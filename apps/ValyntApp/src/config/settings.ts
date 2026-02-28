/**
 * Centralized, environment-aware, and schema-validated configuration.
 */
import fs from "fs";

import { z } from "zod";

import { getEnvVar, env as runtimeEnv } from "../lib/env";

const DEFAULT_API_PORT = 3000;
// Keep shutdown timeout long enough for the slowest in-flight agent execution,
// including retry/backoff windows, to drain before forced termination.
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 120_000;

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
  API_PORT: z.string().optional().default("3000"),
  SUPABASE_SERVICE_KEY: z.string().optional(), // Only available on the server
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), // Only available on the server
  SUPABASE_JWT_SECRET: z.string().optional(), // Only available on the server
  REDIS_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_RECIPIENT: z.string().email().optional(),
  DATABASE_URL: z.string().url().optional(),
  SHUTDOWN_TIMEOUT_MS: z.string().optional().default(String(DEFAULT_SHUTDOWN_TIMEOUT_MS)),

  // Shared variables
  // Add any env vars that might be used in both frontend and backend here.
  // Make sure they are also prefixed with VITE_ if the frontend needs them.
});

// Determine if we are in a server-side (Node.js) or client-side (browser) environment
const isServer = typeof window === 'undefined';

// Load managed secrets on the server before parsing the environment
// Use dynamic import to avoid bundling Node.js-only code in the browser
let managedSecrets: Record<string, string> = {};
// optimization: Skip secret hydration in development to prevent startup hangs
// caused by unreachable Vault/AWS endpoints
// We use import.meta.env.SSR check if available (Vite), otherwise runtime check
const isViteSsrBuild = import.meta.env?.SSR;

if ((isViteSsrBuild || isServer) && !runtimeEnv.isDevelopment) {
  try {
    // Use a variable to prevent Vite from analyzing this as a static import in client build
    const hydratorPath = "./secrets/SecretHydrator";
    const { hydrateServerSecretsFromManager } =
      await import(/* @vite-ignore */ hydratorPath);
    managedSecrets = await hydrateServerSecretsFromManager();
  } catch {
    // SecretHydrator not available in browser or failed to load
  }
}

// We need to handle the case where the server might not have the VITE_ prefix.
// This function helps merge the two possibilities.
const readEnv = (key: string, fallback?: string) => {
  if (isServer && managedSecrets[key]) {
    return managedSecrets[key];
  }

  // Check for _FILE environment variables (Docker secret injection)
  if (isServer) {
    const fileKey = `${key}_FILE`;
    const filePath = getEnvVar(fileKey);
    if (filePath) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.trim();
      } catch (error) {
        console.warn(`Failed to read secret from file ${filePath} for ${key}:`, error);
      }
    }
  }

  return getEnvVar(key, { defaultValue: fallback });
};

const resolvedEnv = {
  VITE_SUPABASE_URL: readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_PUBLIC_URL") || readEnv("SUPABASE_URL") || readEnv("SUPABASE_INTERNAL_URL"),
  VITE_SUPABASE_ANON_KEY:
    readEnv("VITE_SUPABASE_ANON_KEY") || readEnv("SUPABASE_ANON_KEY"),
  VITE_APP_URL: readEnv("VITE_APP_URL"),
  VITE_SENTRY_DSN: readEnv("VITE_SENTRY_DSN") || readEnv("SENTRY_DSN"),
  NODE_ENV: readEnv("NODE_ENV"),
  API_PORT: readEnv("API_PORT", "3000"),
  SUPABASE_SERVICE_KEY: readEnv("SUPABASE_SERVICE_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_JWT_SECRET: readEnv("SUPABASE_JWT_SECRET"),
  REDIS_URL: readEnv("REDIS_URL"),
  CORS_ALLOWED_ORIGINS: readEnv("CORS_ALLOWED_ORIGINS"),
  ALERT_WEBHOOK_URL: readEnv("ALERT_WEBHOOK_URL"),
  ALERT_EMAIL_RECIPIENT: readEnv("ALERT_EMAIL_RECIPIENT"),
  DATABASE_URL: readEnv("DATABASE_URL"),
  SHUTDOWN_TIMEOUT_MS: readEnv("SHUTDOWN_TIMEOUT_MS", String(DEFAULT_SHUTDOWN_TIMEOUT_MS)),
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


export const validateRedisUrlForProduction = (nodeEnv: string, redisUrl?: string) => {
  if (nodeEnv !== "production" || !redisUrl) {
    return;
  }

  const parsed = new URL(redisUrl);
  const isRedisProtocol = parsed.protocol === "redis:" || parsed.protocol === "rediss:";

  if (isRedisProtocol && !parsed.password) {
    throw new Error(
      "Invalid REDIS_URL for production: Redis password is required in the URL (redis://:password@host:port)."
    );
  }
};


validateRedisUrlForProduction(parsedSettings.NODE_ENV, parsedSettings.REDIS_URL);

const defaultCorsOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

const parseCorsOrigins = (value?: string) =>
  (value ? value.split(",") : defaultCorsOrigins)
    .map((origin) => origin.trim())
    .filter(Boolean);

export const settings = {
  ...parsedSettings,
  API_PORT: Number(parsedSettings.API_PORT) || DEFAULT_API_PORT,
  SHUTDOWN_TIMEOUT_MS:
    Number(parsedSettings.SHUTDOWN_TIMEOUT_MS) || DEFAULT_SHUTDOWN_TIMEOUT_MS,
  security: {
    corsOrigins: parseCorsOrigins(parsedSettings.CORS_ALLOWED_ORIGINS),
  },
};

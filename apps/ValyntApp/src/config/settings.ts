/**
 * Centralized, browser-safe, schema-validated configuration.
 */

import { z } from "zod";

import { getEnvVar } from "../lib/env";

const DEFAULT_API_PORT = 3000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 120_000;

const SettingsSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_APP_URL: z.string().url().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  API_PORT: z.string().optional().default("3000"),
  REDIS_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_RECIPIENT: z.string().email().optional(),
  DATABASE_URL: z.string().url().optional(),
  SHUTDOWN_TIMEOUT_MS: z.string().optional().default(String(DEFAULT_SHUTDOWN_TIMEOUT_MS)),
});

const readEnv = (key: string, fallback?: string) => getEnvVar(key, { defaultValue: fallback });

const resolvedEnv = {
  VITE_SUPABASE_URL: readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_PUBLIC_URL") || readEnv("SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY:
    readEnv("VITE_SUPABASE_ANON_KEY") || readEnv("SUPABASE_ANON_KEY"),
  VITE_APP_URL: readEnv("VITE_APP_URL"),
  VITE_SENTRY_DSN: readEnv("VITE_SENTRY_DSN") || readEnv("SENTRY_DSN"),
  NODE_ENV: readEnv("NODE_ENV"),
  API_PORT: readEnv("API_PORT", "3000"),
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
    throw new Error("Invalid environment variables. Please check your .env file.");
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

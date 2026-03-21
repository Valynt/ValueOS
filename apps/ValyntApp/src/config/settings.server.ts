/**
 * Server-only ValyntApp configuration.
 *
 * This module may resolve service-role credentials, managed secrets,
 * and Docker-style *_FILE secret mounts. Do not import from browser entrypoints.
 */
import fs from "fs";

import { z } from "zod";

import { getEnvVar, env as runtimeEnv } from "../lib/env";

import {
  DEFAULT_API_PORT,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  parseCorsOrigins,
  ServerSettingsSchema,
} from "./settings.shared";

const isServer = typeof window === "undefined";
const isViteSsrBuild = import.meta.env?.SSR;

let managedSecrets: Record<string, string> = {};

if ((isViteSsrBuild || isServer) && !runtimeEnv.isDevelopment) {
  try {
    const hydratorPath = "./secrets/SecretHydrator";
    const { hydrateServerSecretsFromManager } = await import(/* @vite-ignore */ hydratorPath);
    managedSecrets = await hydrateServerSecretsFromManager();
  } catch {
    // Secret hydrator unavailable or disabled in the current runtime.
  }
}

const readServerEnv = (key: string, fallback?: string) => {
  if (managedSecrets[key]) {
    return managedSecrets[key];
  }

  const fileKey = `${key}_FILE`;
  const filePath = getEnvVar(fileKey);
  if (filePath) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch (error) {
      console.warn(`Failed to read secret from file ${filePath} for ${key}:`, error);
    }
  }

  return getEnvVar(key, { defaultValue: fallback });
};

const resolvedServerEnv = {
  VITE_SUPABASE_URL:
    readServerEnv("VITE_SUPABASE_URL") ||
    readServerEnv("SUPABASE_PUBLIC_URL") ||
    readServerEnv("SUPABASE_URL") ||
    readServerEnv("SUPABASE_INTERNAL_URL"),
  VITE_SUPABASE_ANON_KEY:
    readServerEnv("VITE_SUPABASE_ANON_KEY") || readServerEnv("SUPABASE_ANON_KEY"),
  VITE_APP_URL: readServerEnv("VITE_APP_URL"),
  VITE_SENTRY_DSN: readServerEnv("VITE_SENTRY_DSN") || readServerEnv("SENTRY_DSN"),
  NODE_ENV: readServerEnv("NODE_ENV"),
  API_PORT: readServerEnv("API_PORT", String(DEFAULT_API_PORT)),
  SUPABASE_SERVICE_KEY: readServerEnv("SUPABASE_SERVICE_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: readServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_JWT_SECRET: readServerEnv("SUPABASE_JWT_SECRET"),
  REDIS_URL: readServerEnv("REDIS_URL"),
  CORS_ALLOWED_ORIGINS: readServerEnv("CORS_ALLOWED_ORIGINS"),
  ALERT_WEBHOOK_URL: readServerEnv("ALERT_WEBHOOK_URL"),
  ALERT_EMAIL_RECIPIENT: readServerEnv("ALERT_EMAIL_RECIPIENT"),
  DATABASE_URL: readServerEnv("DATABASE_URL"),
  SHUTDOWN_TIMEOUT_MS: readServerEnv(
    "SHUTDOWN_TIMEOUT_MS",
    String(DEFAULT_SHUTDOWN_TIMEOUT_MS),
  ),
};

let parsedServerSettings: z.infer<typeof ServerSettingsSchema>;

try {
  parsedServerSettings = ServerSettingsSchema.parse(resolvedServerEnv);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid server environment variables:", error.format());
    throw new Error("Invalid server environment variables. Please check your .env file.");
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
      "Invalid REDIS_URL for production: Redis password is required in the URL (redis://:password@host:port).",
    );
  }
};

validateRedisUrlForProduction(parsedServerSettings.NODE_ENV, parsedServerSettings.REDIS_URL);

export const serverSettings = {
  ...parsedServerSettings,
  API_PORT: Number(parsedServerSettings.API_PORT) || DEFAULT_API_PORT,
  SHUTDOWN_TIMEOUT_MS:
    Number(parsedServerSettings.SHUTDOWN_TIMEOUT_MS) || DEFAULT_SHUTDOWN_TIMEOUT_MS,
  security: {
    corsOrigins: parseCorsOrigins(parsedServerSettings.CORS_ALLOWED_ORIGINS),
  },
};

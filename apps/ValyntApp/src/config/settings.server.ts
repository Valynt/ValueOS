/**
 * Server-only application settings.
 *
 * Managed secrets, service-role credentials, and `_FILE` environment fallbacks
 * are intentionally isolated from browser-safe modules.
 */
import fs from "node:fs";

import { z } from "zod";

import { getEnvVar, env as runtimeEnv } from "../lib/env";

import { validateRedisUrlForProduction } from "./settings";

const DEFAULT_API_PORT = 3000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 120_000;

const ServerSettingsSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_APP_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  API_PORT: z.string().optional().default("3000"),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_RECIPIENT: z.string().email().optional(),
  DATABASE_URL: z.string().url().optional(),
  SHUTDOWN_TIMEOUT_MS: z
    .string()
    .optional()
    .default(String(DEFAULT_SHUTDOWN_TIMEOUT_MS)),
});

let managedSecrets: Record<string, string> = {};
const isServer = typeof window === "undefined";
const isViteSsrBuild = import.meta.env?.SSR;

if ((isViteSsrBuild || isServer) && !runtimeEnv.isDevelopment) {
  try {
    const hydratorPath = "./secrets/SecretHydrator";
    const { hydrateServerSecretsFromManager } =
      await import(/* @vite-ignore */ hydratorPath);
    managedSecrets = await hydrateServerSecretsFromManager();
  } catch {
    managedSecrets = {};
  }
}

const readServerEnv = (key: string, fallback?: string) => {
  if (managedSecrets[key]) {
    return managedSecrets[key];
  }

  const filePath = getEnvVar(`${key}_FILE`);
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
  NODE_ENV: readServerEnv("NODE_ENV"),
  API_PORT: readServerEnv("API_PORT", "3000"),
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

const parsedServerSettings = ServerSettingsSchema.parse(resolvedServerEnv);

validateRedisUrlForProduction(parsedServerSettings.NODE_ENV, parsedServerSettings.REDIS_URL);

const defaultCorsOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

const parseCorsOrigins = (value?: string) =>
  (value ? value.split(",") : defaultCorsOrigins)
    .map((origin) => origin.trim())
    .filter(Boolean);

export const serverSettings = {
  ...parsedServerSettings,
  API_PORT: Number(parsedServerSettings.API_PORT) || DEFAULT_API_PORT,
  SHUTDOWN_TIMEOUT_MS:
    Number(parsedServerSettings.SHUTDOWN_TIMEOUT_MS) || DEFAULT_SHUTDOWN_TIMEOUT_MS,
  security: {
    corsOrigins: parseCorsOrigins(parsedServerSettings.CORS_ALLOWED_ORIGINS),
  },
};

export const settings = serverSettings;

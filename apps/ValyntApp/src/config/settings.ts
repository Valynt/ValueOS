/**
 * Browser-safe application settings.
 *
 * This module must only expose public configuration that is safe to bundle
 * into client entrypoints. Server secrets, managed-secret hydration, and
 * `_FILE` secret resolution live in `settings.server.ts`.
 */
import { z } from "zod";

import { getEnvVar } from "../lib/env";

const DEFAULT_API_PORT = 3000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 120_000;

const PublicSettingsSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_APP_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  API_PORT: z.string().optional().default("3000"),
  SHUTDOWN_TIMEOUT_MS: z
    .string()
    .optional()
    .default(String(DEFAULT_SHUTDOWN_TIMEOUT_MS)),
});

const resolvedPublicEnv = {
  VITE_SUPABASE_URL: getEnvVar("VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: getEnvVar("VITE_SUPABASE_ANON_KEY"),
  VITE_APP_URL: getEnvVar("VITE_APP_URL"),
  NODE_ENV: getEnvVar("NODE_ENV"),
  API_PORT: getEnvVar("API_PORT", { defaultValue: "3000" }),
  SHUTDOWN_TIMEOUT_MS: getEnvVar("SHUTDOWN_TIMEOUT_MS", {
    defaultValue: String(DEFAULT_SHUTDOWN_TIMEOUT_MS),
  }),
};

const parsedPublicSettings = PublicSettingsSchema.parse(resolvedPublicEnv);

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

export const settings = {
  ...parsedPublicSettings,
  API_PORT: Number(parsedPublicSettings.API_PORT) || DEFAULT_API_PORT,
  SHUTDOWN_TIMEOUT_MS:
    Number(parsedPublicSettings.SHUTDOWN_TIMEOUT_MS) || DEFAULT_SHUTDOWN_TIMEOUT_MS,
};


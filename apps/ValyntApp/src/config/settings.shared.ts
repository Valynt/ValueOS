import { z } from "zod";

export const DEFAULT_API_PORT = 3000;
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 120_000;

export const PublicSettingsSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_APP_URL: z.string().url().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
});

export const ServerSettingsSchema = PublicSettingsSchema.extend({
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  API_PORT: z.string().optional().default(String(DEFAULT_API_PORT)),
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

export const defaultCorsOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

export const parseCorsOrigins = (value?: string) =>
  (value ? value.split(",") : defaultCorsOrigins)
    .map((origin) => origin.trim())
    .filter(Boolean);

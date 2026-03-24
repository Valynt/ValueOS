/**
 * Centralized, environment-aware, and schema-validated configuration.
 */
import { parseCorsAllowlist } from "@shared/config/cors";
import { getEnvVar, env as runtimeEnv } from "@shared/lib/env";
import { logger } from "@backend/lib/logger";
import { z } from "zod";

const AppEnvSchema = z.enum(["local", "cloud-dev", "test", "staging", "prod"]);
const DatabasePoolRoleSchema = z.enum(["api", "worker", "migration", "maintenance"]);

type AppEnv = z.infer<typeof AppEnvSchema>;
type DatabasePoolRole = z.infer<typeof DatabasePoolRoleSchema>;

type PoolSizingProfile = {
  concurrencyMultiplier: number;
  min: number;
  maxByEnv: Record<AppEnv, number>;
  defaultExpectedConcurrency: Record<AppEnv, number>;
};

const POOL_SIZING_PROFILES: Record<DatabasePoolRole, PoolSizingProfile> = {
  api: {
    concurrencyMultiplier: 0.5,
    min: 2,
    maxByEnv: {
      local: 8,
      "cloud-dev": 6,
      test: 4,
      staging: 4,
      prod: 4,
    },
    defaultExpectedConcurrency: {
      local: 12,
      "cloud-dev": 10,
      test: 4,
      staging: 8,
      prod: 8,
    },
  },
  worker: {
    concurrencyMultiplier: 0.75,
    min: 2,
    maxByEnv: {
      local: 6,
      "cloud-dev": 4,
      test: 2,
      staging: 3,
      prod: 3,
    },
    defaultExpectedConcurrency: {
      local: 6,
      "cloud-dev": 4,
      test: 2,
      staging: 4,
      prod: 4,
    },
  },
  migration: {
    concurrencyMultiplier: 1,
    min: 1,
    maxByEnv: {
      local: 2,
      "cloud-dev": 2,
      test: 1,
      staging: 2,
      prod: 2,
    },
    defaultExpectedConcurrency: {
      local: 1,
      "cloud-dev": 1,
      test: 1,
      staging: 1,
      prod: 1,
    },
  },
  maintenance: {
    concurrencyMultiplier: 1,
    min: 1,
    maxByEnv: {
      local: 2,
      "cloud-dev": 2,
      test: 1,
      staging: 2,
      prod: 2,
    },
    defaultExpectedConcurrency: {
      local: 1,
      "cloud-dev": 1,
      test: 1,
      staging: 1,
      prod: 1,
    },
  },
};

const inferAppEnv = (nodeEnv?: "development" | "staging" | "production" | "test"): AppEnv => {
  switch (nodeEnv) {
    case "production":
      return "prod";
    case "staging":
      return "staging";
    case "test":
      return "test";
    case "development":
    default:
      return "local";
  }
};

const clampPoolSize = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const deriveDatabasePoolSizing = ({
  appEnv,
  role,
  configuredMax,
  expectedConcurrency,
}: {
  appEnv: AppEnv;
  role: DatabasePoolRole;
  configuredMax?: number;
  expectedConcurrency?: number;
}) => {
  const profile = POOL_SIZING_PROFILES[role];
  const resolvedExpectedConcurrency =
    expectedConcurrency ?? profile.defaultExpectedConcurrency[appEnv];

  if (configuredMax !== undefined) {
    return {
      appEnv,
      role,
      expectedConcurrency: resolvedExpectedConcurrency,
      max: configuredMax,
      source: "env-override" as const,
    };
  }

  const derivedMax = clampPoolSize(
    Math.ceil(resolvedExpectedConcurrency * profile.concurrencyMultiplier),
    profile.min,
    profile.maxByEnv[appEnv]
  );

  return {
    appEnv,
    role,
    expectedConcurrency: resolvedExpectedConcurrency,
    max: derivedMax,
    source: "derived" as const,
  };
};

// Define the schema for all environment variables
const SettingsSchema = z.object({
  // Vite/Frontend variables (must be prefixed with VITE_)
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_APP_URL: z.string().url().optional(),

  // Backend/Server-side variables
  APP_ENV: AppEnvSchema.optional(),
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
  // Database precedence: DATABASE_URL is canonical; DB_URL is legacy fallback only.
  DATABASE_URL: z.string().url().optional(),
  DB_URL: z.string().url().optional(),
  DATABASE_POOL_ROLE: DatabasePoolRoleSchema.optional(),
  DATABASE_EXPECTED_CONCURRENCY: z.coerce.number().int().min(1).max(200).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).optional(),
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

// Async initialization for server-side secret hydration.
// Must be awaited before the server starts accepting traffic in production
// to avoid a race where requests arrive before secrets are loaded.
export const initSecrets = async (): Promise<void> => {
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

// We need to handle the case where the server might not have the VITE_ prefix.
// This function helps merge the two possibilities.
const readEnv = (key: string, fallback?: string) => {
  if (isServer && managedSecrets[key]) {
    return managedSecrets[key];
  }

  return getEnvVar(key, { defaultValue: fallback });
};

const DEPRECATED_ENV_ALIASES: Record<string, string> = {
  SUPABASE_SERVICE_KEY: "SUPABASE_SERVICE_ROLE_KEY",
};

const assertNoDeprecatedAliases = () => {
  const found = Object.entries(DEPRECATED_ENV_ALIASES).find(([deprecated]) => Boolean(readEnv(deprecated)));
  if (!found) {
    return;
  }

  const [deprecated, canonical] = found;
  throw new Error(
    `Deprecated environment variable ${deprecated} is set. Use ${canonical} instead.`
  );
};

assertNoDeprecatedAliases();

const resolvedEnv = {
  VITE_SUPABASE_URL: readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY:
    readEnv("VITE_SUPABASE_ANON_KEY") || readEnv("SUPABASE_ANON_KEY"),
  VITE_APP_URL: readEnv("VITE_APP_URL"),
  APP_ENV: readEnv("APP_ENV"),
  NODE_ENV: readEnv("NODE_ENV"),
  API_PORT: readEnv("API_PORT", "3001"),
  SUPABASE_SERVICE_ROLE_KEY: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  REDIS_URL: readEnv("REDIS_URL"),
  CORS_ALLOWED_ORIGINS: readEnv("CORS_ALLOWED_ORIGINS"),
  ALERT_WEBHOOK_URL: readEnv("ALERT_WEBHOOK_URL"),
  ALERT_EMAIL_RECIPIENT: readEnv("ALERT_EMAIL_RECIPIENT"),
  DATABASE_URL: readEnv("DATABASE_URL") || readEnv("DB_URL"),
  DB_URL: readEnv("DB_URL"),
  DATABASE_POOL_ROLE: readEnv("DATABASE_POOL_ROLE"),
  DATABASE_EXPECTED_CONCURRENCY: readEnv("DATABASE_EXPECTED_CONCURRENCY"),
  DATABASE_POOL_MAX: readEnv("DATABASE_POOL_MAX"),
  DATABASE_POOL_SIZE: readEnv("DATABASE_POOL_SIZE"),
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
    logger.error("❌ Invalid environment variables:", { error: error.format() });
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
const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_DB_POOL_STATEMENT_TIMEOUT_MS = 30_000;
const DEFAULT_DB_POOL_QUERY_TIMEOUT_MS = 30_000;

const appEnv = parsedSettings.APP_ENV ?? inferAppEnv(parsedSettings.NODE_ENV);
const databasePoolSizing = deriveDatabasePoolSizing({
  appEnv,
  role: parsedSettings.DATABASE_POOL_ROLE ?? "api",
  configuredMax: parsedSettings.DATABASE_POOL_MAX ?? parsedSettings.DATABASE_POOL_SIZE,
  expectedConcurrency: parsedSettings.DATABASE_EXPECTED_CONCURRENCY,
});

export const settings = {
  ...parsedSettings,
  APP_ENV: appEnv,
  API_PORT: Number(parsedSettings.API_PORT) || DEFAULT_API_PORT,
  databasePool: {
    appEnv: databasePoolSizing.appEnv,
    role: databasePoolSizing.role,
    expectedConcurrency: databasePoolSizing.expectedConcurrency,
    max: databasePoolSizing.max,
    maxSource: databasePoolSizing.source,
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
    corsOrigins: parseCorsAllowlist(
      parsedSettings.CORS_ALLOWED_ORIGINS ?? defaultCorsOrigins.join(","),
      {
        source: "CORS_ALLOWED_ORIGINS",
        credentials: true,
        requireNonEmpty: true,
      }
    ),
  },
};

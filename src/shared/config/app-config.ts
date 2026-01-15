/**
 * Application Configuration
 *
 * Centralized configuration management for the ValueOS application.
 * Replaces scattered environment variable handling.
 */

import { z } from "zod";

// ============================================================================
// Configuration Schema
// ============================================================================

const AppConfigSchema = z.object({
  // Application
  app: z.object({
    name: z.string().default("ValueOS"),
    version: z.string().default("1.0.0"),
    environment: z
      .enum(["development", "staging", "production"])
      .default("development"),
    debug: z.boolean().default(false),
  }),

  // Database
  database: z.object({
    url: z.string().default(""),
    poolSize: z.number().default(10),
    timeout: z.number().default(30000),
  }),

  // Supabase
  supabase: z.object({
    url: z.string().default(""),
    anonKey: z.string().default(""),
    serviceKey: z.string().optional(),
  }),

  // Authentication
  auth: z.object({
    sessionTimeout: z.number().default(86400000), // 24 hours
    refreshTokenTimeout: z.number().default(604800000), // 7 days
    enableMFA: z.boolean().default(false),
  }),

  // API Configuration
  api: z.object({
    baseUrl: z.string().default("/api"),
    timeout: z.number().default(30000),
    retryAttempts: z.number().default(3),
    rateLimiting: z.object({
      enabled: z.boolean().default(true),
      requestsPerMinute: z.number().default(100),
    }),
  }),

  // LLM Configuration
  llm: z.object({
    provider: z.enum(["openai", "anthropic", "together"]).default("openai"),
    model: z.string().default("gpt-4"),
    temperature: z.number().default(0.7),
    maxTokens: z.number().default(2000),
    timeout: z.number().default(60000),
  }),

  // Feature Flags
  features: z.object({
    enableAgents: z.boolean().default(true),
    enableCanvas: z.boolean().default(true),
    enableIntegrations: z.boolean().default(true),
    enableBilling: z.boolean().default(false),
    enableMonitoring: z.boolean().default(true),
  }),

  // Monitoring
  monitoring: z.object({
    enabled: z.boolean().default(true),
    sentryDsn: z.string().optional(),
    logLevel: z.enum(["error", "warn", "info", "debug"]).default("info"),
    metrics: z.object({
      enabled: z.boolean().default(true),
      interval: z.number().default(60000), // 1 minute
    }),
  }),

  // Security
  security: z.object({
    enableCORS: z.boolean().default(true),
    enableHelmet: z.boolean().default(true),
    enableRateLimit: z.boolean().default(true),
    jwtSecret: z.string().default("dev-jwt-secret"),
    encryptionKey: z.string().default("dev-encryption-key"),
  }),

  // Cache
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().default(3600000), // 1 hour
    maxSize: z.number().default(1000),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// ============================================================================
// Configuration Loader
// ============================================================================

class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  load(): AppConfig {
    if (this.config) {
      return this.config;
    }

    const envConfig = this.loadFromEnvironment();
    const fileConfig = this.loadFromFiles();
    const mergedConfig = { ...fileConfig, ...envConfig };

    this.config = AppConfigSchema.parse(mergedConfig);
    return this.config;
  }

  private loadFromEnvironment(): Partial<AppConfig> {
    const viteEnv =
      typeof import.meta !== "undefined" && (import.meta as any).env
        ? ((import.meta as any).env as Record<string, string | undefined>)
        : undefined;

    const readEnv = (key: string): string | undefined => {
      if (viteEnv && typeof viteEnv[key] === "string") {
        return viteEnv[key];
      }
      if (typeof process !== "undefined" && process.env) {
        return process.env[key];
      }
      return undefined;
    };

    return {
      app: {
        name: readEnv("VITE_APP_NAME"),
        version: readEnv("VITE_APP_VERSION"),
        environment: (readEnv("NODE_ENV") as any) || "development",
        debug: readEnv("VITE_DEBUG") === "true",
      },
      database: {
        url: readEnv("DATABASE_URL"),
        poolSize: readEnv("DATABASE_POOL_SIZE")
          ? parseInt(readEnv("DATABASE_POOL_SIZE") as string)
          : undefined,
        timeout: readEnv("DATABASE_TIMEOUT")
          ? parseInt(readEnv("DATABASE_TIMEOUT") as string)
          : undefined,
      },
      supabase: {
        url: readEnv("VITE_SUPABASE_URL"),
        anonKey: readEnv("VITE_SUPABASE_ANON_KEY"),
        serviceKey: readEnv("SUPABASE_SERVICE_KEY"),
      },
      auth: {
        sessionTimeout: readEnv("AUTH_SESSION_TIMEOUT")
          ? parseInt(readEnv("AUTH_SESSION_TIMEOUT") as string)
          : undefined,
        refreshTokenTimeout: readEnv("AUTH_REFRESH_TIMEOUT")
          ? parseInt(readEnv("AUTH_REFRESH_TIMEOUT") as string)
          : undefined,
        enableMFA: readEnv("AUTH_ENABLE_MFA") === "true",
      },
      api: {
        baseUrl: readEnv("VITE_API_BASE_URL") || readEnv("VITE_API_URL"),
        timeout: readEnv("API_TIMEOUT")
          ? parseInt(readEnv("API_TIMEOUT") as string)
          : undefined,
        retryAttempts: readEnv("API_RETRY_ATTEMPTS")
          ? parseInt(readEnv("API_RETRY_ATTEMPTS") as string)
          : undefined,
        rateLimiting: {
          enabled: readEnv("API_RATE_LIMIT_ENABLED") !== "false",
          requestsPerMinute: readEnv("API_RATE_LIMIT_RPM")
            ? parseInt(readEnv("API_RATE_LIMIT_RPM") as string)
            : undefined,
        },
      },
      llm: {
        provider: readEnv("LLM_PROVIDER") as any,
        model: readEnv("LLM_MODEL"),
        temperature: readEnv("LLM_TEMPERATURE")
          ? parseFloat(readEnv("LLM_TEMPERATURE") as string)
          : undefined,
        maxTokens: readEnv("LLM_MAX_TOKENS")
          ? parseInt(readEnv("LLM_MAX_TOKENS") as string)
          : undefined,
        timeout: readEnv("LLM_TIMEOUT")
          ? parseInt(readEnv("LLM_TIMEOUT") as string)
          : undefined,
      },
      features: {
        enableAgents: readEnv("FEATURE_AGENTS") !== "false",
        enableCanvas: readEnv("FEATURE_CANVAS") !== "false",
        enableIntegrations: readEnv("FEATURE_INTEGRATIONS") !== "false",
        enableBilling: readEnv("FEATURE_BILLING") === "true",
        enableMonitoring: readEnv("FEATURE_MONITORING") !== "false",
      },
      monitoring: {
        enabled: readEnv("MONITORING_ENABLED") !== "false",
        sentryDsn: readEnv("SENTRY_DSN"),
        logLevel: readEnv("LOG_LEVEL") as any,
        metrics: {
          enabled: readEnv("METRICS_ENABLED") !== "false",
          interval: readEnv("METRICS_INTERVAL")
            ? parseInt(readEnv("METRICS_INTERVAL") as string)
            : undefined,
        },
      },
      security: {
        enableCORS: readEnv("SECURITY_CORS") !== "false",
        enableHelmet: readEnv("SECURITY_HELMET") !== "false",
        enableRateLimit: readEnv("SECURITY_RATE_LIMIT") !== "false",
        jwtSecret: readEnv("JWT_SECRET"),
        encryptionKey: readEnv("ENCRYPTION_KEY"),
      },
      cache: {
        enabled: readEnv("CACHE_ENABLED") !== "false",
        ttl: readEnv("CACHE_TTL")
          ? parseInt(readEnv("CACHE_TTL") as string)
          : undefined,
        maxSize: readEnv("CACHE_MAX_SIZE")
          ? parseInt(readEnv("CACHE_MAX_SIZE") as string)
          : undefined,
      },
    };
  }

  private loadFromFiles(): Partial<AppConfig> {
    // Load from config files based on environment
    const env = process.env.NODE_ENV || "development";

    try {
      // Try to load environment-specific config
      const envConfigFile = `./config/${env}.json`;
      // In a real implementation, you would load and parse the file here
      return {};
    } catch (error) {
      console.warn(`Could not load config for environment ${env}:`, error);
      return {};
    }
  }

  reload(): AppConfig {
    this.config = null;
    return this.load();
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      AppConfigSchema.parse(this.loadFromEnvironment());
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        };
      }
      return {
        valid: false,
        errors: [
          error instanceof Error ? error.message : "Unknown validation error",
        ],
      };
    }
  }
}

// ============================================================================
// Configuration Instance
// ============================================================================

export const config = ConfigLoader.getInstance();

// ============================================================================
// Configuration Helpers
// ============================================================================

export const getAppConfig = (): AppConfig => {
  return config.load();
};

export const isDevelopment = (): boolean => {
  return getAppConfig().app.environment === "development";
};

export const isProduction = (): boolean => {
  return getAppConfig().app.environment === "production";
};

export const isFeatureEnabled = (
  feature: keyof AppConfig["features"]
): boolean => {
  return getAppConfig().features[feature];
};

export const getDatabaseConfig = () => {
  const appConfig = getAppConfig();
  return appConfig.database;
};

export const getSupabaseConfig = () => {
  const appConfig = getAppConfig();
  return appConfig.supabase;
};

export const getLLMConfig = () => {
  const appConfig = getAppConfig();
  return appConfig.llm;
};

export const getMonitoringConfig = () => {
  const appConfig = getAppConfig();
  return appConfig.monitoring;
};

// ============================================================================
// Configuration Validation
// ============================================================================

export const validateConfig = (): void => {
  const validation = config.validate();

  if (!validation.valid) {
    console.error("Configuration validation failed:");
    validation.errors.forEach((error) => console.error(`  - ${error}`));

    if (isProduction() && typeof window === "undefined") {
      throw new Error("Invalid configuration in production environment");
    }
  }
};

// Initialize and validate configuration
try {
  validateConfig();
} catch (error) {
  if (typeof window !== "undefined") {
    console.error(
      "Configuration validation failed in browser; continuing in degraded mode",
      error
    );
  } else {
    throw error;
  }
}

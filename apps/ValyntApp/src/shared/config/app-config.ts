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
    environment: z.enum(["development", "staging", "production"]).default("development"),
    debug: z.boolean().default(false),
  }),

  // Database
  database: z.object({
    url: z.string(),
    poolSize: z.number().default(10),
    timeout: z.number().default(30000),
  }),

  // Supabase
  supabase: z.object({
    url: z.string(),
    anonKey: z.string(),
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
    baseUrl: z.string(),
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
    jwtSecret: z.string(),
    encryptionKey: z.string(),
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
    return {
      app: {
        name: process.env.VITE_APP_NAME,
        version: process.env.VITE_APP_VERSION,
        environment: (process.env.NODE_ENV as any) || "development",
        debug: process.env.VITE_DEBUG === "true",
      },
      database: {
        url: process.env.DATABASE_URL,
        poolSize: process.env.DATABASE_POOL_SIZE
          ? parseInt(process.env.DATABASE_POOL_SIZE)
          : undefined,
        timeout: process.env.DATABASE_TIMEOUT ? parseInt(process.env.DATABASE_TIMEOUT) : undefined,
      },
      supabase: {
        url: process.env.VITE_SUPABASE_URL,
        anonKey: process.env.VITE_SUPABASE_ANON_KEY,
        serviceKey: process.env.SUPABASE_SERVICE_KEY,
      },
      auth: {
        sessionTimeout: process.env.AUTH_SESSION_TIMEOUT
          ? parseInt(process.env.AUTH_SESSION_TIMEOUT)
          : undefined,
        refreshTokenTimeout: process.env.AUTH_REFRESH_TIMEOUT
          ? parseInt(process.env.AUTH_REFRESH_TIMEOUT)
          : undefined,
        enableMFA: process.env.AUTH_ENABLE_MFA === "true",
      },
      api: {
        baseUrl: process.env.VITE_API_URL,
        timeout: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT) : undefined,
        retryAttempts: process.env.API_RETRY_ATTEMPTS
          ? parseInt(process.env.API_RETRY_ATTEMPTS)
          : undefined,
        rateLimiting: {
          enabled: process.env.API_RATE_LIMIT_ENABLED !== "false",
          requestsPerMinute: process.env.API_RATE_LIMIT_RPM
            ? parseInt(process.env.API_RATE_LIMIT_RPM)
            : undefined,
        },
      },
      llm: {
        provider: process.env.LLM_PROVIDER as any,
        model: process.env.LLM_MODEL,
        temperature: process.env.LLM_TEMPERATURE
          ? parseFloat(process.env.LLM_TEMPERATURE)
          : undefined,
        maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS) : undefined,
        timeout: process.env.LLM_TIMEOUT ? parseInt(process.env.LLM_TIMEOUT) : undefined,
      },
      features: {
        enableAgents: process.env.FEATURE_AGENTS !== "false",
        enableCanvas: process.env.FEATURE_CANVAS !== "false",
        enableIntegrations: process.env.FEATURE_INTEGRATIONS !== "false",
        enableBilling: process.env.FEATURE_BILLING === "true",
        enableMonitoring: process.env.FEATURE_MONITORING !== "false",
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== "false",
        sentryDsn: process.env.SENTRY_DSN,
        logLevel: process.env.LOG_LEVEL as any,
        metrics: {
          enabled: process.env.METRICS_ENABLED !== "false",
          interval: process.env.METRICS_INTERVAL
            ? parseInt(process.env.METRICS_INTERVAL)
            : undefined,
        },
      },
      security: {
        enableCORS: process.env.SECURITY_CORS !== "false",
        enableHelmet: process.env.SECURITY_HELMET !== "false",
        enableRateLimit: process.env.SECURITY_RATE_LIMIT !== "false",
        jwtSecret: process.env.JWT_SECRET,
        encryptionKey: process.env.ENCRYPTION_KEY,
      },
      cache: {
        enabled: process.env.CACHE_ENABLED !== "false",
        ttl: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : undefined,
        maxSize: process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE) : undefined,
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
        errors: [error instanceof Error ? error.message : "Unknown validation error"],
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

export const isFeatureEnabled = (feature: keyof AppConfig["features"]): boolean => {
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

    if (isProduction()) {
      throw new Error("Invalid configuration in production environment");
    }
  }
};

// Initialize and validate configuration
validateConfig();

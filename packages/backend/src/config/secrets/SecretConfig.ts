/**
 * Secret Management Configuration
 *
 * Centralized configuration for secret management components
 * Supports environment-specific settings and configurable constants
 */

import { logger } from "../../lib/logger";

export interface SecretConfig {
  // Cache settings
  cache: {
    defaultTTL: number;
    redisEnabled: boolean;
    encryptionEnabled: boolean;
  };

  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
    successThreshold: number;
  };

  // Retry settings
  retry: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };

  // Provider settings
  providers: {
    aws: {
      region: string;
      maxRetries: number;
    };
    vault: {
      address: string;
      namespace: string;
      kubernetesRole?: string;
    };
  };

  // Validation settings
  validation: {
    criticalSecrets: string[];
    environmentOverrides: Record<string, string[]>;
  };

  // Volume watcher settings
  volumeWatcher: {
    mountPath: string;
    enabled: boolean;
    pollInterval: number;
    debounceMs: number;
    healthCheckInterval: number;
    maxRetries: number;
    gracefulRestartTimeout: number;
  };

  // Rotation settings
  rotation: {
    defaultPolicy: {
      enabled: boolean;
      intervalDays: number;
      gracePeriodHours: number;
      autoRotate: boolean;
    };
  };
}

/**
 * Load configuration from environment variables with defaults
 */
function loadSecretConfig(): SecretConfig {
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    cache: {
      defaultTTL: parseInt(process.env.SECRETS_CACHE_TTL || "300000", 10), // 5 minutes
      redisEnabled: process.env.REDIS_URL ? true : false,
      encryptionEnabled: process.env.SECRETS_CACHE_ENCRYPTION !== "false",
    },

    circuitBreaker: {
      failureThreshold: parseInt(
        process.env.SECRETS_CB_FAILURE_THRESHOLD || "5",
        10
      ),
      recoveryTimeout: parseInt(
        process.env.SECRETS_CB_RECOVERY_TIMEOUT || "60000",
        10
      ), // 1 minute
      monitoringPeriod: parseInt(
        process.env.SECRETS_CB_MONITORING_PERIOD || "300000",
        10
      ), // 5 minutes
      successThreshold: parseInt(
        process.env.SECRETS_CB_SUCCESS_THRESHOLD || "3",
        10
      ),
    },

    retry: {
      maxRetries: parseInt(process.env.SECRETS_MAX_RETRIES || "3", 10),
      baseDelay: parseInt(process.env.SECRETS_RETRY_BASE_DELAY || "1000", 10), // 1 second
      maxDelay: parseInt(process.env.SECRETS_RETRY_MAX_DELAY || "30000", 10), // 30 seconds
    },

    providers: {
      aws: {
        region: process.env.AWS_REGION || "us-east-1",
        maxRetries: parseInt(process.env.AWS_MAX_RETRIES || "3", 10),
      },
      vault: {
        address: process.env.VAULT_ADDR || "",
        namespace: process.env.VAULT_NAMESPACE || "valuecanvas",
        kubernetesRole: process.env.VAULT_K8S_ROLE,
      },
    },

    validation: {
      criticalSecrets: [
        "DATABASE_URL",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
        "VITE_SUPABASE_ANON_KEY",
        "JWT_SECRET",
        "ENCRYPTION_KEY",
      ],
      environmentOverrides: {
        development: [],
        staging: [],
        production: [],
      },
    },

    volumeWatcher: {
      mountPath: process.env.SECRETS_MOUNT_PATH || "/mnt/secrets",
      enabled: process.env.SECRETS_VOLUME_WATCH_ENABLED !== "false",
      pollInterval: parseInt(
        process.env.SECRETS_WATCH_POLL_INTERVAL || "5000",
        10
      ),
      debounceMs: parseInt(process.env.SECRETS_WATCH_DEBOUNCE_MS || "1000", 10),
      healthCheckInterval: parseInt(
        process.env.SECRETS_HEALTH_CHECK_INTERVAL || "30000",
        10
      ),
      maxRetries: parseInt(process.env.SECRETS_WATCH_MAX_RETRIES || "5", 10),
      gracefulRestartTimeout: parseInt(
        process.env.SECRETS_GRACEFUL_RESTART_TIMEOUT || "10000",
        10
      ),
    },

    rotation: {
      defaultPolicy: {
        enabled: process.env.SECRETS_ROTATION_ENABLED !== "false",
        intervalDays: parseInt(
          process.env.SECRETS_ROTATION_INTERVAL_DAYS || "90",
          10
        ),
        gracePeriodHours: parseInt(
          process.env.SECRETS_ROTATION_GRACE_PERIOD || "24",
          10
        ),
        autoRotate: process.env.SECRETS_AUTO_ROTATE !== "false",
      },
    },
  };
}

/**
 * Global configuration instance
 */
export const secretConfig = loadSecretConfig();

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(): Partial<SecretConfig> {
  const nodeEnv = process.env.NODE_ENV || "development";

  // Environment-specific overrides
  const envOverrides: Record<string, Partial<SecretConfig>> = {
    development: {
      cache: {
        ...secretConfig.cache,
        encryptionEnabled: false, // Disable encryption in dev for easier debugging
      },
      circuitBreaker: {
        ...secretConfig.circuitBreaker,
        failureThreshold: 10, // More lenient in development
      },
    },
    production: {
      cache: {
        ...secretConfig.cache,
        encryptionEnabled: true, // Always encrypt in production
      },
      circuitBreaker: {
        ...secretConfig.circuitBreaker,
        failureThreshold: 3, // Stricter in production
      },
    },
  };

  return envOverrides[nodeEnv] || {};
}

/**
 * Merge environment-specific config with base config
 */
export function getMergedConfig(): SecretConfig {
  const baseConfig = secretConfig;
  const envConfig = getEnvironmentConfig();

  // Deep merge logic
  return {
    ...baseConfig,
    ...envConfig,
    cache: { ...baseConfig.cache, ...envConfig.cache },
    circuitBreaker: {
      ...baseConfig.circuitBreaker,
      ...envConfig.circuitBreaker,
    },
    retry: { ...baseConfig.retry, ...envConfig.retry },
    providers: {
      aws: { ...baseConfig.providers.aws, ...envConfig.providers?.aws },
      vault: { ...baseConfig.providers.vault, ...envConfig.providers?.vault },
    },
    validation: { ...baseConfig.validation, ...envConfig.validation },
    volumeWatcher: { ...baseConfig.volumeWatcher, ...envConfig.volumeWatcher },
    rotation: {
      defaultPolicy: {
        ...baseConfig.rotation.defaultPolicy,
        ...envConfig.rotation?.defaultPolicy,
      },
    },
  };
}

// Export merged config as default
export const config = getMergedConfig();

// Log configuration on load
logger.info("Secret management configuration loaded", {
  environment: process.env.NODE_ENV,
  cacheEnabled: config.cache.redisEnabled,
  encryptionEnabled: config.cache.encryptionEnabled,
  circuitBreakerThreshold: config.circuitBreaker.failureThreshold,
});

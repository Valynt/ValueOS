/**
 * Environment Configuration
 * 
 * Centralized configuration management for the ValueCanvas application.
 * Reads from environment variables and provides type-safe access.
 * 
 * SEC-004: Uses secure logger to prevent config/secret leakage
 * Note: Cannot import logger here due to circular dependency
 */

/**
 * Application environment type
 */
export type AppEnvironment = 'development' | 'staging' | 'production' | 'test';

/**
 * Log level type
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  // Application
  app: {
    env: AppEnvironment;
    url: string;
    apiBaseUrl: string;
  };

  // Agent Fabric
  agents: {
    apiUrl: string;
    timeout: number;
    circuitBreaker: {
      enabled: boolean;
      threshold: number;
      cooldown: number;
    };
    logging: boolean;
    websocketUrl: string;
  };

  // Database
  database: {
    url: string;
    anonKey: string;
  };

  // Authentication
  auth: {
    sessionTimeout: number;
    mfaEnabled: boolean;
  };

  // Security
  security: {
    httpsOnly: boolean;
    corsOrigins: string[];
    rateLimitPerMinute: number;
    csrfEnabled: boolean;
    cspEnabled: boolean;
  };

  // Vault
  vault: {
    enabled: boolean;
    address?: string;
    namespace?: string;
  };

  // Monitoring
  monitoring: {
    sentry: {
      enabled: boolean;
      dsn?: string;
      environment: string;
      sampleRate: number;
    };
    datadog: {
      enabled: boolean;
    };
    prometheus: {
      enabled: boolean;
      port: number;
    };
  };

  // Feature Flags
  features: {
    sduiDebug: boolean;
    agentFabric: boolean;
    workflow: boolean;
    compliance: boolean;
    multiTenant: boolean;
    usageTracking: boolean;
    billing: boolean;
  };

  // Caching
  cache: {
    enabled: boolean;
    url?: string;
    ttl: number;
  };

  // Email
  email: {
    enabled: boolean;
    from?: string;
  };

  // Storage
  storage: {
    enabled: boolean;
    bucket?: string;
    region?: string;
  };

  // Development
  dev: {
    hmr: boolean;
    sourceMaps: boolean;
    reactDevTools: boolean;
    logLevel: LogLevel;
  };

  // Testing
  test: {
    mode: boolean;
    mockAgents: boolean;
  };
}

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, defaultValue: string = ''): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

/**
 * Standardized NODE_ENV detection with fallbacks
 * Priority: NODE_ENV > VITE_APP_ENV > development
 */
function getNodeEnvironment(): AppEnvironment {
  // First try NODE_ENV (standard)
  const nodeEnv = getEnv('NODE_ENV');
  if (nodeEnv && ['development', 'staging', 'production', 'test'].includes(nodeEnv)) {
    return nodeEnv as AppEnvironment;
  }
  
  // Fallback to VITE_APP_ENV (Vite-specific)
  const viteEnv = getEnv('VITE_APP_ENV');
  if (viteEnv && ['development', 'staging', 'production', 'test'].includes(viteEnv)) {
    return viteEnv as AppEnvironment;
  }
  
  // Default to development
  return 'development';
}

/**
 * Get boolean environment variable
 */
function getBoolEnv(key: string, defaultValue: boolean = false): boolean {
  const value = getEnv(key, String(defaultValue));
  return value === 'true' || value === '1';
}

/**
 * Get number environment variable
 */
function getNumberEnv(key: string, defaultValue: number = 0): number {
  const value = getEnv(key, String(defaultValue));
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get array environment variable (comma-separated)
 */
function getArrayEnv(key: string, defaultValue: string[] = []): string[] {
  const value = getEnv(key, '');
  if (!value) return defaultValue;
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const env = getNodeEnvironment();

  return {
    app: {
      env,
      url: getEnv('VITE_APP_URL', 'http://localhost:5173'),
      apiBaseUrl: getEnv('VITE_API_BASE_URL', 'http://localhost:3000'),
    },

    agents: {
      apiUrl: getEnv('VITE_AGENT_API_URL', 'http://localhost:8000/api/agents'),
      timeout: getNumberEnv('VITE_AGENT_API_TIMEOUT', 30000),
      circuitBreaker: {
        enabled: getBoolEnv('VITE_AGENT_CIRCUIT_BREAKER_ENABLED', true),
        threshold: getNumberEnv('VITE_AGENT_CIRCUIT_BREAKER_THRESHOLD', 5),
        cooldown: getNumberEnv('VITE_AGENT_CIRCUIT_BREAKER_COOLDOWN', 60000),
      },
      logging: getBoolEnv('VITE_AGENT_LOGGING_ENABLED', false),
      websocketUrl: getEnv('VITE_AGENT_WEBSOCKET_URL', 'ws://localhost:8000/ws/agents'),
    },

    database: {
      url: getEnv('VITE_SUPABASE_URL', ''),
      anonKey: getEnv('VITE_SUPABASE_ANON_KEY', ''),
    },

    auth: {
      sessionTimeout: getNumberEnv('VITE_SESSION_TIMEOUT', 1800000),
      mfaEnabled: getBoolEnv('VITE_MFA_ENABLED', false),
    },

    security: {
      httpsOnly: getBoolEnv('VITE_HTTPS_ONLY', env === 'production'),
      corsOrigins: getArrayEnv('CORS_ALLOWED_ORIGINS', [
        'http://localhost:5173',
        'http://localhost:3000',
      ]),
      rateLimitPerMinute: getNumberEnv('RATE_LIMIT_PER_MINUTE', 60),
      csrfEnabled: getBoolEnv('CSRF_PROTECTION_ENABLED', true),
      cspEnabled: getBoolEnv('CSP_ENABLED', true),
    },

    vault: {
      enabled: getBoolEnv('VAULT_ENABLED', false),
      address: getEnv('VAULT_ADDR', ''),
      namespace: getEnv('VAULT_NAMESPACE', 'valuecanvas'),
    },

    monitoring: {
      sentry: {
        enabled: getBoolEnv('VITE_SENTRY_ENABLED', false),
        dsn: getEnv('VITE_SENTRY_DSN', ''),
        environment: getEnv('VITE_SENTRY_ENVIRONMENT', env),
        sampleRate: parseFloat(getEnv('VITE_SENTRY_SAMPLE_RATE', '1.0')),
      },
      datadog: {
        enabled: getBoolEnv('DATADOG_ENABLED', false),
      },
      prometheus: {
        enabled: getBoolEnv('PROMETHEUS_ENABLED', false),
        port: getNumberEnv('PROMETHEUS_PORT', 9090),
      },
    },

    features: {
      sduiDebug: getBoolEnv('VITE_SDUI_DEBUG', env === 'development'),
      agentFabric: getBoolEnv('VITE_AGENT_FABRIC_ENABLED', true),
      workflow: getBoolEnv('VITE_WORKFLOW_ENABLED', true),
      compliance: getBoolEnv('VITE_COMPLIANCE_ENABLED', true),
      multiTenant: getBoolEnv('VITE_MULTI_TENANT_ENABLED', true),
      usageTracking: getBoolEnv('VITE_USAGE_TRACKING_ENABLED', false),
      billing: getBoolEnv('VITE_BILLING_ENABLED', false),
    },

    cache: {
      enabled: getBoolEnv('REDIS_ENABLED', false),
      url: getEnv('REDIS_URL', 'redis://localhost:6379'),
      ttl: getNumberEnv('CACHE_TTL', 3600),
    },

    email: {
      enabled: getBoolEnv('EMAIL_ENABLED', false),
      from: getEnv('EMAIL_FROM', 'noreply@valuecanvas.com'),
    },

    storage: {
      enabled: getBoolEnv('S3_ENABLED', false),
      bucket: getEnv('S3_BUCKET_NAME', ''),
      region: getEnv('S3_REGION', 'us-east-1'),
    },

    dev: {
      hmr: getBoolEnv('VITE_HMR_ENABLED', true),
      sourceMaps: getBoolEnv('VITE_SOURCE_MAPS', env !== 'production'),
      reactDevTools: getBoolEnv('VITE_REACT_DEVTOOLS', env === 'development'),
      logLevel: getEnv('LOG_LEVEL', env === 'production' ? 'warn' : 'info') as LogLevel,
    },

    test: {
      mode: getBoolEnv('TEST_MODE', false),
      mockAgents: getBoolEnv('VITE_MOCK_AGENTS', env === 'development'),
    },
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): string[] {
  const errors: string[] = [];

  // Production-specific validations
  if (config.app.env === 'production') {
    if (!config.database.url) {
      errors.push('VITE_SUPABASE_URL is required in production');
    }
    if (!config.database.anonKey) {
      errors.push('VITE_SUPABASE_ANON_KEY is required in production');
    }
    if (!config.agents.apiUrl || config.agents.apiUrl.includes('localhost')) {
      errors.push('VITE_AGENT_API_URL must be set to production URL');
    }
    if (config.security.httpsOnly && !config.app.url.startsWith('https://')) {
      errors.push('VITE_APP_URL must use HTTPS in production');
    }
  }

  // Agent Fabric validations
  if (config.features.agentFabric) {
    if (!config.agents.apiUrl) {
      errors.push('VITE_AGENT_API_URL is required when Agent Fabric is enabled');
    }
  }

  // Monitoring validations
  if (config.monitoring.sentry.enabled && !config.monitoring.sentry.dsn) {
    errors.push('VITE_SENTRY_DSN is required when Sentry is enabled');
  }

  // Vault validations
  if (config.vault.enabled && !config.vault.address) {
    errors.push('VAULT_ADDR is required when Vault is enabled');
  }

  return errors;
}

/**
 * Global configuration instance
 */
let configInstance: EnvironmentConfig | null = null;

/**
 * Get the current environment configuration
 * Loads and validates on first access
 */
export function getConfig(): EnvironmentConfig {
  if (!configInstance) {
    configInstance = loadEnvironmentConfig();

    // Validate configuration
    const errors = validateEnvironmentConfig(configInstance);
    if (errors.length > 0) {
      // Use console instead of logger to avoid circular dependency
      console.error('[Environment] Configuration errors:', errors.length);
      if (configInstance.app.env === 'production') {
        throw new Error(`Invalid environment configuration: ${errors.length} errors found`);
      }
    }

    // Log minimal configuration in development only
    if (configInstance.app.env === 'development') {
      console.info('[Environment] Configuration loaded:', {
        env: configInstance.app.env,
        featuresEnabled: Object.keys(configInstance.features).filter(
          k => configInstance?.features[k as keyof typeof configInstance.features]
        ).length,
        agentCircuitBreakerEnabled: configInstance.agents.circuitBreaker.enabled,
        // NEVER log: URLs, API keys, secrets, full config
      });
    }
  }

  // TypeScript null check - configInstance is guaranteed to be set above
  if (!configInstance) {
    throw new Error('Failed to initialize configuration');
  }

  return configInstance;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().app.env === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().app.env === 'development';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getConfig().test.mode;
}

/**
 * Get feature flag value
 */
export function isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
  return getConfig().features[feature];
}

/**
 * Export default configuration
 */
export default getConfig();

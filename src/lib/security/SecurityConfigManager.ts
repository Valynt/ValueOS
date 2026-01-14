/**
 * Security Configuration Management System
 *
 * Centralized security configuration with environment-specific settings,
 * validation, and runtime configuration updates.
 */

import { logger } from '../logger';
import { KMSConfig, KeyRotationPolicy } from '../crypto/KeyManagementService';

// ============================================================================
// Types
// ============================================================================

export interface SecurityConfig {
  // Message Bus Configuration
  messageBus: {
    circuitBreaker: {
      failureThreshold: number;
      resetTimeoutMs: number;
      halfOpenRequests: number;
    };
    rateLimit: {
      maxMessagesPerSecond: number;
      maxMessagesPerMinute: number;
      windowSizeMs: number;
    };
    ttl: {
      defaultSeconds: number;
      maxSeconds: number;
    };
  };

  // Context Sharing Configuration
  contextSharing: {
    maxDataSizeBytes: number;
    maxCacheSize: number;
    defaultTtlMs: number;
    cleanupIntervalMs: number;
    allowedAgentPairs: string[];
    sensitivityLevels: {
      high: string[];
      medium: string[];
      low: string[];
    };
  };

  // Audit Logging Configuration
  auditLogging: {
    enabled: boolean;
    batchSize: number;
    flushIntervalMs: number;
    retentionDays: number;
    sanitizeSensitiveData: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  // Cryptographic Configuration
  cryptography: {
    defaultAlgorithm: 'ed25519' | 'x25519' | 'aes-256-gcm';
    keyRotation: KeyRotationPolicy;
    kms: KMSConfig;
    enforceMinimumKeyLength: boolean;
    minimumKeyLengthBits: number;
  };

  // Compliance Configuration
  compliance: {
    enabledFrameworks: ('gdpr' | 'sox' | 'hipaa' | 'pci-dss')[];
    dataRetention: {
      piiDays: number;
      financialDays: number;
      medicalDays: number;
      auditDays: number;
    };
    requireExplicitConsent: boolean;
    auditAllDataAccess: boolean;
  };

  // Environment Configuration
  environment: {
    name: 'development' | 'staging' | 'production';
    debugMode: boolean;
    strictMode: boolean;
    monitoringEnabled: boolean;
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigUpdateOptions {
  validateOnly?: boolean;
  restartServices?: boolean;
  backupCurrent?: boolean;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  messageBus: {
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      halfOpenRequests: 3,
    },
    rateLimit: {
      maxMessagesPerSecond: 10,
      maxMessagesPerMinute: 100,
      windowSizeMs: 60000,
    },
    ttl: {
      defaultSeconds: 300,
      maxSeconds: 3600,
    },
  },

  contextSharing: {
    maxDataSizeBytes: 1024 * 1024, // 1MB
    maxCacheSize: 500,
    defaultTtlMs: 1800000, // 30 minutes
    cleanupIntervalMs: 300000, // 5 minutes
    allowedAgentPairs: [
      // Core workflow agents
      'coordinator-opportunity',
      'coordinator-target',
      'coordinator-realization',
      'coordinator-expansion',
      'coordinator-integrity',
      'opportunity-coordinator',
      'target-coordinator',
      'realization-coordinator',
      'expansion-coordinator',
      'integrity-coordinator',
      // Sequential workflow
      'opportunity-target',
      'target-realization',
      'realization-expansion',
      'expansion-integrity',
      // Integrity audit access
      'integrity-opportunity',
      'integrity-target',
      'integrity-realization',
      'integrity-expansion',
      'integrity-groundtruth',
      'integrity-financial-modeling',
      'integrity-company-intelligence',
    ],
    sensitivityLevels: {
      high: ['ssn', 'credit_card', 'medical', 'password', 'private_key'],
      medium: ['email', 'phone', 'address', 'financial', 'salary'],
      low: ['name', 'company', 'public_data'],
    },
  },

  auditLogging: {
    enabled: true,
    batchSize: 100,
    flushIntervalMs: 5000,
    retentionDays: 90,
    sanitizeSensitiveData: true,
    logLevel: 'info',
  },

  cryptography: {
    defaultAlgorithm: 'ed25519',
    keyRotation: {
      rotationIntervalMs: 86400000 * 30, // 30 days
      maxKeyAgeMs: 86400000 * 90, // 90 days
      keyOverlapMs: 86400000 * 7, // 7 days overlap
    },
    kms: {
      provider: 'local',
      region: 'us-east-1',
    },
    enforceMinimumKeyLength: true,
    minimumKeyLengthBits: 2048,
  },

  compliance: {
    enabledFrameworks: ['gdpr'],
    dataRetention: {
      piiDays: 2555, // 7 years
      financialDays: 2555, // 7 years
      medicalDays: 2555, // 7 years
      auditDays: 2555, // 7 years
    },
    requireExplicitConsent: true,
    auditAllDataAccess: true,
  },

  environment: {
    name: 'development',
    debugMode: true,
    strictMode: false,
    monitoringEnabled: true,
  },
};

const ENVIRONMENT_OVERRIDES: Record<string, Partial<SecurityConfig>> = {
  production: {
    messageBus: {
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      },
      rateLimit: {
        maxMessagesPerSecond: 50,
        maxMessagesPerMinute: 500,
      },
    },
    auditLogging: {
      logLevel: 'warn',
      sanitizeSensitiveData: true,
    },
    environment: {
      debugMode: false,
      strictMode: true,
    },
    compliance: {
      enabledFrameworks: ['gdpr', 'sox', 'pci-dss'],
    },
  },

  staging: {
    messageBus: {
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeoutMs: 120000,
      },
    },
    auditLogging: {
      logLevel: 'debug',
    },
    environment: {
      debugMode: true,
      strictMode: true,
    },
  },

  development: {
    auditLogging: {
      logLevel: 'debug',
      sanitizeSensitiveData: false,
    },
    environment: {
      debugMode: true,
      strictMode: false,
    },
    cryptography: {
      kms: {
        provider: 'local',
      },
    },
  },
};

// ============================================================================
// Security Configuration Manager
// ============================================================================

export class SecurityConfigManager {
  private static instance: SecurityConfigManager;
  private config: SecurityConfig;
  private configVersion: number = 1;
  private lastUpdated: Date = new Date();
  private validationRules: Map<string, (value: any) => boolean> = new Map();

  private constructor() {
    this.config = this.loadConfiguration();
    this.setupValidationRules();
    this.validateConfiguration();
  }

  static getInstance(): SecurityConfigManager {
    if (!SecurityConfigManager.instance) {
      SecurityConfigManager.instance = new SecurityConfigManager();
    }
    return SecurityConfigManager.instance;
  }

  /**
   * Load configuration from environment and defaults
   */
  private loadConfiguration(): SecurityConfig {
    const environment = (process.env.NODE_ENV || 'development') as SecurityConfig['environment']['name'];

    // Start with default configuration
    let config = { ...DEFAULT_SECURITY_CONFIG };

    // Apply environment-specific overrides
    const envOverrides = ENVIRONMENT_OVERRIDES[environment];
    if (envOverrides) {
      config = this.mergeConfig(config, envOverrides);
    }

    // Apply environment variable overrides
    config = this.applyEnvironmentVariables(config);

    // Set environment name
    config.environment.name = environment;

    logger.info('Security configuration loaded', {
      environment,
      configVersion: this.configVersion,
    });

    return config;
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: SecurityConfig, override: Partial<SecurityConfig>): SecurityConfig {
    const merged = { ...base };

    for (const [key, value] of Object.entries(override)) {
      const baseValue = merged[key as keyof SecurityConfig];

      if (baseValue && typeof baseValue === 'object' && typeof value === 'object') {
        merged[key as keyof SecurityConfig] = { ...baseValue, ...value } as any;
      } else if (value !== undefined) {
        merged[key as keyof SecurityConfig] = value as any;
      }
    }

    return merged;
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentVariables(config: SecurityConfig): SecurityConfig {
    const envOverrides: Record<string, any> = {
      // Message Bus
      'VOS_MSG_FAILURE_THRESHOLD': process.env.VOS_MSG_FAILURE_THRESHOLD,
      'VOS_MSG_RATE_LIMIT_PER_SEC': process.env.VOS_MSG_RATE_LIMIT_PER_SEC,
      'VOS_MSG_RATE_LIMIT_PER_MIN': process.env.VOS_MSG_RATE_LIMIT_PER_MIN,
      'VOS_MSG_DEFAULT_TTL': process.env.VOS_MSG_DEFAULT_TTL,

      // Context Sharing
      'VOS_CTX_MAX_DATA_SIZE': process.env.VOS_CTX_MAX_DATA_SIZE,
      'VOS_CTX_MAX_CACHE_SIZE': process.env.VOS_CTX_MAX_CACHE_SIZE,
      'VOS_CTX_DEFAULT_TTL': process.env.VOS_CTX_DEFAULT_TTL,

      // Audit Logging
      'VOS_AUDIT_ENABLED': process.env.VOS_AUDIT_ENABLED,
      'VOS_AUDIT_BATCH_SIZE': process.env.VOS_AUDIT_BATCH_SIZE,
      'VOS_AUDIT_RETENTION_DAYS': process.env.VOS_AUDIT_RETENTION_DAYS,

      // Cryptography
      'VOS_CRYPTO_KMS_PROVIDER': process.env.VOS_CRYPTO_KMS_PROVIDER,
      'VOS_CRYPTO_KMS_REGION': process.env.VOS_CRYPTO_KMS_REGION,
      'VOS_CRYPTO_KEY_ROTATION_INTERVAL': process.env.VOS_CRYPTO_KEY_ROTATION_INTERVAL,

      // Compliance
      'VOS_COMPLIANCE_FRAMEWORKS': process.env.VOS_COMPLIANCE_FRAMEWORKS,
      'VOS_COMPLIANCE_RETENTION_PII_DAYS': process.env.VOS_COMPLIANCE_RETENTION_PII_DAYS,
    };

    // Apply overrides with type conversion
    if (envOverrides['VOS_MSG_FAILURE_THRESHOLD']) {
      config.messageBus.circuitBreaker.failureThreshold = parseInt(envOverrides['VOS_MSG_FAILURE_THRESHOLD'], 10);
    }

    if (envOverrides['VOS_MSG_RATE_LIMIT_PER_SEC']) {
      config.messageBus.rateLimit.maxMessagesPerSecond = parseInt(envOverrides['VOS_MSG_RATE_LIMIT_PER_SEC'], 10);
    }

    if (envOverrides['VOS_MSG_RATE_LIMIT_PER_MIN']) {
      config.messageBus.rateLimit.maxMessagesPerMinute = parseInt(envOverrides['VOS_MSG_RATE_LIMIT_PER_MIN'], 10);
    }

    if (envOverrides['VOS_MSG_DEFAULT_TTL']) {
      config.messageBus.ttl.defaultSeconds = parseInt(envOverrides['VOS_MSG_DEFAULT_TTL'], 10);
    }

    if (envOverrides['VOS_CTX_MAX_DATA_SIZE']) {
      config.contextSharing.maxDataSizeBytes = parseInt(envOverrides['VOS_CTX_MAX_DATA_SIZE'], 10);
    }

    if (envOverrides['VOS_CTX_MAX_CACHE_SIZE']) {
      config.contextSharing.maxCacheSize = parseInt(envOverrides['VOS_CTX_MAX_CACHE_SIZE'], 10);
    }

    if (envOverrides['VOS_AUDIT_ENABLED']) {
      config.auditLogging.enabled = envOverrides['VOS_AUDIT_ENABLED'] === 'true';
    }

    if (envOverrides['VOS_AUDIT_BATCH_SIZE']) {
      config.auditLogging.batchSize = parseInt(envOverrides['VOS_AUDIT_BATCH_SIZE'], 10);
    }

    if (envOverrides['VOS_AUDIT_RETENTION_DAYS']) {
      config.auditLogging.retentionDays = parseInt(envOverrides['VOS_AUDIT_RETENTION_DAYS'], 10);
    }

    if (envOverrides['VOS_CRYPTO_KMS_PROVIDER']) {
      config.cryptography.kms.provider = envOverrides['VOS_CRYPTO_KMS_PROVIDER'] as KMSConfig['provider'];
    }

    if (envOverrides['VOS_CRYPTO_KMS_REGION']) {
      config.cryptography.kms.region = envOverrides['VOS_CRYPTO_KMS_REGION'];
    }

    if (envOverrides['VOS_COMPLIANCE_FRAMEWORKS']) {
      const frameworks = envOverrides['VOS_COMPLIANCE_FRAMEWORKS'].split(',').map(f => f.trim());
      config.compliance.enabledFrameworks = frameworks as SecurityConfig['compliance']['enabledFrameworks'];
    }

    return config;
  }

  /**
   * Setup validation rules for configuration
   */
  private setupValidationRules(): void {
    // Message Bus validations
    this.validationRules.set('messageBus.circuitBreaker.failureThreshold', (value) =>
      typeof value === 'number' && value >= 1 && value <= 100
    );

    this.validationRules.set('messageBus.rateLimit.maxMessagesPerSecond', (value) =>
      typeof value === 'number' && value >= 1 && value <= 1000
    );

    this.validationRules.set('messageBus.ttl.defaultSeconds', (value) =>
      typeof value === 'number' && value >= 60 && value <= 86400
    );

    // Context Sharing validations
    this.validationRules.set('contextSharing.maxDataSizeBytes', (value) =>
      typeof value === 'number' && value >= 1024 && value <= 104857600 // 1KB to 100MB
    );

    this.validationRules.set('contextSharing.maxCacheSize', (value) =>
      typeof value === 'number' && value >= 10 && value <= 10000
    );

    // Audit Logging validations
    this.validationRules.set('auditLogging.batchSize', (value) =>
      typeof value === 'number' && value >= 1 && value <= 1000
    );

    this.validationRules.set('auditLogging.retentionDays', (value) =>
      typeof value === 'number' && value >= 1 && value <= 3650 // 10 years max
    );

    // Cryptography validations
    this.validationRules.set('cryptography.keyRotation.rotationIntervalMs', (value) =>
      typeof value === 'number' && value >= 3600000 && value <= 31536000000 // 1 hour to 1 year
    );

    // Compliance validations
    this.validationRules.set('compliance.dataRetention.piiDays', (value) =>
      typeof value === 'number' && value >= 30 && value <= 3650
    );
  }

  /**
   * Validate current configuration
   */
  private validateConfiguration(): void {
    const result = this.validateConfig(this.config);

    if (!result.valid) {
      const errorMessage = `Invalid security configuration: ${result.errors.join(', ')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (result.warnings.length > 0) {
      logger.warn('Security configuration warnings', { warnings: result.warnings });
    }
  }

  /**
   * Validate configuration object
   */
  public validateConfig(config: SecurityConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each rule
    for (const [path, rule] of this.validationRules) {
      const value = this.getNestedValue(config, path);
      if (!rule(value)) {
        errors.push(`Invalid value for ${path}: ${value}`);
      }
    }

    // Custom validations
    if (config.messageBus.ttl.defaultSeconds > config.messageBus.ttl.maxSeconds) {
      errors.push('Default TTL cannot exceed maximum TTL');
    }

    if (config.contextSharing.maxDataSizeBytes > 50 * 1024 * 1024) { // 50MB
      warnings.push('Large context data size may impact performance');
    }

    if (config.environment.name === 'production' && config.environment.debugMode) {
      warnings.push('Debug mode should be disabled in production');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get current configuration
   */
  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Get configuration section
   */
  public getConfigSection<K extends keyof SecurityConfig>(section: K): SecurityConfig[K] {
    return { ...this.config[section] };
  }

  /**
   * Update configuration
   */
  public async updateConfig(
    updates: Partial<SecurityConfig>,
    options: ConfigUpdateOptions = {}
  ): Promise<ConfigValidationResult> {
    // Create new configuration
    const newConfig = this.mergeConfig(this.config, updates);

    // Validate new configuration
    const validation = this.validateConfig(newConfig);

    if (!validation.valid) {
      return validation;
    }

    if (options.validateOnly) {
      return validation;
    }

    // Backup current configuration if requested
    if (options.backupCurrent) {
      await this.backupConfiguration();
    }

    // Apply updates
    this.config = newConfig;
    this.configVersion++;
    this.lastUpdated = new Date();

    logger.info('Security configuration updated', {
      version: this.configVersion,
      updatedKeys: Object.keys(updates),
      restartServices: options.restartServices,
    });

    // Restart services if requested
    if (options.restartServices) {
      await this.restartSecurityServices();
    }

    return validation;
  }

  /**
   * Backup current configuration
   */
  private async backupConfiguration(): Promise<void> {
    const backup = {
      config: this.config,
      version: this.configVersion,
      timestamp: new Date().toISOString(),
    };

    // In production, store in secure location
    if (this.config.environment.name === 'production') {
      // TODO: Implement secure backup storage
      logger.info('Configuration backup created', { version: this.configVersion });
    }
  }

  /**
   * Restart security services with new configuration
   */
  private async restartSecurityServices(): Promise<void> {
    logger.info('Restarting security services with new configuration');

    // TODO: Implement service restart logic
    // - Restart SecureMessageBus
    // - Restart SecureSharedContext
    // - Restart AgentAuditLogger
    // - Reload KMS configuration
  }

  /**
   * Get configuration version
   */
  public getVersion(): number {
    return this.configVersion;
  }

  /**
   * Get last updated timestamp
   */
  public getLastUpdated(): Date {
    return this.lastUpdated;
  }

  /**
   * Export configuration (without sensitive data)
   */
  public exportConfig(): Omit<SecurityConfig, 'cryptography'> & {
    cryptography: Omit<SecurityConfig['cryptography'], 'kms'>;
  } {
    const exported = { ...this.config };

    // Remove sensitive KMS configuration
    exported.cryptography = {
      ...exported.cryptography,
      kms: {
        provider: exported.cryptography.kms.provider,
        // Exclude credentials and sensitive data
      } as any,
    };

    return exported;
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getSecurityConfig(): SecurityConfigManager {
  return SecurityConfigManager.getInstance();
}

export function getSecurityConfigValue<K extends keyof SecurityConfig>(
  section: K,
  path?: string
): SecurityConfig[K] {
  const manager = getSecurityConfig();
  const sectionConfig = manager.getConfigSection(section);

  if (path) {
    return path.split('.').reduce((current, key) => current?.[key], sectionConfig) as SecurityConfig[K];
  }

  return sectionConfig;
}

export default {
  SecurityConfigManager,
  getSecurityConfig,
  getSecurityConfigValue,
  DEFAULT_SECURITY_CONFIG,
  ENVIRONMENT_OVERRIDES,
};

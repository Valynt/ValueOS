/**
 * MCP Configuration Manager
 *
 * Provides centralized configuration management for all MCP servers
 * with environment-aware loading, validation, and hot-reloading.
 */

import { existsSync, readFileSync, unwatchFile, watchFile } from "fs";
import { join, resolve } from "path";

import { logger } from "../../lib/logger";

// ============================================================================
// Configuration Schema Types
// ============================================================================

export interface MCPBaseConfig {
  environment: "development" | "staging" | "production";
  debug: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  timeout: {
    default: number;
    external: number;
    database: number;
  };
  cache: {
    enabled: boolean;
    ttl: {
      tier1: number;
      tier2: number;
      tier3: number;
    };
    maxSize: number;
  };
}

export interface CRMProviderConfig {
  provider: "hubspot" | "salesforce" | "dynamics";
  enabled: boolean;
  apiEndpoint?: string;
  rateLimit: {
    requestsPerSecond: number;
    burstCapacity: number;
  };
  fieldMappings: Record<string, string>;
  customFields: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "date" | "currency";
    required: boolean;
    editable: boolean;
  }>;
  oauth: {
    scopes: string[];
    tokenRefreshThreshold: number; // seconds before expiry
  };
}

export interface MCPCRMServerConfig extends MCPBaseConfig {
  crm: {
    providers: CRMProviderConfig[];
    defaultProvider: "hubspot" | "salesforce";
    sync: {
      batchSize: number;
      retryAttempts: number;
      retryDelay: number;
    };
  };
}

export interface FinancialModuleConfig {
  name: string;
  tier: "tier1" | "tier2" | "tier3";
  enabled: boolean;
  apiEndpoint?: string;
  rateLimit: {
    requestsPerSecond: number;
    burstCapacity: number;
  };
  timeout: number;
  retryAttempts: number;
  cache: {
    enabled: boolean;
    ttl: number;
  };
}

export interface MCPFinancialServerConfig extends MCPBaseConfig {
  financial: {
    modules: {
      edgar: FinancialModuleConfig;
      xbrl: FinancialModuleConfig;
      marketData: FinancialModuleConfig;
      privateCompany: FinancialModuleConfig;
      industryBenchmark: FinancialModuleConfig;
    };
    truthLayer: {
      enableFallback: boolean;
      strictMode: boolean;
      maxResolutionTime: number;
      parallelQuery: boolean;
    };
  };
}

export interface MCPIntegratedServerConfig extends MCPBaseConfig {
  integrated: {
    structuralTruth: {
      enabled: boolean;
      kpiFormulasPath: string;
      dependencyGraphPath: string;
    };
    causalTruth: {
      enabled: boolean;
      simulationEngine: "monte_carlo" | "deterministic";
      maxIterations: number;
    };
    businessCase: {
      enabled: boolean;
      templatesPath: string;
      defaultCurrency: string;
    };
    auditTrail: {
      enabled: boolean;
      retentionDays: number;
      compressionEnabled: boolean;
    };
  };
}

export type MCPServerConfig =
  | MCPCRMServerConfig
  | MCPFinancialServerConfig
  | MCPIntegratedServerConfig;

// ============================================================================
// Configuration Validation
// ============================================================================

export class ConfigurationValidator {
  /**
   * Validate base MCP configuration
   */
  static validateBase(config: Record<string, unknown>): MCPBaseConfig {
    const errors: string[] = [];

    if (
      !config.environment ||
      !["development", "staging", "production"].includes(config.environment)
    ) {
      errors.push("Invalid environment. Must be: development, staging, production");
    }

    if (typeof config.debug !== "boolean") {
      errors.push("debug must be a boolean");
    }

    if (!config.logLevel || !["error", "warn", "info", "debug"].includes(config.logLevel)) {
      errors.push("Invalid logLevel. Must be: error, warn, info, debug");
    }

    if (!config.timeout || typeof config.timeout !== "object") {
      errors.push("timeout configuration is required");
    } else {
      if (typeof config.timeout.default !== "number" || config.timeout.default <= 0) {
        errors.push("timeout.default must be a positive number");
      }
      if (typeof config.timeout.external !== "number" || config.timeout.external <= 0) {
        errors.push("timeout.external must be a positive number");
      }
      if (typeof config.timeout.database !== "number" || config.timeout.database <= 0) {
        errors.push("timeout.database must be a positive number");
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
    }

    return config as MCPBaseConfig;
  }

  /**
   * Validate CRM configuration
   */
  static validateCRM(config: Record<string, unknown>): MCPCRMServerConfig {
    const baseConfig = this.validateBase(config);

    if (!config.crm) {
      throw new Error("CRM configuration is required");
    }

    if (!Array.isArray(config.crm.providers) || config.crm.providers.length === 0) {
      throw new Error("At least one CRM provider must be configured");
    }

    // Validate each provider
    (config.crm as { providers: Record<string, unknown>[] }).providers.forEach((provider, index: number) => {
      const providerErrors: string[] = [];

      if (!["hubspot", "salesforce", "dynamics"].includes(provider.provider)) {
        providerErrors.push(`Invalid provider at index ${index}`);
      }

      if (typeof provider.enabled !== "boolean") {
        providerErrors.push(`enabled must be boolean for provider at index ${index}`);
      }

      if (!provider.fieldMappings || typeof provider.fieldMappings !== "object") {
        providerErrors.push(`fieldMappings is required for provider at index ${index}`);
      }

      if (providerErrors.length > 0) {
        throw new Error(`Provider validation failed:\n${providerErrors.join("\n")}`);
      }
    });

    return config as MCPCRMServerConfig;
  }

  /**
   * Validate Financial server configuration
   */
  static validateFinancial(config: Record<string, unknown>): MCPFinancialServerConfig {
    const baseConfig = this.validateBase(config);

    if (!config.financial) {
      throw new Error("Financial configuration is required");
    }

    // Validate modules
    const requiredModules = ["edgar", "xbrl", "marketData", "privateCompany", "industryBenchmark"];
    requiredModules.forEach((module) => {
      if (!config.financial.modules[module]) {
        throw new Error(`${module} module configuration is required`);
      }
    });

    return config as MCPFinancialServerConfig;
  }
}

// ============================================================================
// Configuration Manager
// ============================================================================

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private configCache: Map<string, MCPServerConfig> = new Map();
  private fileWatchers: Map<string, boolean> = new Map();
  private configDir: string;

  private constructor(configDir?: string) {
    this.configDir = configDir || resolve(process.cwd(), "config");
  }

  static getInstance(configDir?: string): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager(configDir);
    }
    return ConfigurationManager.instance;
  }

  /**
   * Load configuration for a specific server type
   */
  async loadConfig<T extends MCPServerConfig>(
    serverType: "crm" | "financial" | "integrated",
    environment?: string
  ): Promise<T> {
    const cacheKey = `${serverType}-${environment || process.env.NODE_ENV || "development"}`;

    // Return cached config if available
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey) as T;
    }

    // Determine config file path
    const env = environment || process.env.NODE_ENV || "development";
    const configPath = this.getConfigPath(serverType, env);

    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
      // Load and parse configuration
      const rawConfig = this.loadConfigFile(configPath);

      // Validate configuration
      let validatedConfig: T;
      switch (serverType) {
        case "crm":
          validatedConfig = ConfigurationValidator.validateCRM(rawConfig) as T;
          break;
        case "financial":
          validatedConfig = ConfigurationValidator.validateFinancial(rawConfig) as T;
          break;
        case "integrated":
          validatedConfig = ConfigurationValidator.validateBase(rawConfig) as T;
          break;
        default:
          throw new Error(`Unknown server type: ${serverType}`);
      }

      // Cache the configuration
      this.configCache.set(cacheKey, validatedConfig);

      // Set up file watching for hot reload in development
      if (validatedConfig.debug && !this.fileWatchers.has(cacheKey)) {
        this.setupFileWatcher(configPath, cacheKey, serverType, env);
      }

      logger.info(`Configuration loaded successfully`, {
        serverType,
        environment: env,
        configPath,
      });

      return validatedConfig;
    } catch (error) {
      logger.error(`Failed to load configuration`, {
        serverType,
        environment: env,
        configPath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get configuration file path
   */
  private getConfigPath(serverType: string, environment: string): string {
    const filename = `${serverType}-${environment}.json`;
    return join(this.configDir, filename);
  }

  /**
   * Load configuration file
   */
  private loadConfigFile(configPath: string): Record<string, unknown> {
    try {
      const content = readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${configPath}`);
      }
      throw error;
    }
  }

  /**
   * Set up file watcher for hot reload
   */
  private setupFileWatcher(
    configPath: string,
    cacheKey: string,
    serverType: string,
    environment: string
  ): void {
    this.fileWatchers.set(cacheKey, true);

    watchFile(configPath, async () => {
      try {
        logger.info(`Configuration file changed, reloading...`, {
          serverType,
          environment,
          configPath,
        });

        // Clear cache
        this.configCache.delete(cacheKey);

        // Reload configuration
        await this.loadConfig(serverType as "crm" | "financial" | "integrated", environment);

        logger.info(`Configuration reloaded successfully`, {
          serverType,
          environment,
        });
      } catch (error) {
        logger.error(`Failed to reload configuration`, {
          serverType,
          environment,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  /**
   * Clear configuration cache
   */
  clearCache(serverType?: string, environment?: string): void {
    if (serverType && environment) {
      const cacheKey = `${serverType}-${environment}`;
      this.configCache.delete(cacheKey);
    } else {
      this.configCache.clear();
    }
  }

  /**
   * Get cached configuration
   */
  getCachedConfig<T extends MCPServerConfig>(
    serverType: string,
    environment?: string
  ): T | undefined {
    const env = environment || process.env.NODE_ENV || "development";
    const cacheKey = `${serverType}-${env}`;
    return this.configCache.get(cacheKey) as T;
  }

  /**
   * Validate configuration without loading
   */
  validateConfig(serverType: "crm" | "financial" | "integrated", config: Record<string, unknown>): boolean {
    try {
      switch (serverType) {
        case "crm":
          ConfigurationValidator.validateCRM(config);
          break;
        case "financial":
          ConfigurationValidator.validateFinancial(config);
          break;
        case "integrated":
          ConfigurationValidator.validateBase(config);
          break;
        default:
          return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup file watchers
   */
  cleanup(): void {
    for (const [cacheKey] of this.fileWatchers) {
      const [serverType = "", environment = ""] = cacheKey.split("-");
      const configPath = this.getConfigPath(serverType, environment);
      unwatchFile(configPath);
    }
    this.fileWatchers.clear();
  }
}

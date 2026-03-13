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
  static validateBase(config: unknown): MCPBaseConfig {
    const errors: string[] = [];

    if (
      !config ||
      typeof config !== "object" ||
      config === null
    ) {
      throw new Error("Invalid configuration object");
    }

    const configObj = config as Record<string, unknown>;

    if (
      !configObj.environment ||
      typeof configObj.environment !== "string" ||
      !["development", "staging", "production"].includes(configObj.environment)
    ) {
      errors.push("Invalid environment. Must be: development, staging, production");
    }

    if (typeof configObj.debug !== "boolean") {
      errors.push("debug must be a boolean");
    }

    if (
      !configObj.logLevel ||
      typeof configObj.logLevel !== "string" ||
      !["error", "warn", "info", "debug"].includes(configObj.logLevel)
    ) {
      errors.push("Invalid logLevel. Must be: error, warn, info, debug");
    }

    if (
      !configObj.timeout ||
      typeof configObj.timeout !== "object" ||
      configObj.timeout === null
    ) {
      errors.push("timeout configuration is required");
    } else {
      const timeout = configObj.timeout as Record<string, unknown>;

      if (typeof timeout.default !== "number" || timeout.default <= 0) {
        errors.push("timeout.default must be a positive number");
      }
      if (typeof timeout.external !== "number" || timeout.external <= 0) {
        errors.push("timeout.external must be a positive number");
      }
      if (typeof timeout.database !== "number" || timeout.database <= 0) {
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
  static validateCRM(config: unknown): MCPCRMServerConfig {
    const baseConfig = this.validateBase(config);

    const configObj = config as Record<string, unknown>;

    if (!configObj.crm || typeof configObj.crm !== "object" || configObj.crm === null) {
      throw new Error("CRM configuration is required");
    }

    const crm = configObj.crm as Record<string, unknown>;

    if (!Array.isArray(crm.providers) || crm.providers.length === 0) {
      throw new Error("At least one CRM provider must be configured");
    }

    // Validate each provider
    crm.providers.forEach((provider: unknown, index: number) => {
      const providerErrors: string[] = [];

      if (
        !provider ||
        typeof provider !== "object" ||
        provider === null
      ) {
        providerErrors.push(`Invalid provider object at index ${index}`);
      } else {
        const p = provider as Record<string, unknown>;

        if (!p.provider || typeof p.provider !== "string" || !["hubspot", "salesforce", "dynamics"].includes(p.provider)) {
          providerErrors.push(`Invalid provider at index ${index}`);
        }

        if (typeof p.enabled !== "boolean") {
          providerErrors.push(`enabled must be boolean for provider at index ${index}`);
        }

        if (!p.fieldMappings || typeof p.fieldMappings !== "object" || p.fieldMappings === null) {
          providerErrors.push(`fieldMappings is required for provider at index ${index}`);
        }
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
  static validateFinancial(config: unknown): MCPFinancialServerConfig {
    const baseConfig = this.validateBase(config);

    const configObj = config as Record<string, unknown>;

    if (!configObj.financial || typeof configObj.financial !== "object" || configObj.financial === null) {
      throw new Error("Financial configuration is required");
    }

    const financial = configObj.financial as Record<string, unknown>;

    // Validate modules
    const requiredModules = ["edgar", "xbrl", "marketData", "privateCompany", "industryBenchmark"];
    if (!financial.modules || typeof financial.modules !== "object" || financial.modules === null) {
      throw new Error("financial.modules configuration is required");
    }
    const modules = financial.modules as Record<string, unknown>;
    requiredModules.forEach((module) => {
      if (!modules[module]) {
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
    } catch (error: unknown) {
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
  private loadConfigFile(configPath: string): unknown {
    try {
      const content = readFileSync(configPath, "utf-8");
      return JSON.parse(content) as unknown;
    } catch (error: unknown) {
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
    serverType: "crm" | "financial" | "integrated",
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
        await this.loadConfig(serverType, environment);

        logger.info(`Configuration reloaded successfully`, {
          serverType,
          environment,
        });
      } catch (error: unknown) {
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
    return this.configCache.get(cacheKey) as T | undefined;
  }

  /**
   * Validate configuration without loading
   */
  validateConfig(serverType: "crm" | "financial" | "integrated", config: unknown): boolean {
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
      const [serverType, environment] = cacheKey.split("-");
      const configPath = this.getConfigPath(serverType, environment);
      unwatchFile(configPath);
    }
    this.fileWatchers.clear();
  }
}
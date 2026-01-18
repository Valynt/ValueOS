/**
 * CRM Configuration Manager
 *
 * Extends the base configuration manager with CRM-specific functionality
 * and provides easy access to provider configurations and field mappings.
 */

import { ConfigurationManager, MCPCRMServerConfig, CRMProviderConfig } from "../../mcp-common";
import { logger } from "@lib/logger";

export class CRMConfigManager {
  private static instance: CRMConfigManager;
  private baseConfigManager: ConfigurationManager;
  private config: MCPCRMServerConfig | null = null;

  private constructor() {
    this.baseConfigManager = ConfigurationManager.getInstance();
  }

  static getInstance(): CRMConfigManager {
    if (!CRMConfigManager.instance) {
      CRMConfigManager.instance = new CRMConfigManager();
    }
    return CRMConfigManager.instance;
  }

  /**
   * Load CRM configuration
   */
  async loadConfig(environment?: string): Promise<MCPCRMServerConfig> {
    try {
      this.config = await this.baseConfigManager.loadConfig<MCPCRMServerConfig>("crm", environment);
      logger.info("CRM configuration loaded successfully", {
        environment: environment || process.env.NODE_ENV || "development",
        providers: this.config.crm.providers.map((p) => p.provider).filter((p) => p.enabled),
      });
      return this.config;
    } catch (error) {
      logger.error("Failed to load CRM configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
        environment: environment || process.env.NODE_ENV || "development",
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MCPCRMServerConfig {
    if (!this.config) {
      throw new Error("CRM configuration not loaded. Call loadConfig() first.");
    }
    return this.config;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: "hubspot" | "salesforce" | "dynamics"): CRMProviderConfig | null {
    const config = this.getConfig();
    return config.crm.providers.find((p) => p.provider === provider && p.enabled) || null;
  }

  /**
   * Get default provider configuration
   */
  getDefaultProviderConfig(): CRMProviderConfig | null {
    const config = this.getConfig();
    const defaultProvider = config.crm.defaultProvider;
    return this.getProviderConfig(defaultProvider);
  }

  /**
   * Get field mappings for a provider
   */
  getFieldMappings(provider: "hubspot" | "salesforce" | "dynamics"): Record<string, string> {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found or not enabled`);
    }
    return providerConfig.fieldMappings;
  }

  /**
   * Get custom fields for a provider
   */
  getCustomFields(provider: "hubspot" | "salesforce" | "dynamics") {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found or not enabled`);
    }
    return providerConfig.customFields;
  }

  /**
   * Get rate limit configuration for a provider
   */
  getRateLimitConfig(provider: "hubspot" | "salesforce" | "dynamics") {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found or not enabled`);
    }
    return providerConfig.rateLimit;
  }

  /**
   * Get API endpoint for a provider
   */
  getApiEndpoint(provider: "hubspot" | "salesforce" | "dynamics"): string {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found or not enabled`);
    }
    return providerConfig.apiEndpoint || this.getDefaultApiEndpoint(provider);
  }

  /**
   * Get default API endpoint for a provider
   */
  private getDefaultApiEndpoint(provider: string): string {
    switch (provider) {
      case "hubspot":
        return "https://api.hubapi.com";
      case "salesforce":
        return "https://login.salesforce.com";
      case "dynamics":
        return "https://api.dynamics.com";
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Get OAuth scopes for a provider
   */
  getOAuthScopes(provider: "hubspot" | "salesforce" | "dynamics"): string[] {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found or not enabled`);
    }
    return providerConfig.oauth.scopes;
  }

  /**
   * Get token refresh threshold for a provider
   */
  getTokenRefreshThreshold(provider: "hubspot" | "salesforce" | "dynamics"): number {
    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found or not enabled`);
    }
    return providerConfig.oauth.tokenRefreshThreshold;
  }

  /**
   * Get sync configuration
   */
  getSyncConfig() {
    const config = this.getConfig();
    return config.crm.sync;
  }

  /**
   * Get cache configuration
   */
  getCacheConfig() {
    const config = this.getConfig();
    return config.cache;
  }

  /**
   * Get timeout configuration
   */
  getTimeoutConfig() {
    const config = this.getConfig();
    return config.timeout;
  }

  /**
   * Check if a provider is enabled
   */
  isProviderEnabled(provider: "hubspot" | "salesforce" | "dynamics"): boolean {
    const providerConfig = this.getProviderConfig(provider);
    return providerConfig !== null;
  }

  /**
   * Get all enabled providers
   */
  getEnabledProviders(): ("hubspot" | "salesforce" | "dynamics")[] {
    const config = this.getConfig();
    return config.crm.providers
      .filter((p) => p.enabled)
      .map((p) => p.provider as "hubspot" | "salesforce" | "dynamics");
  }

  /**
   * Validate field mapping exists
   */
  validateFieldMapping(provider: "hubspot" | "salesforce" | "dynamics", field: string): boolean {
    try {
      const mappings = this.getFieldMappings(provider);
      return field in mappings;
    } catch {
      return false;
    }
  }

  /**
   * Get mapped field name
   */
  getMappedFieldName(
    provider: "hubspot" | "salesforce" | "dynamics",
    field: string
  ): string | null {
    try {
      const mappings = this.getFieldMappings(provider);
      return mappings[field] || null;
    } catch {
      return null;
    }
  }

  /**
   * Reload configuration
   */
  async reloadConfig(environment?: string): Promise<MCPCRMServerConfig> {
    this.baseConfigManager.clearCache("crm", environment);
    return this.loadConfig(environment);
  }

  /**
   * Get configuration for environment variables
   */
  getEnvironmentConfig() {
    const config = this.getConfig();
    return {
      NODE_ENV: config.environment,
      DEBUG: config.debug,
      LOG_LEVEL: config.logLevel,
      CRM_DEFAULT_PROVIDER: config.crm.defaultProvider,
    };
  }
}

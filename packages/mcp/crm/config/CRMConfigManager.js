/**
 * CRM Configuration Manager
 *
 * Extends the base configuration manager with CRM-specific functionality
 * and provides easy access to provider configurations and field mappings.
 */
import { logger } from "../../lib/logger";
import { ConfigurationManager } from "../../mcp-common";
export class CRMConfigManager {
    static instance;
    baseConfigManager;
    config = null;
    constructor() {
        this.baseConfigManager = ConfigurationManager.getInstance();
    }
    static getInstance() {
        if (!CRMConfigManager.instance) {
            CRMConfigManager.instance = new CRMConfigManager();
        }
        return CRMConfigManager.instance;
    }
    /**
     * Load CRM configuration
     */
    async loadConfig(environment) {
        try {
            this.config = await this.baseConfigManager.loadConfig("crm", environment);
            logger.info("CRM configuration loaded successfully", {
                environment: environment || process.env.NODE_ENV || "development",
                providers: this.config.crm.providers.map((p) => p.provider).filter((p) => p.enabled),
            });
            return this.config;
        }
        catch (error) {
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
    getConfig() {
        if (!this.config) {
            throw new Error("CRM configuration not loaded. Call loadConfig() first.");
        }
        return this.config;
    }
    /**
     * Get provider configuration
     */
    getProviderConfig(provider) {
        const config = this.getConfig();
        return config.crm.providers.find((p) => p.provider === provider && p.enabled) || null;
    }
    /**
     * Get default provider configuration
     */
    getDefaultProviderConfig() {
        const config = this.getConfig();
        const defaultProvider = config.crm.defaultProvider;
        return this.getProviderConfig(defaultProvider);
    }
    /**
     * Get field mappings for a provider
     */
    getFieldMappings(provider) {
        const providerConfig = this.getProviderConfig(provider);
        if (!providerConfig) {
            throw new Error(`Provider ${provider} not found or not enabled`);
        }
        return providerConfig.fieldMappings;
    }
    /**
     * Get custom fields for a provider
     */
    getCustomFields(provider) {
        const providerConfig = this.getProviderConfig(provider);
        if (!providerConfig) {
            throw new Error(`Provider ${provider} not found or not enabled`);
        }
        return providerConfig.customFields;
    }
    /**
     * Get rate limit configuration for a provider
     */
    getRateLimitConfig(provider) {
        const providerConfig = this.getProviderConfig(provider);
        if (!providerConfig) {
            throw new Error(`Provider ${provider} not found or not enabled`);
        }
        return providerConfig.rateLimit;
    }
    /**
     * Get API endpoint for a provider
     */
    getApiEndpoint(provider) {
        const providerConfig = this.getProviderConfig(provider);
        if (!providerConfig) {
            throw new Error(`Provider ${provider} not found or not enabled`);
        }
        return providerConfig.apiEndpoint || this.getDefaultApiEndpoint(provider);
    }
    /**
     * Get default API endpoint for a provider
     */
    getDefaultApiEndpoint(provider) {
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
    getOAuthScopes(provider) {
        const providerConfig = this.getProviderConfig(provider);
        if (!providerConfig) {
            throw new Error(`Provider ${provider} not found or not enabled`);
        }
        return providerConfig.oauth.scopes;
    }
    /**
     * Get token refresh threshold for a provider
     */
    getTokenRefreshThreshold(provider) {
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
    isProviderEnabled(provider) {
        const providerConfig = this.getProviderConfig(provider);
        return providerConfig !== null;
    }
    /**
     * Get all enabled providers
     */
    getEnabledProviders() {
        const config = this.getConfig();
        return config.crm.providers
            .filter((p) => p.enabled)
            .map((p) => p.provider);
    }
    /**
     * Validate field mapping exists
     */
    validateFieldMapping(provider, field) {
        try {
            const mappings = this.getFieldMappings(provider);
            return field in mappings;
        }
        catch {
            return false;
        }
    }
    /**
     * Get mapped field name
     */
    getMappedFieldName(provider, field) {
        try {
            const mappings = this.getFieldMappings(provider);
            return mappings[field] || null;
        }
        catch {
            return null;
        }
    }
    /**
     * Reload configuration
     */
    async reloadConfig(environment) {
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
//# sourceMappingURL=CRMConfigManager.js.map
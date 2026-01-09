/**
 * Operational Settings Manager
 * 
 * Manages operational and performance settings including:
 * - Feature flags and toggles
 * - Rate limiting policies
 * - Observability configuration (tracing, logging, metrics)
 * - Cache management
 * - Webhook configuration
 */

import { ConfigurationManager } from '../ConfigurationManager';
import type {
  CacheManagementConfig,
  ConfigurationAccessLevel,
  ConfigurationScope,
  FeatureFlagsConfig,
  ObservabilityConfig,
  RateLimitingConfig,
  WebhooksConfig
} from '../types/settings-matrix';

export class OperationalSettingsManager {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  // ========================================================================
  // Feature Flags
  // ========================================================================

  async getFeatureFlags(
    scope: ConfigurationScope
  ): Promise<FeatureFlagsConfig> {
    return this.configManager.getConfiguration<FeatureFlagsConfig>(
      'feature_flags',
      scope
    );
  }

  async updateFeatureFlags(
    scope: ConfigurationScope,
    config: Partial<FeatureFlagsConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FeatureFlagsConfig> {
    const current = await this.getFeatureFlags(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'feature_flags',
      updated,
      scope,
      accessLevel
    );
  }

  async enableFeature(
    organizationId: string,
    featureName: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FeatureFlagsConfig> {
    const current = await this.getFeatureFlags({
      type: 'tenant',
      tenantId: organizationId
    });

    const enabledFeatures = {
      ...current.enabledFeatures,
      [featureName]: enable
    };

    return this.configManager.updateConfiguration(
      'feature_flags',
      { ...current, enabledFeatures },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableBetaFeature(
    organizationId: string,
    featureName: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FeatureFlagsConfig> {
    const current = await this.getFeatureFlags({
      type: 'tenant',
      tenantId: organizationId
    });

    const betaFeatures = {
      ...current.betaFeatures,
      [featureName]: enable
    };

    return this.configManager.updateConfiguration(
      'feature_flags',
      { ...current, betaFeatures },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setFeatureRollout(
    organizationId: string,
    featureName: string,
    percentage: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FeatureFlagsConfig> {
    const current = await this.getFeatureFlags({
      type: 'tenant',
      tenantId: organizationId
    });

    const rolloutPercentages = {
      ...current.rolloutPercentages,
      [featureName]: percentage
    };

    return this.configManager.updateConfiguration(
      'feature_flags',
      { ...current, rolloutPercentages },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setFeatureOverrides(
    organizationId: string,
    overrides: Record<string, Record<string, boolean>>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FeatureFlagsConfig> {
    const current = await this.getFeatureFlags({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'feature_flags',
      { ...current, userOverrides: overrides },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Rate Limiting
  // ========================================================================

  async getRateLimiting(
    scope: ConfigurationScope
  ): Promise<RateLimitingConfig> {
    return this.configManager.getConfiguration<RateLimitingConfig>(
      'rate_limiting',
      scope
    );
  }

  async updateRateLimiting(
    scope: ConfigurationScope,
    config: Partial<RateLimitingConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RateLimitingConfig> {
    const current = await this.getRateLimiting(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'rate_limiting',
      updated,
      scope,
      accessLevel
    );
  }

  async setRequestsPerMinute(
    organizationId: string,
    limit: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RateLimitingConfig> {
    const current = await this.getRateLimiting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rate_limiting',
      { ...current, requestsPerMinute: limit },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRequestsPerHour(
    organizationId: string,
    limit: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RateLimitingConfig> {
    const current = await this.getRateLimiting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rate_limiting',
      { ...current, requestsPerHour: limit },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRequestsPerDay(
    organizationId: string,
    limit: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RateLimitingConfig> {
    const current = await this.getRateLimiting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rate_limiting',
      { ...current, requestsPerDay: limit },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setBurstAllowance(
    organizationId: string,
    allowance: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RateLimitingConfig> {
    const current = await this.getRateLimiting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rate_limiting',
      { ...current, burstAllowance: allowance },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setEndpointLimits(
    organizationId: string,
    limits: Record<string, number>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RateLimitingConfig> {
    const current = await this.getRateLimiting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rate_limiting',
      { ...current, endpointLimits: limits },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setUserLimits(
    organizationId: string,
    limits: Record<string, number>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RateLimitingConfig> {
    const current = await this.getRateLimiting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rate_limiting',
      { ...current, perUserLimits: limits },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Observability
  // ========================================================================

  async getObservability(
    scope: ConfigurationScope
  ): Promise<ObservabilityConfig> {
    return this.configManager.getConfiguration<ObservabilityConfig>(
      'observability',
      scope
    );
  }

  async updateObservability(
    scope: ConfigurationScope,
    config: Partial<ObservabilityConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ObservabilityConfig> {
    const current = await this.getObservability(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'observability',
      updated,
      scope,
      accessLevel
    );
  }

  async setTraceSamplingRate(
    organizationId: string,
    rate: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ObservabilityConfig> {
    const current = await this.getObservability({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'observability',
      { ...current, traceSamplingRate: rate },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setLogVerbosity(
    organizationId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    accessLevel: ConfigurationAccessLevel
  ): Promise<ObservabilityConfig> {
    const current = await this.getObservability({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'observability',
      { ...current, logVerbosity: level },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableMetrics(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ObservabilityConfig> {
    const current = await this.getObservability({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'observability',
      { ...current, enableMetrics: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableTracing(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ObservabilityConfig> {
    const current = await this.getObservability({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'observability',
      { ...current, enableTracing: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setCustomMetrics(
    organizationId: string,
    metrics: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<ObservabilityConfig> {
    const current = await this.getObservability({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'observability',
      { ...current, customMetrics: metrics },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setErrorTracking(
    organizationId: string,
    config: { enabled: boolean; sampleRate?: number },
    accessLevel: ConfigurationAccessLevel
  ): Promise<ObservabilityConfig> {
    const current = await this.getObservability({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'observability',
      { ...current, errorTracking: config },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  async getCacheManagement(
    scope: ConfigurationScope
  ): Promise<CacheManagementConfig> {
    return this.configManager.getConfiguration<CacheManagementConfig>(
      'cache_management',
      scope
    );
  }

  async updateCacheManagement(
    scope: ConfigurationScope,
    config: Partial<CacheManagementConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<CacheManagementConfig> {
    const current = await this.getCacheManagement(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'cache_management',
      updated,
      scope,
      accessLevel
    );
  }

  async setCacheTTL(
    organizationId: string,
    ttlSeconds: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<CacheManagementConfig> {
    const current = await this.getCacheManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'cache_management',
      { ...current, cacheTTL: ttlSeconds },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableCache(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<CacheManagementConfig> {
    const current = await this.getCacheManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'cache_management',
      { ...current, enableCache: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setCacheStrategy(
    organizationId: string,
    strategy: 'lru' | 'lfu' | 'fifo',
    accessLevel: ConfigurationAccessLevel
  ): Promise<CacheManagementConfig> {
    const current = await this.getCacheManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'cache_management',
      { ...current, cacheStrategy: strategy },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setMaxCacheSize(
    organizationId: string,
    sizeMB: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<CacheManagementConfig> {
    const current = await this.getCacheManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'cache_management',
      { ...current, maxCacheSize: sizeMB },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setCacheableEndpoints(
    organizationId: string,
    endpoints: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<CacheManagementConfig> {
    const current = await this.getCacheManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'cache_management',
      { ...current, cacheableEndpoints: endpoints },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Webhooks
  // ========================================================================

  async getWebhooks(
    scope: ConfigurationScope
  ): Promise<WebhooksConfig | null> {
    return this.configManager.getConfiguration<WebhooksConfig>(
      'webhooks',
      scope
    );
  }

  async updateWebhooks(
    scope: ConfigurationScope,
    config: WebhooksConfig,
    accessLevel: ConfigurationAccessLevel
  ): Promise<WebhooksConfig> {
    return this.configManager.updateConfiguration(
      'webhooks',
      config,
      scope,
      accessLevel
    );
  }

  async addWebhook(
    organizationId: string,
    webhook: {
      url: string;
      events: string[];
      secret?: string;
      enabled?: boolean;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<WebhooksConfig> {
    const current = await this.getWebhooks({
      type: 'tenant',
      tenantId: organizationId
    });

    const endpoints = [...(current?.endpoints || []), webhook];

    const updated: WebhooksConfig = {
      ...current,
      endpoints,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'webhooks',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async removeWebhook(
    organizationId: string,
    webhookIndex: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<WebhooksConfig> {
    const current = await this.getWebhooks({
      type: 'tenant',
      tenantId: organizationId
    });

    const endpoints = (current?.endpoints || []).filter((_, i) => i !== webhookIndex);

    const updated: WebhooksConfig = {
      ...current,
      endpoints,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'webhooks',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableWebhook(
    organizationId: string,
    webhookIndex: number,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<WebhooksConfig> {
    const current = await this.getWebhooks({
      type: 'tenant',
      tenantId: organizationId
    });

    const endpoints = [...(current?.endpoints || [])];
    if (endpoints[webhookIndex]) {
      endpoints[webhookIndex] = {
        ...endpoints[webhookIndex],
        enabled: enable
      };
    }

    const updated: WebhooksConfig = {
      ...current,
      endpoints,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'webhooks',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRetryPolicy(
    organizationId: string,
    policy: {
      maxRetries: number;
      retryDelayMs: number;
      backoffMultiplier?: number;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<WebhooksConfig> {
    const current = await this.getWebhooks({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: WebhooksConfig = {
      ...current,
      retryPolicy: policy,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'webhooks',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  async getAllOperationalSettings(
    organizationId: string
  ): Promise<{
    featureFlags: FeatureFlagsConfig;
    rateLimiting: RateLimitingConfig;
    observability: ObservabilityConfig;
    cacheManagement: CacheManagementConfig;
    webhooks: WebhooksConfig | null;
  }> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    const [featureFlags, rateLimiting, observability, cacheManagement, webhooks] =
      await Promise.all([
        this.getFeatureFlags(scope),
        this.getRateLimiting(scope),
        this.getObservability(scope),
        this.getCacheManagement(scope),
        this.getWebhooks(scope)
      ]);

    return {
      featureFlags,
      rateLimiting,
      observability,
      cacheManagement,
      webhooks
    };
  }

  async clearCache(organizationId: string): Promise<void> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    await Promise.all([
      this.configManager.clearCache('feature_flags', scope),
      this.configManager.clearCache('rate_limiting', scope),
      this.configManager.clearCache('observability', scope),
      this.configManager.clearCache('cache_management', scope),
      this.configManager.clearCache('webhooks', scope)
    ]);
  }
}

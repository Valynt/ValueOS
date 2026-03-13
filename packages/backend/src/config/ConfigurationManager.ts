/**
 * Configuration Manager
 * 
 * Central service for managing organization configurations with:
 * - CRUD operations
 * - Access control enforcement
 * - Validation
 * - Caching
 * - Audit logging
 */

import { logger } from '../lib/logger.js'
import { deleteCache, getCache, setCache } from '../lib/redis';

import {
  hasConfigAccess,
  OrganizationConfiguration,
} from './settingsMatrix';

/**
 * Configuration update request
 */
export interface ConfigUpdateRequest {
  organizationId: string;
  userId: string;
  userRole: 'tenant_admin' | 'vendor_admin' | 'user';
  setting: string;
  value: unknown;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Configuration Manager
 */
export class ConfigurationManager {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'config:';

  /**
   * Get complete configuration for organization
   */
  async getConfiguration(
    organizationId: string,
    userRole: 'tenant_admin' | 'vendor_admin' | 'user'
  ): Promise<Partial<OrganizationConfiguration>> {
    // Try cache first
    const cacheKey = `${this.CACHE_PREFIX}${organizationId}`;
    const cached = await getCache<OrganizationConfiguration>(cacheKey);
    
    if (cached) {
      return this.filterByAccess(cached, userRole);
    }

    // Load from database
    const config = await this.loadFromDatabase(organizationId);
    
    if (config) {
      // Cache it
      await setCache(cacheKey, config, this.CACHE_TTL);
    }

    return this.filterByAccess(config, userRole);
  }

  /**
   * Get specific configuration setting
   */
  async getSetting<T>(
    organizationId: string,
    setting: string,
    userRole: 'tenant_admin' | 'vendor_admin' | 'user'
  ): Promise<T | null> {
    // Check access
    if (!hasConfigAccess(setting, userRole, 'view_only')) {
      logger.warn('Access denied to configuration setting', {
        organizationId,
        setting,
        userRole,
      });
      return null;
    }

    const config = await this.getConfiguration(organizationId, userRole);
    return (config as Record<string, unknown>)[setting] ?? null;
  }

  /**
   * Update configuration setting
   */
  async updateSetting(request: ConfigUpdateRequest): Promise<boolean> {
    const { organizationId, userId, userRole, setting, value } = request;

    // Check access
    if (!hasConfigAccess(setting, userRole, 'tenant_admin')) {
      logger.warn('Access denied to update configuration setting', {
        organizationId,
        setting,
        userRole,
      });
      throw new Error(`Access denied: ${setting}`);
    }

    // Validate value
    const validation = await this.validateSetting(setting, value);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Update in database
    await this.updateInDatabase(organizationId, setting, value);

    // Clear cache
    await this.clearCache(organizationId);

    // Audit log
    await this.logConfigChange(organizationId, userId, setting, value);

    logger.info('Configuration setting updated', {
      organizationId,
      setting,
      userRole,
    });

    return true;
  }

  /**
   * Bulk update configuration
   */
  async bulkUpdate(
    organizationId: string,
    userId: string,
    userRole: 'tenant_admin' | 'vendor_admin' | 'user',
    updates: Record<string, any>
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const [setting, value] of Object.entries(updates)) {
      try {
        await this.updateSetting({
          organizationId,
          userId,
          userRole,
          setting,
          value,
        });
      } catch (error) {
        errors.push(`${setting}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Initialize default configuration for new organization
   */
  async initializeDefaults(organizationId: string): Promise<void> {
    const defaultConfig: Partial<OrganizationConfiguration> = {
      tenantProvisioning: {
        organizationId,
        status: 'trial',
        maxUsers: 10,
        maxStorageGB: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      authPolicy: {
        organizationId,
        enforceMFA: false,
        enableWebAuthn: false,
        enablePasswordless: false,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
        },
      },
      llmSpendingLimits: {
        organizationId,
        dailyLimit: 100,
        dailySpend: 0,
        monthlyHardCap: 1000,
        monthlySoftCap: 800,
        perRequestLimit: 10,
        alertThreshold: 80,
        alertRecipients: [],
      },
      featureFlags: {
        organizationId,
        enabledFeatures: {},
        betaFeatures: {},
      },
      auditIntegrity: {
        organizationId,
        enableHashChaining: true,
        verificationFrequencyHours: 24,
      },
      tokenDashboard: {
        organizationId,
        enableRealTime: true,
        refreshIntervalSeconds: 30,
        showCostBreakdown: true,
      },
    };

    await this.saveToDatabase(organizationId, defaultConfig);

    logger.info('Default configuration initialized', { organizationId });
  }

  /**
   * Validate configuration setting
   */
  private async validateSetting(
    setting: string,
    value: unknown
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      switch (setting) {
        case 'llmSpendingLimits':
          if (value.dailyLimit <= 0) {
            errors.push('Daily limit must be positive');
          }
          if (value.dailySpend < 0) {
            errors.push('Daily spend cannot be negative');
          }
          if (value.monthlyHardCap <= 0) {
            errors.push('Monthly hard cap must be positive');
          }
          if (value.monthlySoftCap >= value.monthlyHardCap) {
            errors.push('Soft cap must be less than hard cap');
          }
          break;

        case 'authPolicy':
          if (value.passwordPolicy.minLength < 8) {
            errors.push('Minimum password length must be at least 8');
          }
          break;

        case 'sessionControl':
          if (value.timeoutMinutes <= 0) {
            errors.push('Timeout must be positive');
          }
          if (value.maxConcurrentSessions <= 0) {
            errors.push('Max concurrent sessions must be positive');
          }
          break;

        case 'rateLimiting':
          if (value.requestsPerMinute <= 0) {
            errors.push('Rate limit must be positive');
          }
          break;

        // Add more validation rules as needed
      }
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Filter configuration by user access level
   */
  private filterByAccess(
    config: Partial<OrganizationConfiguration> | null,
    userRole: 'tenant_admin' | 'vendor_admin' | 'user'
  ): Partial<OrganizationConfiguration> {
    if (!config) {
      return {};
    }

    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (hasConfigAccess(key, userRole, 'view_only')) {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Load configuration from database
   */
  private async loadFromDatabase(
    organizationId: string
  ): Promise<Partial<OrganizationConfiguration> | null> {
    try {
      const { supabase } = await import('../lib/supabase');

      const { data, error } = await supabase
        .from('organization_configurations')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error || !data) {
        return null;
      }

      // Parse JSONB columns
      return {
        tenantProvisioning: data.tenant_provisioning,
        customBranding: data.custom_branding,
        dataResidency: data.data_residency,
        domainManagement: data.domain_management,
        namespaceIsolation: data.namespace_isolation,
        authPolicy: data.auth_policy,
        ssoConfig: data.sso_config,
        sessionControl: data.session_control,
        ipWhitelist: data.ip_whitelist,
        llmSpendingLimits: data.llm_spending_limits,
        modelRouting: data.model_routing,
        agentToggles: data.agent_toggles,
        hitlThresholds: data.hitl_thresholds,
        groundTruthSync: data.ground_truth_sync,
        formulaVersioning: data.formula_versioning,
        featureFlags: data.feature_flags,
        rateLimiting: data.rate_limiting,
        observability: data.observability,
        cacheManagement: data.cache_management,
        webhooks: data.webhooks,
        auditIntegrity: data.audit_integrity,
        retentionPolicies: data.retention_policies,
        manifestoStrictness: data.manifesto_strictness,
        secretRotation: data.secret_rotation,
        rlsMonitoring: data.rls_monitoring,
        tokenDashboard: data.token_dashboard,
        valueMetering: data.value_metering,
        subscriptionPlan: data.subscription_plan,
        invoicing: data.invoicing,
      };
    } catch (error) {
      logger.error('Failed to load configuration from database', error instanceof Error ? error : undefined, {
        organizationId,
      });
      return null;
    }
  }

  /**
   * Update configuration in database
   */
  private async updateInDatabase(
    organizationId: string,
    setting: string,
    value: unknown
  ): Promise<void> {
    try {
      const { supabase } = await import('../lib/supabase');

      // Convert camelCase to snake_case for database column
      const columnName = setting.replace(/([A-Z])/g, '_$1').toLowerCase();

      const { error } = await supabase
        .from('organization_configurations')
        .update({
          [columnName]: value,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to update configuration in database', error instanceof Error ? error : undefined, {
        organizationId,
        setting,
      });
      throw error;
    }
  }

  /**
   * Save complete configuration to database
   */
  private async saveToDatabase(
    organizationId: string,
    config: Partial<OrganizationConfiguration>
  ): Promise<void> {
    try {
      const { supabase } = await import('../lib/supabase');

      const { error } = await supabase
        .from('organization_configurations')
        .upsert({
          organization_id: organizationId,
          tenant_provisioning: config.tenantProvisioning,
          custom_branding: config.customBranding,
          data_residency: config.dataResidency,
          domain_management: config.domainManagement,
          namespace_isolation: config.namespaceIsolation,
          auth_policy: config.authPolicy,
          sso_config: config.ssoConfig,
          session_control: config.sessionControl,
          ip_whitelist: config.ipWhitelist,
          llm_spending_limits: config.llmSpendingLimits,
          model_routing: config.modelRouting,
          agent_toggles: config.agentToggles,
          hitl_thresholds: config.hitlThresholds,
          ground_truth_sync: config.groundTruthSync,
          formula_versioning: config.formulaVersioning,
          feature_flags: config.featureFlags,
          rate_limiting: config.rateLimiting,
          observability: config.observability,
          cache_management: config.cacheManagement,
          webhooks: config.webhooks,
          audit_integrity: config.auditIntegrity,
          retention_policies: config.retentionPolicies,
          manifesto_strictness: config.manifestoStrictness,
          secret_rotation: config.secretRotation,
          rls_monitoring: config.rlsMonitoring,
          token_dashboard: config.tokenDashboard,
          value_metering: config.valueMetering,
          subscription_plan: config.subscriptionPlan,
          invoicing: config.invoicing,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to save configuration to database', error instanceof Error ? error : undefined, {
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Clear configuration cache
   */
  private async clearCache(organizationId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${organizationId}`;
    await deleteCache(cacheKey);
  }

  /**
   * Log configuration change to audit trail
   */
  private async logConfigChange(
    organizationId: string,
    userId: string,
    setting: string,
    value: unknown
  ): Promise<void> {
    try {
      const { supabase } = await import('../lib/supabase');

      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        user_id: userId,
        action: 'CONFIG_UPDATE',
        resource_type: 'configuration',
        resource_id: setting,
        changes: {
          setting,
          newValue: value,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to log configuration change', error instanceof Error ? error : undefined);
      // Don't throw - audit logging failure shouldn't block the update
    }
  }
}

/**
 * Singleton instance
 */
export const configurationManager = new ConfigurationManager();

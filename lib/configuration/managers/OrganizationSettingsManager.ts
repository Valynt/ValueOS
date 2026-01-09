/**
 * Organization Settings Manager
 * 
 * Manages multi-tenant organization settings including:
 * - Tenant provisioning and lifecycle
 * - Custom branding (SDUI themes)
 * - Data residency and geographic pinning
 * - Domain management
 * - Namespace isolation
 */

import { ConfigurationManager } from '../ConfigurationManager';
import type {
  ConfigurationAccessLevel,
  ConfigurationScope,
  CustomBrandingConfig,
  DataResidencyConfig,
  DomainManagementConfig,
  NamespaceIsolationConfig,
  TenantProvisioningConfig
} from '../types/settings-matrix';

export class OrganizationSettingsManager {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  // ========================================================================
  // Tenant Provisioning
  // ========================================================================

  async getTenantProvisioning(
    scope: ConfigurationScope
  ): Promise<TenantProvisioningConfig> {
    return this.configManager.getConfiguration<TenantProvisioningConfig>(
      'tenant_provisioning',
      scope
    );
  }

  async updateTenantProvisioning(
    scope: ConfigurationScope,
    config: Partial<TenantProvisioningConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<TenantProvisioningConfig> {
    const current = await this.getTenantProvisioning(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'tenant_provisioning',
      updated,
      scope,
      accessLevel
    );
  }

  async provisionTenant(
    organizationId: string,
    config: {
      maxUsers: number;
      maxStorageGB: number;
      enabledFeatures?: string[];
    }
  ): Promise<TenantProvisioningConfig> {
    const provisioning: TenantProvisioningConfig = {
      organizationId,
      status: 'trial',
      maxUsers: config.maxUsers,
      maxStorageGB: config.maxStorageGB,
      enabledFeatures: config.enabledFeatures || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'tenant_provisioning',
      provisioning,
      { type: 'tenant', tenantId: organizationId },
      'tenant_admin'
    );
  }

  async updateTenantStatus(
    organizationId: string,
    status: 'trial' | 'active' | 'suspended' | 'deprovisioned',
    accessLevel: ConfigurationAccessLevel
  ): Promise<TenantProvisioningConfig> {
    const current = await this.getTenantProvisioning({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'tenant_provisioning',
      { ...current, status, updatedAt: new Date().toISOString() },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async updateResourceLimits(
    organizationId: string,
    limits: {
      maxUsers?: number;
      maxStorageGB?: number;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<TenantProvisioningConfig> {
    const current = await this.getTenantProvisioning({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'tenant_provisioning',
      {
        ...current,
        ...limits,
        updatedAt: new Date().toISOString()
      },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Custom Branding
  // ========================================================================

  async getCustomBranding(
    scope: ConfigurationScope
  ): Promise<CustomBrandingConfig | null> {
    return this.configManager.getConfiguration<CustomBrandingConfig>(
      'custom_branding',
      scope
    );
  }

  async updateCustomBranding(
    scope: ConfigurationScope,
    config: CustomBrandingConfig,
    accessLevel: ConfigurationAccessLevel
  ): Promise<CustomBrandingConfig> {
    return this.configManager.updateConfiguration(
      'custom_branding',
      config,
      scope,
      accessLevel
    );
  }

  async updateLogo(
    organizationId: string,
    logoUrl: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<CustomBrandingConfig> {
    const current = await this.getCustomBranding({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: CustomBrandingConfig = {
      ...current,
      logoUrl,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'custom_branding',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async updateTheme(
    organizationId: string,
    theme: {
      primaryColor?: string;
      secondaryColor?: string;
      fontFamily?: string;
      customCSS?: string;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<CustomBrandingConfig> {
    const current = await this.getCustomBranding({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: CustomBrandingConfig = {
      ...current,
      ...theme,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'custom_branding',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Data Residency
  // ========================================================================

  async getDataResidency(
    scope: ConfigurationScope
  ): Promise<DataResidencyConfig> {
    return this.configManager.getConfiguration<DataResidencyConfig>(
      'data_residency',
      scope
    );
  }

  async updateDataResidency(
    scope: ConfigurationScope,
    config: Partial<DataResidencyConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<DataResidencyConfig> {
    const current = await this.getDataResidency(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'data_residency',
      updated,
      scope,
      accessLevel
    );
  }

  async setPrimaryRegion(
    organizationId: string,
    region: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<DataResidencyConfig> {
    const current = await this.getDataResidency({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'data_residency',
      { ...current, primaryRegion: region },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setBackupRegions(
    organizationId: string,
    regions: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<DataResidencyConfig> {
    const current = await this.getDataResidency({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'data_residency',
      { ...current, backupRegions: regions },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setComplianceRequirements(
    organizationId: string,
    requirements: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<DataResidencyConfig> {
    const current = await this.getDataResidency({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'data_residency',
      { ...current, complianceRequirements: requirements },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Domain Management
  // ========================================================================

  async getDomainManagement(
    scope: ConfigurationScope
  ): Promise<DomainManagementConfig | null> {
    return this.configManager.getConfiguration<DomainManagementConfig>(
      'domain_management',
      scope
    );
  }

  async updateDomainManagement(
    scope: ConfigurationScope,
    config: DomainManagementConfig,
    accessLevel: ConfigurationAccessLevel
  ): Promise<DomainManagementConfig> {
    return this.configManager.updateConfiguration(
      'domain_management',
      config,
      scope,
      accessLevel
    );
  }

  async addCustomDomain(
    organizationId: string,
    domain: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<DomainManagementConfig> {
    const current = await this.getDomainManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    const customDomains = current?.customDomains || [];
    if (!customDomains.includes(domain)) {
      customDomains.push(domain);
    }

    const updated: DomainManagementConfig = {
      ...current,
      customDomains,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'domain_management',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async removeCustomDomain(
    organizationId: string,
    domain: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<DomainManagementConfig> {
    const current = await this.getDomainManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    const customDomains = (current?.customDomains || []).filter(d => d !== domain);

    const updated: DomainManagementConfig = {
      ...current,
      customDomains,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'domain_management',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async verifyDomain(
    organizationId: string,
    domain: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<DomainManagementConfig> {
    const current = await this.getDomainManagement({
      type: 'tenant',
      tenantId: organizationId
    });

    const verifiedDomains = current?.verifiedDomains || [];
    if (!verifiedDomains.includes(domain)) {
      verifiedDomains.push(domain);
    }

    const updated: DomainManagementConfig = {
      ...current,
      verifiedDomains,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'domain_management',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Namespace Isolation
  // ========================================================================

  async getNamespaceIsolation(
    scope: ConfigurationScope
  ): Promise<NamespaceIsolationConfig | null> {
    return this.configManager.getConfiguration<NamespaceIsolationConfig>(
      'namespace_isolation',
      scope
    );
  }

  async updateNamespaceIsolation(
    scope: ConfigurationScope,
    config: NamespaceIsolationConfig,
    accessLevel: ConfigurationAccessLevel
  ): Promise<NamespaceIsolationConfig> {
    return this.configManager.updateConfiguration(
      'namespace_isolation',
      config,
      scope,
      accessLevel
    );
  }

  async setDatabaseSchema(
    organizationId: string,
    schema: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<NamespaceIsolationConfig> {
    const current = await this.getNamespaceIsolation({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: NamespaceIsolationConfig = {
      ...current,
      databaseSchema: schema,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'namespace_isolation',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setStorageBucket(
    organizationId: string,
    bucket: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<NamespaceIsolationConfig> {
    const current = await this.getNamespaceIsolation({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: NamespaceIsolationConfig = {
      ...current,
      storageBucket: bucket,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'namespace_isolation',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAPIPrefix(
    organizationId: string,
    prefix: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<NamespaceIsolationConfig> {
    const current = await this.getNamespaceIsolation({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: NamespaceIsolationConfig = {
      ...current,
      apiPrefix: prefix,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'namespace_isolation',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  async getAllOrganizationSettings(
    organizationId: string
  ): Promise<{
    tenantProvisioning: TenantProvisioningConfig;
    customBranding: CustomBrandingConfig | null;
    dataResidency: DataResidencyConfig;
    domainManagement: DomainManagementConfig | null;
    namespaceIsolation: NamespaceIsolationConfig | null;
  }> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    const [
      tenantProvisioning,
      customBranding,
      dataResidency,
      domainManagement,
      namespaceIsolation
    ] = await Promise.all([
      this.getTenantProvisioning(scope),
      this.getCustomBranding(scope),
      this.getDataResidency(scope),
      this.getDomainManagement(scope),
      this.getNamespaceIsolation(scope)
    ]);

    return {
      tenantProvisioning,
      customBranding,
      dataResidency,
      domainManagement,
      namespaceIsolation
    };
  }

  async clearCache(organizationId: string): Promise<void> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    await Promise.all([
      this.configManager.clearCache('tenant_provisioning', scope),
      this.configManager.clearCache('custom_branding', scope),
      this.configManager.clearCache('data_residency', scope),
      this.configManager.clearCache('domain_management', scope),
      this.configManager.clearCache('namespace_isolation', scope)
    ]);
  }
}

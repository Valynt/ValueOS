/**
 * Configuration Manager Tests
 * 
 * Tests for core configuration management functionality
 */

import { ConfigurationManager } from '../ConfigurationManager';
import type {
  ConfigurationAccessLevel,
  ConfigurationScope,
  TenantProvisioningConfig
} from '../types/settings-matrix';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  const testOrgId = 'test-org-123';
  const testScope: ConfigurationScope = {
    type: 'tenant',
    tenantId: testOrgId
  };

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  describe('Configuration CRUD', () => {
    it('should get default configuration', async () => {
      const config = await configManager.getConfiguration<TenantProvisioningConfig>(
        'tenant_provisioning',
        testScope
      );

      expect(config).toBeDefined();
      expect(config.status).toBe('trial');
      expect(config.maxUsers).toBe(10);
    });

    it('should update configuration', async () => {
      const newConfig: TenantProvisioningConfig = {
        organizationId: testOrgId,
        status: 'active',
        maxUsers: 50,
        maxStorageGB: 100,
        enabledFeatures: ['feature1', 'feature2'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updated = await configManager.updateConfiguration(
        'tenant_provisioning',
        newConfig,
        testScope,
        'tenant_admin'
      );

      expect(updated.status).toBe('active');
      expect(updated.maxUsers).toBe(50);
    });

    it('should validate configuration before update', async () => {
      const invalidConfig = {
        organizationId: testOrgId,
        status: 'invalid_status',
        maxUsers: -1
      };

      await expect(
        configManager.updateConfiguration(
          'tenant_provisioning',
          invalidConfig as any,
          testScope,
          'tenant_admin'
        )
      ).rejects.toThrow();
    });
  });

  describe('Access Control', () => {
    it('should allow tenant_admin to update tenant settings', async () => {
      const config: TenantProvisioningConfig = {
        organizationId: testOrgId,
        status: 'active',
        maxUsers: 25,
        maxStorageGB: 50,
        enabledFeatures: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updated = await configManager.updateConfiguration(
        'tenant_provisioning',
        config,
        testScope,
        'tenant_admin'
      );

      expect(updated.maxUsers).toBe(25);
    });

    it('should allow vendor_admin to update vendor settings', async () => {
      const vendorScope: ConfigurationScope = { type: 'vendor' };
      const config = {
        defaultModel: 'gpt-4',
        routingRules: [],
        enableAutoDowngrade: true
      };

      const updated = await configManager.updateConfiguration(
        'model_routing',
        config,
        vendorScope,
        'vendor_admin'
      );

      expect(updated.defaultModel).toBe('gpt-4');
    });

    it('should reject tenant_admin updating vendor-only settings', async () => {
      const vendorScope: ConfigurationScope = { type: 'vendor' };
      const config = {
        defaultModel: 'gpt-4',
        routingRules: [],
        enableAutoDowngrade: true
      };

      await expect(
        configManager.updateConfiguration(
          'model_routing',
          config,
          vendorScope,
          'tenant_admin'
        )
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('Caching', () => {
    it('should cache configuration after first fetch', async () => {
      const config1 = await configManager.getConfiguration(
        'tenant_provisioning',
        testScope
      );
      const config2 = await configManager.getConfiguration(
        'tenant_provisioning',
        testScope
      );

      expect(config1).toEqual(config2);
    });

    it('should invalidate cache after update', async () => {
      const config1 = await configManager.getConfiguration<TenantProvisioningConfig>(
        'tenant_provisioning',
        testScope
      );

      const newConfig: TenantProvisioningConfig = {
        ...config1,
        maxUsers: 100
      };

      await configManager.updateConfiguration(
        'tenant_provisioning',
        newConfig,
        testScope,
        'tenant_admin'
      );

      const config2 = await configManager.getConfiguration<TenantProvisioningConfig>(
        'tenant_provisioning',
        testScope
      );

      expect(config2.maxUsers).toBe(100);
    });

    it('should clear cache on demand', async () => {
      await configManager.getConfiguration('tenant_provisioning', testScope);
      await configManager.clearCache('tenant_provisioning', testScope);

      const config = await configManager.getConfiguration(
        'tenant_provisioning',
        testScope
      );

      expect(config).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const invalidConfig = {
        organizationId: testOrgId
        // Missing required fields
      };

      await expect(
        configManager.updateConfiguration(
          'tenant_provisioning',
          invalidConfig as any,
          testScope,
          'tenant_admin'
        )
      ).rejects.toThrow();
    });

    it('should validate field types', async () => {
      const invalidConfig = {
        organizationId: testOrgId,
        status: 'active',
        maxUsers: 'not-a-number',
        maxStorageGB: 100
      };

      await expect(
        configManager.updateConfiguration(
          'tenant_provisioning',
          invalidConfig as any,
          testScope,
          'tenant_admin'
        )
      ).rejects.toThrow();
    });

    it('should validate enum values', async () => {
      const invalidConfig: TenantProvisioningConfig = {
        organizationId: testOrgId,
        status: 'invalid_status' as any,
        maxUsers: 10,
        maxStorageGB: 10,
        enabledFeatures: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await expect(
        configManager.updateConfiguration(
          'tenant_provisioning',
          invalidConfig,
          testScope,
          'tenant_admin'
        )
      ).rejects.toThrow();
    });
  });

  describe('Scope Resolution', () => {
    it('should resolve tenant scope', async () => {
      const config = await configManager.getConfiguration(
        'tenant_provisioning',
        testScope
      );

      expect(config).toBeDefined();
    });

    it('should resolve vendor scope', async () => {
      const vendorScope: ConfigurationScope = { type: 'vendor' };
      const config = await configManager.getConfiguration(
        'model_routing',
        vendorScope
      );

      expect(config).toBeDefined();
    });

    it('should fall back to vendor defaults for tenant', async () => {
      const config = await configManager.getConfiguration(
        'model_routing',
        testScope
      );

      expect(config).toBeDefined();
      expect(config.defaultModel).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration type', async () => {
      await expect(
        configManager.getConfiguration('invalid_type' as any, testScope)
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      // Simulate database error by using invalid scope
      const invalidScope: ConfigurationScope = {
        type: 'tenant',
        tenantId: ''
      };

      await expect(
        configManager.getConfiguration('tenant_provisioning', invalidScope)
      ).rejects.toThrow();
    });

    it('should handle concurrent updates', async () => {
      const config1: TenantProvisioningConfig = {
        organizationId: testOrgId,
        status: 'active',
        maxUsers: 50,
        maxStorageGB: 100,
        enabledFeatures: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const config2: TenantProvisioningConfig = {
        organizationId: testOrgId,
        status: 'active',
        maxUsers: 75,
        maxStorageGB: 100,
        enabledFeatures: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await Promise.all([
        configManager.updateConfiguration(
          'tenant_provisioning',
          config1,
          testScope,
          'tenant_admin'
        ),
        configManager.updateConfiguration(
          'tenant_provisioning',
          config2,
          testScope,
          'tenant_admin'
        )
      ]);

      const final = await configManager.getConfiguration<TenantProvisioningConfig>(
        'tenant_provisioning',
        testScope
      );

      expect([50, 75]).toContain(final.maxUsers);
    });
  });
});

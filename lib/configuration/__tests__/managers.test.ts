/**
 * Configuration Managers Tests
 * 
 * Tests for specialized configuration managers
 */

import { ConfigurationManager } from '../ConfigurationManager';
import { OrganizationSettingsManager } from '../managers/OrganizationSettingsManager';
import { IAMConfigurationManager } from '../managers/IAMConfigurationManager';
import { AIOrchestrationManager } from '../managers/AIOrchestrationManager';
import { OperationalSettingsManager } from '../managers/OperationalSettingsManager';
import { SecurityGovernanceManager } from '../managers/SecurityGovernanceManager';
import { BillingUsageManager } from '../managers/BillingUsageManager';

describe('Configuration Managers', () => {
  let configManager: ConfigurationManager;
  const testOrgId = 'test-org-123';

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  describe('OrganizationSettingsManager', () => {
    let orgManager: OrganizationSettingsManager;

    beforeEach(() => {
      orgManager = new OrganizationSettingsManager(configManager);
    });

    it('should provision new tenant', async () => {
      const config = await orgManager.provisionTenant(testOrgId, {
        maxUsers: 50,
        maxStorageGB: 100,
        enabledFeatures: ['feature1']
      });

      expect(config.organizationId).toBe(testOrgId);
      expect(config.status).toBe('trial');
      expect(config.maxUsers).toBe(50);
    });

    it('should update tenant status', async () => {
      await orgManager.provisionTenant(testOrgId, {
        maxUsers: 50,
        maxStorageGB: 100
      });

      const updated = await orgManager.updateTenantStatus(
        testOrgId,
        'active',
        'tenant_admin'
      );

      expect(updated.status).toBe('active');
    });

    it('should update resource limits', async () => {
      await orgManager.provisionTenant(testOrgId, {
        maxUsers: 50,
        maxStorageGB: 100
      });

      const updated = await orgManager.updateResourceLimits(
        testOrgId,
        { maxUsers: 100 },
        'vendor_admin'
      );

      expect(updated.maxUsers).toBe(100);
    });

    it('should manage custom branding', async () => {
      const branding = await orgManager.updateLogo(
        testOrgId,
        'https://example.com/logo.png',
        'tenant_admin'
      );

      expect(branding.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should set data residency', async () => {
      const residency = await orgManager.setPrimaryRegion(
        testOrgId,
        'eu-west-1',
        'tenant_admin'
      );

      expect(residency.primaryRegion).toBe('eu-west-1');
    });
  });

  describe('IAMConfigurationManager', () => {
    let iamManager: IAMConfigurationManager;

    beforeEach(() => {
      iamManager = new IAMConfigurationManager(configManager);
    });

    it('should enable MFA', async () => {
      const config = await iamManager.enableMFA(testOrgId, true, 'tenant_admin');
      expect(config.enforceMFA).toBe(true);
    });

    it('should update password policy', async () => {
      const config = await iamManager.updatePasswordPolicy(
        testOrgId,
        {
          minLength: 12,
          requireSpecialChars: true
        },
        'tenant_admin'
      );

      expect(config.passwordPolicy.minLength).toBe(12);
      expect(config.passwordPolicy.requireSpecialChars).toBe(true);
    });

    it('should configure SSO', async () => {
      const config = await iamManager.configureSAML(
        testOrgId,
        {
          entityId: 'test-entity',
          ssoUrl: 'https://sso.example.com',
          certificate: 'cert-data'
        },
        'tenant_admin'
      );

      expect(config.provider).toBe('saml');
      expect(config.samlConfig?.entityId).toBe('test-entity');
    });

    it('should set session timeout', async () => {
      const config = await iamManager.setSessionTimeout(
        testOrgId,
        120,
        'tenant_admin'
      );

      expect(config.timeoutMinutes).toBe(120);
    });

    it('should manage IP whitelist', async () => {
      const config = await iamManager.addIPRange(
        testOrgId,
        '192.168.1.0/24',
        'Office network'
      );

      expect(config.allowedIPs).toContain('192.168.1.0/24');
    });
  });

  describe('AIOrchestrationManager', () => {
    let aiManager: AIOrchestrationManager;

    beforeEach(() => {
      aiManager = new AIOrchestrationManager(configManager);
    });

    it('should set LLM spending limits', async () => {
      const config = await aiManager.setMonthlyHardCap(
        testOrgId,
        5000,
        'tenant_admin'
      );

      expect(config.monthlyHardCap).toBe(5000);
    });

    it('should configure model routing', async () => {
      const config = await aiManager.setDefaultModel(
        testOrgId,
        'gpt-4',
        'tenant_admin'
      );

      expect(config.defaultModel).toBe('gpt-4');
    });

    it('should add routing rule', async () => {
      const config = await aiManager.addRoutingRule(
        testOrgId,
        {
          condition: 'cost < 0.01',
          targetModel: 'gpt-3.5-turbo',
          priority: 1
        },
        'tenant_admin'
      );

      expect(config.routingRules).toHaveLength(1);
    });

    it('should toggle agents', async () => {
      const config = await aiManager.enableAgent(
        testOrgId,
        'opportunityAgent',
        false,
        'tenant_admin'
      );

      expect(config.enabledAgents.opportunityAgent).toBe(false);
    });

    it('should set HITL thresholds', async () => {
      const config = await aiManager.setAutoApprovalThreshold(
        testOrgId,
        0.95,
        'tenant_admin'
      );

      expect(config.autoApprovalThreshold).toBe(0.95);
    });
  });

  describe('OperationalSettingsManager', () => {
    let opsManager: OperationalSettingsManager;

    beforeEach(() => {
      opsManager = new OperationalSettingsManager(configManager);
    });

    it('should enable feature flag', async () => {
      const config = await opsManager.enableFeature(
        testOrgId,
        'newDashboard',
        true,
        'tenant_admin'
      );

      expect(config.enabledFeatures.newDashboard).toBe(true);
    });

    it('should set rate limits', async () => {
      const config = await opsManager.setRequestsPerMinute(
        testOrgId,
        120,
        'tenant_admin'
      );

      expect(config.requestsPerMinute).toBe(120);
    });

    it('should configure observability', async () => {
      const config = await opsManager.setTraceSamplingRate(
        testOrgId,
        0.5,
        'tenant_admin'
      );

      expect(config.traceSamplingRate).toBe(0.5);
    });

    it('should manage cache settings', async () => {
      const config = await opsManager.setCacheTTL(testOrgId, 600, 'tenant_admin');
      expect(config.cacheTTL).toBe(600);
    });

    it('should add webhook', async () => {
      const config = await opsManager.addWebhook(
        testOrgId,
        {
          url: 'https://webhook.example.com',
          events: ['user.created', 'user.updated'],
          enabled: true
        },
        'tenant_admin'
      );

      expect(config.endpoints).toHaveLength(1);
    });
  });

  describe('SecurityGovernanceManager', () => {
    let securityManager: SecurityGovernanceManager;

    beforeEach(() => {
      securityManager = new SecurityGovernanceManager(configManager);
    });

    it('should enable hash chaining', async () => {
      const config = await securityManager.enableHashChaining(
        testOrgId,
        true,
        'vendor_admin'
      );

      expect(config.enableHashChaining).toBe(true);
    });

    it('should set retention policies', async () => {
      const config = await securityManager.setDataRetention(
        testOrgId,
        730,
        'tenant_admin'
      );

      expect(config.dataRetentionDays).toBe(730);
    });

    it('should configure manifesto strictness', async () => {
      const config = await securityManager.setMode(
        testOrgId,
        'blocking',
        'tenant_admin'
      );

      expect(config.mode).toBe('blocking');
    });

    it('should enable secret rotation', async () => {
      const config = await securityManager.enableAutoRotation(
        testOrgId,
        true,
        'vendor_admin'
      );

      expect(config.autoRotation).toBe(true);
    });

    it('should configure RLS monitoring', async () => {
      const config = await securityManager.setPerformanceThreshold(
        testOrgId,
        50,
        'vendor_admin'
      );

      expect(config.performanceThresholdMs).toBe(50);
    });
  });

  describe('BillingUsageManager', () => {
    let billingManager: BillingUsageManager;

    beforeEach(() => {
      billingManager = new BillingUsageManager(configManager);
    });

    it('should enable real-time dashboard', async () => {
      const config = await billingManager.enableRealTime(
        testOrgId,
        true,
        'tenant_admin'
      );

      expect(config.enableRealTime).toBe(true);
    });

    it('should enable value metering', async () => {
      const config = await billingManager.enableValueMetering(
        testOrgId,
        true,
        'tenant_admin'
      );

      expect(config.enabled).toBe(true);
    });

    it('should add billable milestone', async () => {
      const config = await billingManager.addBillableMilestone(
        testOrgId,
        {
          name: 'Deal Closed',
          price: 100,
          trigger: 'deal.status == closed'
        },
        'tenant_admin'
      );

      expect(config.billableMilestones).toHaveLength(1);
    });

    it('should set subscription tier', async () => {
      const config = await billingManager.setTier(
        testOrgId,
        'professional',
        'tenant_admin'
      );

      expect(config.tier).toBe('professional');
    });

    it('should configure invoicing', async () => {
      const config = await billingManager.setBillingEmail(
        testOrgId,
        'billing@example.com',
        'tenant_admin'
      );

      expect(config.billingEmail).toBe('billing@example.com');
    });
  });

  describe('Bulk Operations', () => {
    it('should fetch all organization settings', async () => {
      const orgManager = new OrganizationSettingsManager(configManager);
      const settings = await orgManager.getAllOrganizationSettings(testOrgId);

      expect(settings.tenantProvisioning).toBeDefined();
      expect(settings.dataResidency).toBeDefined();
    });

    it('should fetch all IAM settings', async () => {
      const iamManager = new IAMConfigurationManager(configManager);
      const settings = await iamManager.getAllIAMSettings(testOrgId);

      expect(settings.authPolicy).toBeDefined();
      expect(settings.sessionControl).toBeDefined();
    });

    it('should clear all caches', async () => {
      const orgManager = new OrganizationSettingsManager(configManager);
      await orgManager.clearCache(testOrgId);

      // Should not throw
      expect(true).toBe(true);
    });
  });
});

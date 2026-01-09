/**
 * Security & Governance Manager
 * 
 * Manages security, audit, and governance settings including:
 * - Audit integrity and hash chaining
 * - Data retention policies
 * - Manifesto strictness and compliance rules
 * - Secret rotation policies
 * - RLS monitoring and performance
 */

import { ConfigurationManager } from '../ConfigurationManager';
import type {
  AuditIntegrityConfig,
  ConfigurationAccessLevel,
  ConfigurationScope,
  ManifestoStrictnessConfig,
  RetentionPoliciesConfig,
  RLSMonitoringConfig,
  SecretRotationConfig
} from '../types/settings-matrix';

export class SecurityGovernanceManager {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  // ========================================================================
  // Audit Integrity
  // ========================================================================

  async getAuditIntegrity(
    scope: ConfigurationScope
  ): Promise<AuditIntegrityConfig> {
    return this.configManager.getConfiguration<AuditIntegrityConfig>(
      'audit_integrity',
      scope
    );
  }

  async updateAuditIntegrity(
    scope: ConfigurationScope,
    config: Partial<AuditIntegrityConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuditIntegrityConfig> {
    const current = await this.getAuditIntegrity(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'audit_integrity',
      updated,
      scope,
      accessLevel
    );
  }

  async enableHashChaining(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuditIntegrityConfig> {
    const current = await this.getAuditIntegrity({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'audit_integrity',
      { ...current, enableHashChaining: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setVerificationFrequency(
    organizationId: string,
    frequencyHours: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuditIntegrityConfig> {
    const current = await this.getAuditIntegrity({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'audit_integrity',
      { ...current, verificationFrequencyHours: frequencyHours },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setHashAlgorithm(
    organizationId: string,
    algorithm: 'sha256' | 'sha512',
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuditIntegrityConfig> {
    const current = await this.getAuditIntegrity({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'audit_integrity',
      { ...current, hashAlgorithm: algorithm },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableTamperDetection(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuditIntegrityConfig> {
    const current = await this.getAuditIntegrity({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'audit_integrity',
      { ...current, tamperDetection: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAlertRecipients(
    organizationId: string,
    recipients: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuditIntegrityConfig> {
    const current = await this.getAuditIntegrity({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'audit_integrity',
      { ...current, alertRecipients: recipients },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Retention Policies
  // ========================================================================

  async getRetentionPolicies(
    scope: ConfigurationScope
  ): Promise<RetentionPoliciesConfig> {
    return this.configManager.getConfiguration<RetentionPoliciesConfig>(
      'retention_policies',
      scope
    );
  }

  async updateRetentionPolicies(
    scope: ConfigurationScope,
    config: Partial<RetentionPoliciesConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RetentionPoliciesConfig> {
    const current = await this.getRetentionPolicies(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'retention_policies',
      updated,
      scope,
      accessLevel
    );
  }

  async setDataRetention(
    organizationId: string,
    days: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RetentionPoliciesConfig> {
    const current = await this.getRetentionPolicies({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'retention_policies',
      { ...current, dataRetentionDays: days },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setLogRetention(
    organizationId: string,
    days: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RetentionPoliciesConfig> {
    const current = await this.getRetentionPolicies({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'retention_policies',
      { ...current, logRetentionDays: days },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAuditRetention(
    organizationId: string,
    days: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RetentionPoliciesConfig> {
    const current = await this.getRetentionPolicies({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'retention_policies',
      { ...current, auditRetentionDays: days },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setFinancialRetention(
    organizationId: string,
    years: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RetentionPoliciesConfig> {
    const current = await this.getRetentionPolicies({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'retention_policies',
      { ...current, financialRetentionYears: years },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setBackupRetention(
    organizationId: string,
    days: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RetentionPoliciesConfig> {
    const current = await this.getRetentionPolicies({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'retention_policies',
      { ...current, backupRetentionDays: days },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setArchivalPolicy(
    organizationId: string,
    policy: {
      enabled: boolean;
      archiveAfterDays?: number;
      archiveLocation?: string;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<RetentionPoliciesConfig> {
    const current = await this.getRetentionPolicies({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'retention_policies',
      { ...current, archivalPolicy: policy },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Manifesto Strictness
  // ========================================================================

  async getManifestoStrictness(
    scope: ConfigurationScope
  ): Promise<ManifestoStrictnessConfig> {
    return this.configManager.getConfiguration<ManifestoStrictnessConfig>(
      'manifesto_strictness',
      scope
    );
  }

  async updateManifestoStrictness(
    scope: ConfigurationScope,
    config: Partial<ManifestoStrictnessConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ManifestoStrictnessConfig> {
    const current = await this.getManifestoStrictness(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'manifesto_strictness',
      updated,
      scope,
      accessLevel
    );
  }

  async setMode(
    organizationId: string,
    mode: 'off' | 'warning' | 'blocking',
    accessLevel: ConfigurationAccessLevel
  ): Promise<ManifestoStrictnessConfig> {
    const current = await this.getManifestoStrictness({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'manifesto_strictness',
      { ...current, mode },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableRule(
    organizationId: string,
    ruleName: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ManifestoStrictnessConfig> {
    const current = await this.getManifestoStrictness({
      type: 'tenant',
      tenantId: organizationId
    });

    const enabledRules = enable
      ? [...(current.enabledRules || []), ruleName]
      : (current.enabledRules || []).filter(r => r !== ruleName);

    return this.configManager.updateConfiguration(
      'manifesto_strictness',
      { ...current, enabledRules },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setCustomRules(
    organizationId: string,
    rules: Array<{ name: string; condition: string; severity: string }>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ManifestoStrictnessConfig> {
    const current = await this.getManifestoStrictness({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'manifesto_strictness',
      { ...current, customRules: rules },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setExemptions(
    organizationId: string,
    exemptions: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<ManifestoStrictnessConfig> {
    const current = await this.getManifestoStrictness({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'manifesto_strictness',
      { ...current, exemptions },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Secret Rotation
  // ========================================================================

  async getSecretRotation(
    scope: ConfigurationScope
  ): Promise<SecretRotationConfig> {
    return this.configManager.getConfiguration<SecretRotationConfig>(
      'secret_rotation',
      scope
    );
  }

  async updateSecretRotation(
    scope: ConfigurationScope,
    config: Partial<SecretRotationConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SecretRotationConfig> {
    const current = await this.getSecretRotation(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'secret_rotation',
      updated,
      scope,
      accessLevel
    );
  }

  async enableAutoRotation(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SecretRotationConfig> {
    const current = await this.getSecretRotation({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'secret_rotation',
      { ...current, autoRotation: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRotationFrequency(
    organizationId: string,
    days: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SecretRotationConfig> {
    const current = await this.getSecretRotation({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'secret_rotation',
      { ...current, rotationFrequencyDays: days },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRotationWindow(
    organizationId: string,
    window: { startHour: number; endHour: number },
    accessLevel: ConfigurationAccessLevel
  ): Promise<SecretRotationConfig> {
    const current = await this.getSecretRotation({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'secret_rotation',
      { ...current, rotationWindow: window },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setNotificationRecipients(
    organizationId: string,
    recipients: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<SecretRotationConfig> {
    const current = await this.getSecretRotation({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'secret_rotation',
      { ...current, notificationRecipients: recipients },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setExcludedSecrets(
    organizationId: string,
    secrets: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<SecretRotationConfig> {
    const current = await this.getSecretRotation({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'secret_rotation',
      { ...current, excludedSecrets: secrets },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // RLS Monitoring
  // ========================================================================

  async getRLSMonitoring(
    scope: ConfigurationScope
  ): Promise<RLSMonitoringConfig> {
    return this.configManager.getConfiguration<RLSMonitoringConfig>(
      'rls_monitoring',
      scope
    );
  }

  async updateRLSMonitoring(
    scope: ConfigurationScope,
    config: Partial<RLSMonitoringConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RLSMonitoringConfig> {
    const current = await this.getRLSMonitoring(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'rls_monitoring',
      updated,
      scope,
      accessLevel
    );
  }

  async enableRLSMonitoring(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RLSMonitoringConfig> {
    const current = await this.getRLSMonitoring({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rls_monitoring',
      { ...current, enabled: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableViolationAlerts(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RLSMonitoringConfig> {
    const current = await this.getRLSMonitoring({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rls_monitoring',
      { ...current, alertOnViolations: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setPerformanceThreshold(
    organizationId: string,
    thresholdMs: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<RLSMonitoringConfig> {
    const current = await this.getRLSMonitoring({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rls_monitoring',
      { ...current, performanceThresholdMs: thresholdMs },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setMonitoredTables(
    organizationId: string,
    tables: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<RLSMonitoringConfig> {
    const current = await this.getRLSMonitoring({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rls_monitoring',
      { ...current, monitoredTables: tables },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setViolationHandling(
    organizationId: string,
    handling: 'log' | 'alert' | 'block',
    accessLevel: ConfigurationAccessLevel
  ): Promise<RLSMonitoringConfig> {
    const current = await this.getRLSMonitoring({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'rls_monitoring',
      { ...current, violationHandling: handling },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  async getAllSecuritySettings(
    organizationId: string
  ): Promise<{
    auditIntegrity: AuditIntegrityConfig;
    retentionPolicies: RetentionPoliciesConfig;
    manifestoStrictness: ManifestoStrictnessConfig;
    secretRotation: SecretRotationConfig;
    rlsMonitoring: RLSMonitoringConfig;
  }> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    const [
      auditIntegrity,
      retentionPolicies,
      manifestoStrictness,
      secretRotation,
      rlsMonitoring
    ] = await Promise.all([
      this.getAuditIntegrity(scope),
      this.getRetentionPolicies(scope),
      this.getManifestoStrictness(scope),
      this.getSecretRotation(scope),
      this.getRLSMonitoring(scope)
    ]);

    return {
      auditIntegrity,
      retentionPolicies,
      manifestoStrictness,
      secretRotation,
      rlsMonitoring
    };
  }

  async clearCache(organizationId: string): Promise<void> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    await Promise.all([
      this.configManager.clearCache('audit_integrity', scope),
      this.configManager.clearCache('retention_policies', scope),
      this.configManager.clearCache('manifesto_strictness', scope),
      this.configManager.clearCache('secret_rotation', scope),
      this.configManager.clearCache('rls_monitoring', scope)
    ]);
  }
}

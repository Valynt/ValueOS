/**
 * IAM Configuration Manager
 * 
 * Manages Identity & Access Management settings including:
 * - Authentication policies (MFA, WebAuthn, passwordless)
 * - SSO configuration (SAML, OIDC)
 * - Session control and timeout policies
 * - IP whitelisting and access restrictions
 */

import { ConfigurationManager } from '../ConfigurationManager';
import type {
  AuthPolicyConfig,
  ConfigurationAccessLevel,
  ConfigurationScope,
  IPWhitelistConfig,
  SessionControlConfig,
  SSOConfig
} from '../types/settings-matrix';

export class IAMConfigurationManager {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  // ========================================================================
  // Authentication Policy
  // ========================================================================

  async getAuthPolicy(
    scope: ConfigurationScope
  ): Promise<AuthPolicyConfig> {
    return this.configManager.getConfiguration<AuthPolicyConfig>(
      'auth_policy',
      scope
    );
  }

  async updateAuthPolicy(
    scope: ConfigurationScope,
    config: Partial<AuthPolicyConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuthPolicyConfig> {
    const current = await this.getAuthPolicy(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'auth_policy',
      updated,
      scope,
      accessLevel
    );
  }

  async enableMFA(
    organizationId: string,
    enforce: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuthPolicyConfig> {
    const current = await this.getAuthPolicy({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'auth_policy',
      { ...current, enforceMFA: enforce },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableWebAuthn(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuthPolicyConfig> {
    const current = await this.getAuthPolicy({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'auth_policy',
      { ...current, enableWebAuthn: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enablePasswordless(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuthPolicyConfig> {
    const current = await this.getAuthPolicy({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'auth_policy',
      { ...current, enablePasswordless: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async updatePasswordPolicy(
    organizationId: string,
    policy: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
      maxAge?: number;
      preventReuse?: number;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuthPolicyConfig> {
    const current = await this.getAuthPolicy({
      type: 'tenant',
      tenantId: organizationId
    });

    const updatedPasswordPolicy = {
      ...current.passwordPolicy,
      ...policy
    };

    return this.configManager.updateConfiguration(
      'auth_policy',
      { ...current, passwordPolicy: updatedPasswordPolicy },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAllowedAuthMethods(
    organizationId: string,
    methods: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<AuthPolicyConfig> {
    const current = await this.getAuthPolicy({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'auth_policy',
      { ...current, allowedAuthMethods: methods },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // SSO Configuration
  // ========================================================================

  async getSSOConfig(
    scope: ConfigurationScope
  ): Promise<SSOConfig | null> {
    return this.configManager.getConfiguration<SSOConfig>(
      'sso_config',
      scope
    );
  }

  async updateSSOConfig(
    scope: ConfigurationScope,
    config: SSOConfig,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SSOConfig> {
    return this.configManager.updateConfiguration(
      'sso_config',
      config,
      scope,
      accessLevel
    );
  }

  async enableSSO(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SSOConfig> {
    const current = await this.getSSOConfig({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: SSOConfig = {
      ...current,
      enabled: enable,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'sso_config',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async configureSAML(
    organizationId: string,
    samlConfig: {
      entityId: string;
      ssoUrl: string;
      certificate: string;
      signRequests?: boolean;
      encryptAssertions?: boolean;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<SSOConfig> {
    const current = await this.getSSOConfig({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: SSOConfig = {
      ...current,
      provider: 'saml',
      samlConfig,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'sso_config',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async configureOIDC(
    organizationId: string,
    oidcConfig: {
      issuer: string;
      clientId: string;
      clientSecret: string;
      scopes?: string[];
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<SSOConfig> {
    const current = await this.getSSOConfig({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: SSOConfig = {
      ...current,
      provider: 'oidc',
      oidcConfig,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'sso_config',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setDefaultRole(
    organizationId: string,
    role: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SSOConfig> {
    const current = await this.getSSOConfig({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: SSOConfig = {
      ...current,
      defaultRole: role,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'sso_config',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAttributeMapping(
    organizationId: string,
    mapping: Record<string, string>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SSOConfig> {
    const current = await this.getSSOConfig({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: SSOConfig = {
      ...current,
      attributeMapping: mapping,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'sso_config',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Session Control
  // ========================================================================

  async getSessionControl(
    scope: ConfigurationScope
  ): Promise<SessionControlConfig> {
    return this.configManager.getConfiguration<SessionControlConfig>(
      'session_control',
      scope
    );
  }

  async updateSessionControl(
    scope: ConfigurationScope,
    config: Partial<SessionControlConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SessionControlConfig> {
    const current = await this.getSessionControl(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'session_control',
      updated,
      scope,
      accessLevel
    );
  }

  async setSessionTimeout(
    organizationId: string,
    timeoutMinutes: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SessionControlConfig> {
    const current = await this.getSessionControl({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'session_control',
      { ...current, timeoutMinutes },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setIdleTimeout(
    organizationId: string,
    idleTimeoutMinutes: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SessionControlConfig> {
    const current = await this.getSessionControl({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'session_control',
      { ...current, idleTimeoutMinutes },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setMaxConcurrentSessions(
    organizationId: string,
    maxSessions: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SessionControlConfig> {
    const current = await this.getSessionControl({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'session_control',
      { ...current, maxConcurrentSessions: maxSessions },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableRememberMe(
    organizationId: string,
    enable: boolean,
    durationDays?: number,
    accessLevel?: ConfigurationAccessLevel
  ): Promise<SessionControlConfig> {
    const current = await this.getSessionControl({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'session_control',
      {
        ...current,
        rememberMe: enable,
        rememberMeDuration: durationDays
      },
      { type: 'tenant', tenantId: organizationId },
      accessLevel || 'tenant_admin'
    );
  }

  async setSessionRefreshInterval(
    organizationId: string,
    intervalMinutes: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<SessionControlConfig> {
    const current = await this.getSessionControl({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'session_control',
      { ...current, refreshInterval: intervalMinutes },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // IP Whitelist
  // ========================================================================

  async getIPWhitelist(
    scope: ConfigurationScope
  ): Promise<IPWhitelistConfig | null> {
    return this.configManager.getConfiguration<IPWhitelistConfig>(
      'ip_whitelist',
      scope
    );
  }

  async updateIPWhitelist(
    scope: ConfigurationScope,
    config: IPWhitelistConfig,
    accessLevel: ConfigurationAccessLevel
  ): Promise<IPWhitelistConfig> {
    return this.configManager.updateConfiguration(
      'ip_whitelist',
      config,
      scope,
      accessLevel
    );
  }

  async enableIPWhitelist(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<IPWhitelistConfig> {
    const current = await this.getIPWhitelist({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: IPWhitelistConfig = {
      ...current,
      enabled: enable,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ip_whitelist',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async addIPRange(
    organizationId: string,
    ipRange: string,
    description?: string,
    accessLevel?: ConfigurationAccessLevel
  ): Promise<IPWhitelistConfig> {
    const current = await this.getIPWhitelist({
      type: 'tenant',
      tenantId: organizationId
    });

    const allowedIPs = current?.allowedIPs || [];
    if (!allowedIPs.includes(ipRange)) {
      allowedIPs.push(ipRange);
    }

    const updated: IPWhitelistConfig = {
      ...current,
      allowedIPs,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ip_whitelist',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel || 'tenant_admin'
    );
  }

  async removeIPRange(
    organizationId: string,
    ipRange: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<IPWhitelistConfig> {
    const current = await this.getIPWhitelist({
      type: 'tenant',
      tenantId: organizationId
    });

    const allowedIPs = (current?.allowedIPs || []).filter(ip => ip !== ipRange);

    const updated: IPWhitelistConfig = {
      ...current,
      allowedIPs,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ip_whitelist',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setBypassRoles(
    organizationId: string,
    roles: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<IPWhitelistConfig> {
    const current = await this.getIPWhitelist({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: IPWhitelistConfig = {
      ...current,
      bypassRoles: roles,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ip_whitelist',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setEnforceForAPI(
    organizationId: string,
    enforce: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<IPWhitelistConfig> {
    const current = await this.getIPWhitelist({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: IPWhitelistConfig = {
      ...current,
      enforceForAPI: enforce,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ip_whitelist',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  async getAllIAMSettings(
    organizationId: string
  ): Promise<{
    authPolicy: AuthPolicyConfig;
    ssoConfig: SSOConfig | null;
    sessionControl: SessionControlConfig;
    ipWhitelist: IPWhitelistConfig | null;
  }> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    const [authPolicy, ssoConfig, sessionControl, ipWhitelist] = await Promise.all([
      this.getAuthPolicy(scope),
      this.getSSOConfig(scope),
      this.getSessionControl(scope),
      this.getIPWhitelist(scope)
    ]);

    return {
      authPolicy,
      ssoConfig,
      sessionControl,
      ipWhitelist
    };
  }

  async clearCache(organizationId: string): Promise<void> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    await Promise.all([
      this.configManager.clearCache('auth_policy', scope),
      this.configManager.clearCache('sso_config', scope),
      this.configManager.clearCache('session_control', scope),
      this.configManager.clearCache('ip_whitelist', scope)
    ]);
  }
}

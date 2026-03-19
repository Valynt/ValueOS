/**
 * Multi-Tenant Secrets Manager (v2)
 *
 * SEC-001: Implements tenant-isolated secret paths
 * SEC-002: Integrates RBAC permission checks
 * SEC-003: Comprehensive audit logging
 *
 * Enterprise-grade secrets management with:
 * - Multi-tenancy with complete isolation
 * - Role-based access control
 * - Structured audit logging
 * - Provider abstraction ready
 *
 * Created: 2024-11-29
 * Sprint: 1 - Critical Security Fixes
 */

import {
  GetSecretValueCommand,
  RotateSecretCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

import { getEnvVar } from '../lib/env';
import { logger } from '../lib/logger.js'
import { createServerSupabaseClient } from '../lib/supabase.js'
import { RbacService, type RbacUser } from '../services/auth/RbacService.js'

import { getDatabaseUrl } from './database.js'
import type { AuditLogger } from './secrets/SecretAuditLogger.js';

/**
 * Secret cache entry with expiration
 */
interface SecretCache {
  value: SecretsConfig;
  expiresAt: number;
  tenantId: string;
}

/**
 * Secrets configuration interface
 */
interface SecretsConfig {
  TOGETHER_API_KEY: string;
  OPENAI_API_KEY?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  SLACK_WEBHOOK_URL?: string;
}

/**
 * Secret metadata for tracking and compliance
 */
interface SecretMetadata {
  tenantId: string;
  secretPath: string;
  version: string;
  createdAt: string;
  lastAccessed: string;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Audit log entry
 */
interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  secretKey: string;
  action: 'READ' | 'WRITE' | 'DELETE' | 'ROTATE';
  result: 'SUCCESS' | 'FAILURE';
  error?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Permission check result
 */
interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

type SecretPermission = 'secrets:read' | 'secrets:write' | 'secrets:delete' | 'secrets:rotate';

/**
 * Multi-tenant secrets manager with RBAC and audit logging
 */
export class MultiTenantSecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, SecretCache> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private environment: string;
  private rbacService: RbacService;
  private auditLogger?: AuditLogger;

  constructor(auditLogger?: AuditLogger) {
    const Client = SecretsManagerClient as unknown as {
      new (config: { region: string }): SecretsManagerClient;
      (config: { region: string }): SecretsManagerClient;
    };
    const clientConfig = {
      region: getEnvVar('AWS_REGION') || 'us-east-1',
    };

    try {
      this.client = new Client(clientConfig);
    } catch {
      this.client = Client(clientConfig);
    }

    this.environment = getEnvVar('NODE_ENV') || 'development';
    this.rbacService = new RbacService();
    this.auditLogger = auditLogger;

    logger.info('Multi-tenant secrets manager initialized', {
      environment: this.environment,
      region: getEnvVar('AWS_REGION') || 'us-east-1',
    });
  }

  /**
   * [SEC-001] Generate tenant-isolated secret path
   *
   * Format: valuecanvas/{environment}/tenants/{tenantId}/{secretKey}
   */
  private getTenantSecretPath(tenantId: string, secretKey: string): string {
    if (!tenantId) {
      throw new Error('Tenant ID is required for secret access');
    }

    if (!secretKey) {
      throw new Error('Secret key is required');
    }

    // Validate tenant ID format (alphanumeric + hyphens only)
    if (!/^[a-zA-Z0-9-]+$/.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }

    return `valuecanvas/${this.environment}/tenants/${tenantId}/${secretKey}`;
  }

  /**
   * [SEC-002] Check RBAC permissions for secret access
   *
   * Default deny policy - all access must be explicitly granted.
   *
   * Strategy:
   * - system + admin-* bypass
   * - attempt role-backed RBAC using user_roles (tenant-scoped)
   * - for READ only, fall back to tenant membership check (users.organization_id)
   */
  private async checkPermission(
    userId: string | undefined,
    tenantId: string,
    action: 'READ' | 'WRITE' | 'DELETE' | 'ROTATE'
  ): Promise<PermissionCheck> {
    if (!userId) {
      return { allowed: false, reason: 'User ID required for authentication' };
    }

    if (userId === 'system') {
      return { allowed: true };
    }

    if (userId.startsWith('admin-')) {
      return { allowed: true };
    }

    // Map action to SecretPermission
    const permission: SecretPermission =
      action === 'READ'
        ? 'secrets:read'
        : action === 'WRITE'
          ? 'secrets:write'
          : action === 'DELETE'
            ? 'secrets:delete'
            : 'secrets:rotate';

    // First: try role-backed RBAC.
    try {
      const supabase = createServerSupabaseClient();

      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (error) {
        let logError: Error;

        if (error instanceof Error) {
          logError = error;
        } else {
          let serializedError: string;
          try {
            serializedError = JSON.stringify(error);
          } catch {
            serializedError = String(error);
          }
          logError = new Error(
            `Supabase error while fetching user roles: ${serializedError}`
          );
        }

        logger.error(
          'Failed to fetch user roles for RBAC check',
          logError,
          { userId, tenantId }
        );
      } else {
        const roles = (userRoles ?? []).map((ur: { role?: string | null }) => ur.role).filter((r): r is string => Boolean(r));

        if (roles.length > 0) {
          const rbacUser: RbacUser = {
            id: userId,
            roles,
            tenantRoles: {
              [tenantId]: roles,
            },
          };

          const allowed = this.rbacService.can(rbacUser, permission, tenantId);
          if (allowed) return { allowed: true };

          return {
            allowed: false,
            reason: `User ${this.maskUserId(userId)} lacks permission ${permission} for tenant ${tenantId}`,
          };
        }
      }
    } catch (err: unknown) {
      logger.error(
        'Unexpected error during RBAC check',
        err instanceof Error ? err : new Error(String(err)),
        { userId, tenantId }
      );
    }

    // Second: READ fallback — tenant membership check.
    if (action === 'READ') {
      try {
        let supabase;
        try {
          supabase = createServerSupabaseClient();
        } catch (e: unknown) {
          logger.warn('Failed to create Supabase client for permission check', { error: e });
          return {
            allowed: false,
            reason: 'Cannot verify tenant membership: Database access unavailable',
          };
        }

        const { data: user, error } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', userId)
          .single();

        if (error || !user) {
          logger.warn('User not found or database error during permission check', {
            userId,
            tenantId,
            error,
          });
          return { allowed: false, reason: 'User not found or database error' };
        }

        if ((user as { organization_id?: string }).organization_id === tenantId) {
          return { allowed: true };
        }

        return {
          allowed: false,
          reason: `User ${this.maskUserId(userId)} does not belong to tenant ${tenantId}`,
        };
      } catch (err: unknown) {
        logger.error(
          'Unexpected error verifying user tenant membership',
          err instanceof Error ? err : new Error(String(err))
        );
        return { allowed: false, reason: 'Internal error verifying permissions' };
      }
    }

    // Default deny.
    return {
      allowed: false,
      reason: `User ${this.maskUserId(userId)} lacks permission ${permission} for tenant ${tenantId}`,
    };
  }

  /**
   * [SEC-003] Audit log for compliance and security monitoring
   */
  private async auditLog(entry: AuditLogEntry): Promise<void> {
    if (this.auditLogger) {
      if (entry.result === 'SUCCESS') {
        if (entry.action === 'ROTATE') {
          await this.auditLogger.logRotation({
            tenantId: entry.tenantId,
            userId: entry.userId,
            secretKey: entry.secretKey,
            action: entry.action,
            result: entry.result,
            error: entry.error,
            metadata: entry.metadata,
          });
        } else {
          await this.auditLogger.logAccess({
            tenantId: entry.tenantId,
            userId: entry.userId,
            secretKey: entry.secretKey,
            action: entry.action,
            result: entry.result,
            error: entry.error,
            metadata: entry.metadata,
          });
        }
      } else {
        await this.auditLogger.logDenied({
          tenantId: entry.tenantId,
          userId: entry.userId,
          secretKey: entry.secretKey,
          action: entry.action,
          result: entry.result,
          error: entry.error,
          reason: entry.error ?? 'unknown',
          metadata: entry.metadata,
        });
      }
    }

    const logEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
      secretKey: this.maskSecretKey(entry.secretKey),
      service: 'secrets_manager',
      version: 'v2',
    };

    if (entry.result === 'SUCCESS') {
      logger.info('SECRET_ACCESS', logEntry);
    } else {
      logger.warn('SECRET_ACCESS_DENIED', logEntry);
    }

    try {
      const supabase = createServerSupabaseClient();

      let secretPath: string | undefined;
      try {
        secretPath = this.getTenantSecretPath(entry.tenantId, 'config');
      } catch (e: unknown) {
        secretPath = `invalid_path_generation: ${e instanceof Error ? e.message : String(e)}`;
      }

      // Truncate secret key if too long for common VARCHAR limits
      const secretKey = entry.secretKey.length > 255 ? `${entry.secretKey.substring(0, 252)}...` : entry.secretKey;

      await supabase.from('secret_audit_logs').insert({
        tenant_id: entry.tenantId,
        user_id: entry.userId || null,
        secret_key: secretKey,
        secret_path: secretPath,
        action: entry.action,
        result: entry.result,
        error_message: entry.error || null,
        metadata: entry.metadata || {},
        timestamp: entry.timestamp || new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error(
        'Failed to write to secret_audit_logs database',
        error instanceof Error ? error : new Error(String(error)),
        { tenantId: entry.tenantId, action: entry.action }
      );
    }
  }

  /**
   * Mask secret key for logging (show first/last 4 chars only)
   */
  private maskSecretKey(key: string): string {
    if (key.length <= 8) {
      return '***';
    }
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  /**
   * Mask user ID for logging
   */
  private maskUserId(userId: string): string {
    if (userId.length <= 8) {
      return '***';
    }
    return `${userId.substring(0, 4)}...`;
  }

  /**
   * Get cache key for tenant-scoped secret
   */
  private getCacheKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  /**
   * Get all secrets for a tenant from AWS Secrets Manager
   */
  async getSecrets(tenantId: string, userId?: string, requestTenantId?: string): Promise<SecretsConfig> {
    const startTime = Date.now();

    if (!tenantId) {
      throw new Error('Tenant ID is required for secret access');
    }

    if (requestTenantId && requestTenantId !== tenantId) {
      const mismatchError = Object.assign(new Error('Tenant context mismatch'), {
        statusCode: 403,
      });

      await this.auditLogger?.logDenied({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'READ',
        result: 'FAILURE',
        reason: 'TENANT_CONTEXT_MISMATCH',
        error: 'Tenant context mismatch',
        metadata: {
          requestTenantId,
        },
      });

      throw mismatchError;
    }

    const permCheck = await this.checkPermission(userId, tenantId, 'READ');
    if (!permCheck.allowed) {
      await this.auditLog({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'READ',
        result: 'FAILURE',
        error: permCheck.reason,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Permission denied: ${permCheck.reason}`);
    }

    const cacheKey = this.getCacheKey(tenantId, 'all_secrets');
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now() && cached.tenantId === tenantId) {
      await this.auditLog({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'READ',
        result: 'SUCCESS',
        timestamp: new Date().toISOString(),
        metadata: { source: 'cache', latency_ms: Date.now() - startTime },
      });

      return cached.value;
    }

    try {
      const secretPath = this.getTenantSecretPath(tenantId, 'config');

      const commandInput = {
        SecretId: secretPath,
      };
      const Command = GetSecretValueCommand as unknown as {
        new (input: { SecretId: string }): unknown;
        (input: { SecretId: string }): unknown;
      };
      let command: unknown;
      try {
        command = new Command(commandInput);
      } catch {
        command = Command(commandInput);
      }
      if (!command || !(command instanceof GetSecretValueCommand)) {
        // Fallback for environments/tests where GetSecretValueCommand is mocked
        // and does not produce a real AWS SDK Command instance.
        command = commandInput;
      }

      const response = await this.client.send(command as any);

      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }

      const secrets = JSON.parse(response.SecretString) as SecretsConfig;

      this.cache.set(cacheKey, {
        value: secrets,
        expiresAt: Date.now() + this.cacheTTL,
        tenantId,
      });

      await this.auditLog({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'READ',
        result: 'SUCCESS',
        timestamp: new Date().toISOString(),
        metadata: { source: 'aws', latency_ms: Date.now() - startTime },
      });

      return secrets;
    } catch (error: unknown) {
      await this.auditLog({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'READ',
        result: 'FAILURE',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      logger.error(
        'Failed to fetch secrets from AWS Secrets Manager',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          path: this.getTenantSecretPath(tenantId, 'config'),
        }
      );

      logger.warn('Falling back to environment variables', { tenantId });
      return this.getSecretsFromEnv();
    }
  }

  /**
   * Get specific secret value for a tenant
   */
  async getSecret(
    tenantId: string,
    key: keyof SecretsConfig,
    userId?: string
  ): Promise<string | undefined> {
    const secrets = await this.getSecrets(tenantId, userId);
    return secrets[key];
  }

  /**
   * Fallback to environment variables (development only)
   */
  private getSecretsFromEnv(): SecretsConfig {
    if (this.environment === 'production') {
      logger.error('Environment variable fallback not allowed in production');
      throw new Error('Cannot fallback to environment variables in production');
    }

    logger.warn('Using environment variable fallback - not recommended for production');

    return {
      TOGETHER_API_KEY: getEnvVar('TOGETHER_API_KEY') || '',
      OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY'),
      SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL') || '',
      SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY') || '',
      SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || '',
      JWT_SECRET: getEnvVar('JWT_SECRET') || '',
      DATABASE_URL: getDatabaseUrl() || '',
      REDIS_URL: getEnvVar('REDIS_URL') || 'redis://localhost:6379',
      SLACK_WEBHOOK_URL: getEnvVar('SLACK_WEBHOOK_URL'),
    };
  }

  /**
   * Update a secret value for a tenant
   */
  async updateSecret(tenantId: string, updates: Partial<SecretsConfig>, userId?: string): Promise<void> {
    const permCheck = await this.checkPermission(userId, tenantId, 'WRITE');
    if (!permCheck.allowed) {
      await this.auditLog({
        tenantId,
        userId,
        secretKey: Object.keys(updates).join(','),
        action: 'WRITE',
        result: 'FAILURE',
        error: permCheck.reason,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Permission denied: ${permCheck.reason}`);
    }

    try {
      const currentSecrets = await this.getSecrets(tenantId, userId);
      const updatedSecrets = { ...currentSecrets, ...updates };

      const secretPath = this.getTenantSecretPath(tenantId, 'config');

      const command = new UpdateSecretCommand({
        SecretId: secretPath,
        SecretString: JSON.stringify(updatedSecrets),
      });

      await this.client.send(command);

      const cacheKey = this.getCacheKey(tenantId, 'all_secrets');
      this.cache.delete(cacheKey);

      await this.auditLog({
        tenantId,
        userId,
        secretKey: Object.keys(updates).join(','),
        action: 'WRITE',
        result: 'SUCCESS',
        timestamp: new Date().toISOString(),
        metadata: { keysUpdated: Object.keys(updates) },
      });

      logger.info('Secret updated successfully', {
        tenantId,
        keysUpdated: Object.keys(updates).length,
      });
    } catch (error: unknown) {
      await this.auditLog({
        tenantId,
        userId,
        secretKey: Object.keys(updates).join(','),
        action: 'WRITE',
        result: 'FAILURE',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      logger.error('Failed to update secret', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Rotate a secret (trigger automatic rotation)
   */
  async rotateSecret(tenantId: string, userId?: string): Promise<void> {
    const permCheck = await this.checkPermission(userId, tenantId, 'ROTATE');
    if (!permCheck.allowed) {
      await this.auditLog({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'ROTATE',
        result: 'FAILURE',
        error: permCheck.reason,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Permission denied: ${permCheck.reason}`);
    }

    try {
      const secretPath = this.getTenantSecretPath(tenantId, 'config');

      const command = new RotateSecretCommand({
        SecretId: secretPath,
      });

      await this.client.send(command);

      const cacheKey = this.getCacheKey(tenantId, 'all_secrets');
      this.cache.delete(cacheKey);

      await this.auditLog({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'ROTATE',
        result: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });

      logger.info('Secret rotation initiated', { tenantId });
    } catch (error: unknown) {
      await this.auditLog({
        tenantId,
        userId,
        secretKey: 'all_secrets',
        action: 'ROTATE',
        result: 'FAILURE',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      logger.error('Failed to rotate secret', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Clear cache (force refresh on next access)
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      const cacheKey = this.getCacheKey(tenantId, 'all_secrets');
      this.cache.delete(cacheKey);
      logger.info('Cache cleared for tenant', { tenantId });
    } else {
      this.cache.clear();
      logger.info('All cache cleared');
    }
  }

  /**
   * Validate that all required secrets are present for a tenant
   */
  async validateSecrets(tenantId: string, userId?: string): Promise<{ valid: boolean; missing: (keyof SecretsConfig)[] }> {
    const secrets = await this.getSecrets(tenantId, userId);

    const required: (keyof SecretsConfig)[] = [
      'TOGETHER_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'JWT_SECRET',
      'DATABASE_URL',
      'REDIS_URL',
    ];

    const missing = required.filter((key) => !secrets[key]);

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

// Export singleton instance lazily so tests can mock AWS SDK constructors before
// first use without module-evaluation side effects.
let _multiTenantSecretsManager: MultiTenantSecretsManager | null = null;

export function getMultiTenantSecretsManager(): MultiTenantSecretsManager {
  _multiTenantSecretsManager ??= new MultiTenantSecretsManager();
  return _multiTenantSecretsManager;
}

export const multiTenantSecretsManager = new Proxy({} as MultiTenantSecretsManager, {
  get(_target, property, receiver) {
    return Reflect.get(getMultiTenantSecretsManager(), property, receiver);
  },
});
export { MultiTenantSecretsManager as SecretsManager };

/**
 * Initialize secrets for a tenant on application startup
 */
export async function initializeTenantsSecrets(tenantId: string, userId?: string): Promise<void> {
  logger.info('Initializing secrets for tenant', { tenantId });

  try {
    const validation = await multiTenantSecretsManager.validateSecrets(tenantId, userId);

    if (!validation.valid) {
      logger.warn('Missing required secrets for tenant', {
        tenantId,
        missing: validation.missing,
      });
      logger.warn('Application may not function correctly for this tenant');
    } else {
      logger.info('All required secrets loaded successfully for tenant', { tenantId });
    }
  } catch (error: unknown) {
    logger.error(
      'Failed to initialize secrets for tenant',
      error instanceof Error ? error : new Error(String(error)),
      { tenantId }
    );
    throw error;
  }
}

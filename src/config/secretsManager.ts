/**
 * AWS Secrets Manager Integration
 * 
 * Securely manages API keys and sensitive configuration using AWS Secrets Manager.
 * Provides automatic rotation, caching, and fallback to environment variables.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
  RotateSecretCommand
} from '@aws-sdk/client-secrets-manager';
import { logger } from '../lib/logger';
import { StructuredSecretAuditLogger } from './secrets/SecretAuditLogger';
import { auditLogService } from '../services/AuditLogService';

interface SecretCache {
  value: any;
  expiresAt: number;
  tenantId: string;
  secretKey: string;
}

interface SecretsConfig {
  TOGETHER_API_KEY: string;
  OPENAI_API_KEY?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  SLACK_WEBHOOK_URL?: string;
}

export class SecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, SecretCache> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private environment: string;
  private auditLogger: StructuredSecretAuditLogger;

  constructor(auditLogger: StructuredSecretAuditLogger = new StructuredSecretAuditLogger()) {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.environment = process.env.NODE_ENV || 'development';
    this.auditLogger = auditLogger;
  }

  private getTenantSecretPath(tenantId: string, secretKey: string = 'config'): string {
    if (!tenantId) {
      throw new Error('Tenant ID is required for secret access');
    }

    if (!/^[a-zA-Z0-9-]+$/.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }

    return `valuecanvas/${this.environment}/tenants/${tenantId}/${secretKey}`;
  }

  private getCacheKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  private enforceTenantContext(targetTenantId: string, requestTenantId?: string): void {
    if (requestTenantId && requestTenantId !== targetTenantId) {
      const error: Error & { statusCode?: number } = new Error(
        `Tenant context mismatch: attempted ${targetTenantId} with context ${requestTenantId}`
      );
      error.statusCode = 403;
      void this.auditLogger.logDenied({
        tenantId: targetTenantId,
        userId: undefined,
        secretKey: 'config',
        action: 'READ',
        reason: 'TENANT_CONTEXT_MISMATCH'
      });
      throw error;
    }
  }
  
  /**
   * Get all secrets from AWS Secrets Manager
   */
  async getSecrets(
    tenantId: string,
    userId?: string,
    requestTenantId?: string
  ): Promise<SecretsConfig> {
    this.enforceTenantContext(tenantId, requestTenantId);

    // Check cache first
    const cacheKey = this.getCacheKey(tenantId, 'config');
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      await this.auditLogger.logAccess({
        tenantId,
        userId,
        secretKey: 'config',
        action: 'READ',
        result: 'SUCCESS',
        metadata: { source: 'cache' }
      });
      await auditLogService.log({
        userId: userId || 'system',
        userName: userId ? 'authenticated-user' : 'system',
        userEmail: `${userId || 'system'}@valuecanvas.io`,
        action: 'api_key_access',
        resourceType: 'secret',
        resourceId: `${tenantId}:config`,
        status: 'success',
        details: { source: 'cache' },
      });
      return cached.value;
    }
    
    try {
      const secretPath = this.getTenantSecretPath(tenantId, 'config');
      const command = new GetSecretValueCommand({
        SecretId: secretPath
      });
      
      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }
      
      const secrets = JSON.parse(response.SecretString) as SecretsConfig;
      
      // Cache the secrets
      this.cache.set(cacheKey, {
        value: secrets,
        expiresAt: Date.now() + this.cacheTTL,
        tenantId,
        secretKey: 'config'
      });

      await this.auditLogger.logAccess({
        tenantId,
        userId,
        secretKey: 'config',
        action: 'READ',
        result: 'SUCCESS',
        metadata: { source: 'aws' }
      });

      await auditLogService.log({
        userId: userId || 'system',
        userName: userId ? 'authenticated-user' : 'system',
        userEmail: `${userId || 'system'}@valuecanvas.io`,
        action: 'api_key_access',
        resourceType: 'secret',
        resourceId: `${tenantId}:config`,
        status: 'success',
        details: { source: 'aws' },
      });

      return secrets;
    } catch (error) {
      await this.auditLogger.logDenied({
        tenantId,
        userId,
        secretKey: 'config',
        action: 'READ',
        reason: error instanceof Error ? error.message : String(error)
      });

      logger.error('Failed to fetch secrets from AWS Secrets Manager', error instanceof Error ? error : new Error(String(error)), {
        tenantId
      });

      // Fallback to environment variables
      logger.warn('Falling back to environment variables', { tenantId });

      await auditLogService.log({
        userId: userId || 'system',
        userName: userId ? 'authenticated-user' : 'system',
        userEmail: `${userId || 'system'}@valuecanvas.io`,
        action: 'api_key_access',
        resourceType: 'secret',
        resourceId: `${tenantId}:config`,
        status: 'failed',
        details: {
          reason: error instanceof Error ? error.message : String(error),
          fallback: 'env',
        },
      });
      return this.getSecretsFromEnv();
    }
  }
  
  /**
   * Get specific secret value
   */
  async getSecret(
    tenantId: string,
    key: keyof SecretsConfig,
    userId?: string,
    requestTenantId?: string
  ): Promise<string | undefined> {
    const secrets = await this.getSecrets(tenantId, userId, requestTenantId);
    return secrets[key];
  }
  
  /**
   * Fallback to environment variables
   */
  private getSecretsFromEnv(): SecretsConfig {
    return {
      TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
      JWT_SECRET: process.env.JWT_SECRET || '',
      DATABASE_URL: process.env.DATABASE_URL || '',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL
    };
  }
  
  /**
   * Update a secret value
   */
  async updateSecret(
    tenantId: string,
    updates: Partial<SecretsConfig>,
    userId?: string,
    requestTenantId?: string
  ): Promise<void> {
    this.enforceTenantContext(tenantId, requestTenantId);

    try {
      const currentSecrets = await this.getSecrets(tenantId, userId, requestTenantId);
      const updatedSecrets = { ...currentSecrets, ...updates };

      const secretPath = this.getTenantSecretPath(tenantId, 'config');
      const command = new UpdateSecretCommand({
        SecretId: secretPath,
        SecretString: JSON.stringify(updatedSecrets)
      });

      await this.client.send(command);

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, 'config');
      this.cache.delete(cacheKey);

      await this.auditLogger.logAccess({
        tenantId,
        userId,
        secretKey: Object.keys(updates).join(',') || 'config',
        action: 'WRITE',
        result: 'SUCCESS'
      });
    } catch (error) {
      await this.auditLogger.logDenied({
        tenantId,
        userId,
        secretKey: Object.keys(updates).join(',') || 'config',
        action: 'WRITE',
        reason: error instanceof Error ? error.message : String(error)
      });
      logger.error('Failed to update secret', error instanceof Error ? error : new Error(String(error)), { tenantId });
      throw error;
    }
  }
  
  /**
   * Rotate a secret (trigger automatic rotation)
   */
  async rotateSecret(
    tenantId: string,
    userId?: string,
    requestTenantId?: string
  ): Promise<void> {
    this.enforceTenantContext(tenantId, requestTenantId);

    try {
      const secretPath = this.getTenantSecretPath(tenantId, 'config');
      const command = new RotateSecretCommand({
        SecretId: secretPath
      });

      await this.client.send(command);

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, 'config');
      this.cache.delete(cacheKey);

      await this.auditLogger.logRotation({
        tenantId,
        userId,
        secretKey: 'config',
        result: 'SUCCESS'
      });
    } catch (error) {
      await this.auditLogger.logDenied({
        tenantId,
        userId,
        secretKey: 'config',
        action: 'ROTATE',
        reason: error instanceof Error ? error.message : String(error)
      });
      logger.error('Failed to rotate secret', error instanceof Error ? error : new Error(String(error)), { tenantId });
      throw error;
    }
  }
  
  /**
   * Clear cache (force refresh on next access)
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.cache.delete(this.getCacheKey(tenantId, 'config'));
      return;
    }
    this.cache.clear();
  }
  
  /**
   * Validate that all required secrets are present
   */
  async validateSecrets(
    tenantId: string,
    userId?: string,
    requestTenantId?: string
  ): Promise<{ valid: boolean; missing: string[] }> {
    const secrets = await this.getSecrets(tenantId, userId, requestTenantId);
    const required: (keyof SecretsConfig)[] = [
      'TOGETHER_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'JWT_SECRET',
      'DATABASE_URL',
      'REDIS_URL'
    ];
    
    const missing = required.filter(key => !secrets[key]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();

/**
 * Initialize secrets on application startup
 */
export async function initializeSecrets(
  tenantId: string,
  userId?: string,
  requestTenantId?: string
): Promise<void> {
  // Initializing secrets from AWS Secrets Manager

  try {
    const validation = await secretsManager.validateSecrets(tenantId, userId, requestTenantId);

    if (!validation.valid) {
      logger.warn('Missing required secrets for tenant', { tenantId, missing: validation.missing });
    } else {
      // All required secrets loaded successfully
    }
  } catch (error) {
    logger.error('Failed to initialize secrets', error instanceof Error ? error : new Error(String(error)), { tenantId });
    logger.warn('Falling back to environment variables', { tenantId });
  }
}

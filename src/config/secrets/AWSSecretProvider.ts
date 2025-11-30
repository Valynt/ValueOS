/**
 * AWS Secrets Manager Provider
 * 
 * Implementation of ISecretProvider for AWS Secrets Manager
 * Refactored from secretsManager.v2.ts to use provider interface
 * 
 * Sprint 2: Provider Abstraction
 * Created: 2024-11-29
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
  ListSecretsCommand,
  DescribeSecretCommand,
  RotateSecretCommand
} from '@aws-sdk/client-secrets-manager';
import { logger } from '../../lib/logger';
import type {
  ISecretProvider,
  SecretValue,
  SecretMetadata,
  AuditAction,
  AuditResult
} from './ISecretProvider';

/**
 * AWS Secrets Manager provider implementation
 */
export class AWSSecretProvider implements ISecretProvider {
  private client: SecretsManagerClient;
  private environment: string;
  private cache: Map<string, { value: SecretValue; expiresAt: number }> = new Map();
  private cacheTTL: number;

  constructor(
    region: string = 'us-east-1',
    cacheTTL: number = 300000 // 5 minutes
  ) {
    this.client = new SecretsManagerClient({ region });
    this.environment = process.env.NODE_ENV || 'development';
    this.cacheTTL = cacheTTL;

    logger.info('AWS Secret Provider initialized', {
      provider: 'aws',
      region,
      environment: this.environment
    });
  }

  /**
   * Generate tenant-isolated AWS secret path
   */
  private getTenantSecretPath(tenantId: string, secretKey: string): string {
    if (!tenantId || !secretKey) {
      throw new Error('Tenant ID and secret key are required');
    }

    // Validate format
    if (!/^[a-zA-Z0-9-_]+$/.test(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }

    return `valuecanvas/${this.environment}/tenants/${tenantId}/${secretKey}`;
  }

  /**
   * Get cache key
   */
  private getCacheKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  async getSecret(
    tenantId: string,
    secretKey: string,
    version?: string,
    userId?: string
  ): Promise<SecretValue> {
    const startTime = Date.now();
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    // Check cache
    const cacheKey = this.getCacheKey(tenantId, secretKey);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      await this.auditAccess(tenantId, secretKey, 'READ', 'SUCCESS', userId, undefined, {
        source: 'cache',
        latency_ms: Date.now() - startTime
      });
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretPath,
        VersionId: version
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }

      const secretValue = JSON.parse(response.SecretString) as SecretValue;

      // Cache the secret
      this.cache.set(cacheKey, {
        value: secretValue,
        expiresAt: Date.now() + this.cacheTTL
      });

      await this.auditAccess(tenantId, secretKey, 'READ', 'SUCCESS', userId, undefined, {
        source: 'aws',
        latency_ms: Date.now() - startTime,
        version
      });

      return secretValue;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        'READ',
        'FAILURE',
        userId,
        error instanceof Error ? error.message : String(error),
        { latency_ms: Date.now() - startTime }
      );

      logger.error('Failed to get secret from AWS', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        secretPath
      });

      throw error;
    }
  }

  async setSecret(
    tenantId: string,
    secretKey: string,
    value: SecretValue,
    metadata: SecretMetadata,
    userId?: string
  ): Promise<boolean> {
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    try {
      // Add metadata to secret
      const secretWithMetadata = {
        ...value,
        _metadata: {
          tenantId: metadata.tenantId,
          sensitivityLevel: metadata.sensitivityLevel,
          createdAt: metadata.createdAt,
          version: metadata.version,
          rotationPolicy: metadata.rotationPolicy,
          tags: metadata.tags
        }
      };

      const command = new PutSecretValueCommand({
        SecretId: secretPath,
        SecretString: JSON.stringify(secretWithMetadata)
      });

      await this.client.send(command);

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, 'WRITE', 'SUCCESS', userId);

      logger.info('Secret set successfully in AWS', {
        tenantId,
        secretKey,
        sensitivityLevel: metadata.sensitivityLevel
      });

      return true;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        'WRITE',
        'FAILURE',
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error('Failed to set secret in AWS', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        secretPath
      });

      throw error;
    }
  }

  async rotateSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    try {
      const command = new RotateSecretCommand({
        SecretId: secretPath
      });

      await this.client.send(command);

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, 'ROTATE', 'SUCCESS', userId);

      logger.info('Secret rotation initiated in AWS', {
        tenantId,
        secretKey
      });

      return true;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        'ROTATE',
        'FAILURE',
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error('Failed to rotate secret in AWS', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        secretPath
      });

      throw error;
    }
  }

  async deleteSecret(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    try {
      const command = new DeleteSecretCommand({
        SecretId: secretPath,
        ForceDeleteWithoutRecovery: false, // Allow recovery window
        RecoveryWindowInDays: 30
      });

      await this.client.send(command);

      // Invalidate cache
      const cacheKey = this.getCacheKey(tenantId, secretKey);
      this.cache.delete(cacheKey);

      await this.auditAccess(tenantId, secretKey, 'DELETE', 'SUCCESS', userId);

      logger.info('Secret deleted from AWS', {
        tenantId,
        secretKey,
        recoveryWindowDays: 30
      });

      return true;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        secretKey,
        'DELETE',
        'FAILURE',
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error('Failed to delete secret from AWS', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        secretPath
      });

      throw error;
    }
  }

  async listSecrets(tenantId: string, userId?: string): Promise<string[]> {
    const prefix = `valuecanvas/${this.environment}/tenants/${tenantId}/`;

    try {
      const command = new ListSecretsCommand({
        Filters: [
          {
            Key: 'name',
            Values: [prefix]
          }
        ]
      });

      const response = await this.client.send(command);
      const secrets = response.SecretList || [];

      // Extract secret keys from full paths
      const secretKeys = secrets
        .map(s => s.Name?.replace(prefix, '') || '')
        .filter(Boolean);

      await this.auditAccess(tenantId, 'ALL', 'LIST', 'SUCCESS', userId, undefined, {
        count: secretKeys.length
      });

      return secretKeys;
    } catch (error) {
      await this.auditAccess(
        tenantId,
        'ALL',
        'LIST',
        'FAILURE',
        userId,
        error instanceof Error ? error.message : String(error)
      );

      logger.error('Failed to list secrets from AWS', error instanceof Error ? error : new Error(String(error)), {
        tenantId
      });

      throw error;
    }
  }

  async getSecretMetadata(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<SecretMetadata | null> {
    const secretPath = this.getTenantSecretPath(tenantId, secretKey);

    try {
      const command = new DescribeSecretCommand({
        SecretId: secretPath
      });

      const response = await this.client.send(command);

      if (!response.Name) {
        return null;
      }

      // Extract metadata from AWS response
      const metadata: SecretMetadata = {
        tenantId,
        secretPath: response.Name,
        version: response.VersionIdsToStages ? Object.keys(response.VersionIdsToStages)[0] : 'latest',
        createdAt: response.CreatedDate?.toISOString() || new Date().toISOString(),
        lastAccessed: response.LastAccessedDate?.toISOString() || new Date().toISOString(),
        sensitivityLevel: 'high', // Default, should be in tags
        tags: response.Tags?.reduce((acc, tag) => {
          if (tag.Key && tag.Value) {
            acc[tag.Key] = tag.Value;
          }
          return acc;
        }, {} as Record<string, string>)
      };

      return metadata;
    } catch (error) {
      logger.error('Failed to get secret metadata from AWS', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        secretPath
      });

      return null;
    }
  }

  async secretExists(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<boolean> {
    try {
      const metadata = await this.getSecretMetadata(tenantId, secretKey, userId);
      return metadata !== null;
    } catch (error) {
      return false;
    }
  }

  async auditAccess(
    tenantId: string,
    secretKey: string,
    action: AuditAction,
    result: AuditResult,
    userId?: string,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logEntry = {
      provider: 'aws',
      tenantId,
      userId,
      secretKey: this.maskSecretKey(secretKey),
      action,
      result,
      error,
      metadata,
      timestamp: new Date().toISOString()
    };

    if (result === 'SUCCESS') {
      logger.info('SECRET_ACCESS', logEntry);
    } else {
      logger.warn('SECRET_ACCESS_DENIED', logEntry);
    }

    // TODO: Also write to database audit log table
  }

  private maskSecretKey(key: string): string {
    if (key === 'ALL' || key.length <= 8) {
      return key;
    }
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  getProviderName(): string {
    return 'aws';
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple check - list secrets with limit 1
      const command = new ListSecretsCommand({ MaxResults: 1 });
      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('AWS provider health check failed', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Clear cache for testing/maintenance
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      // Clear cache for specific tenant
      for (const [key] of this.cache.entries()) {
        if (key.startsWith(`${tenantId}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

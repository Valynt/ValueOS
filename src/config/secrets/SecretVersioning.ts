/**
 * Secret Versioning System
 * 
 * Manages secret versions with rollback capability
 * Stores last 10 versions, enables version comparison and restoration
 * 
 * Sprint 4: Advanced Features
 * Created: 2024-11-29
 */

import { logger } from '../../lib/logger';
import type { ISecretProvider, SecretValue, SecretMetadata } from './ISecretProvider';

/**
 * Secret version entry
 */
export interface SecretVersion {
  version: string;
  value: SecretValue;
  metadata: SecretMetadata;
  createdAt: Date;
  createdBy: string;
  description?: string;
  deprecated?: boolean;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  version1: string;
  version2: string;
  differences: Array<{
    key: string;
    oldValue?: string;
    newValue?: string;
    changeType: 'added' | 'removed' | 'modified';
  }>;
}

/**
 * Secret versioning manager
 * 
 * Maintains version history and enables rollback
 */
export class SecretVersioning {
  private provider: ISecretProvider;
  private maxVersions: number = 10;
  private versionStore: Map<string, SecretVersion[]> = new Map();

  constructor(provider: ISecretProvider, maxVersions: number = 10) {
    this.provider = provider;
    this.maxVersions = maxVersions;

    logger.info('Secret versioning initialized', {
      provider: provider.getProviderName(),
      maxVersions
    });
  }

  /**
   * Get version key for storage
   */
  private getVersionKey(tenantId: string, secretKey: string): string {
    return `${tenantId}:${secretKey}`;
  }

  /**
   * Generate version ID
   */
  private generateVersionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `v${timestamp}-${random}`;
  }

  /**
   * Store a new version
   */
  async storeVersion(
    tenantId: string,
    secretKey: string,
    value: SecretValue,
    metadata: SecretMetadata,
    userId: string,
    description?: string
  ): Promise<string> {
    const versionKey = this.getVersionKey(tenantId, secretKey);
    const versionId = this.generateVersionId();

    // Get existing versions
    let versions = this.versionStore.get(versionKey) || [];

    // Create new version entry
    const newVersion: SecretVersion = {
      version: versionId,
      value,
      metadata,
      createdAt: new Date(),
      createdBy: userId,
      description
    };

    // Add to beginning of array
    versions.unshift(newVersion);

    // Keep only last N versions
    if (versions.length > this.maxVersions) {
      const removed = versions.splice(this.maxVersions);
      logger.info('Pruned old versions', {
        tenantId,
        secretKey,
        removed: removed.length
      });
    }

    // Update store
    this.versionStore.set(versionKey, versions);

    logger.info('Stored secret version', {
      tenantId,
      secretKey,
      version: versionId,
      totalVersions: versions.length
    });

    return versionId;
  }

  /**
   * Get all versions for a secret
   */
  async getVersions(
    tenantId: string,
    secretKey: string,
    userId?: string
  ): Promise<SecretVersion[]> {
    const versionKey = this.getVersionKey(tenantId, secretKey);
    const versions = this.versionStore.get(versionKey) || [];

    logger.info('Retrieved secret versions', {
      tenantId,
      secretKey,
      count: versions.length
    });

    // Return copies without actual secret values (security)
    return versions.map(v => ({
      ...v,
      value: {} // Don't expose values in list
    }));
  }

  /**
   * Get a specific version
   */
  async getVersion(
    tenantId: string,
    secretKey: string,
    versionId: string,
    userId?: string
  ): Promise<SecretVersion | null> {
    const versionKey = this.getVersionKey(tenantId, secretKey);
    const versions = this.versionStore.get(versionKey) || [];

    const version = versions.find(v => v.version === versionId);

    if (!version) {
      logger.warn('Version not found', {
        tenantId,
        secretKey,
        versionId
      });
      return null;
    }

    logger.info('Retrieved specific version', {
      tenantId,
      secretKey,
      versionId
    });

    return version;
  }

  /**
   * Rollback to a previous version
   */
  async rollbackSecret(
    tenantId: string,
    secretKey: string,
    targetVersion: string,
    userId: string
  ): Promise<boolean> {
    logger.info('Starting secret rollback', {
      tenantId,
      secretKey,
      targetVersion,
      userId
    });

    try {
      // Get the target version
      const version = await this.getVersion(tenantId, secretKey, targetVersion, userId);

      if (!version) {
        throw new Error(`Version ${targetVersion} not found`);
      }

      // Set the secret to the old value (this creates a new version)
      const success = await this.provider.setSecret(
        tenantId,
        secretKey,
        version.value,
        {
          ...version.metadata,
          version: 'rollback',
          lastAccessed: new Date().toISOString()
        },
        userId
      );

      if (success) {
        // Store this rollback as a new version
        await this.storeVersion(
          tenantId,
          secretKey,
          version.value,
          version.metadata,
          userId,
          `Rollback to version ${targetVersion}`
        );

        logger.info('Secret rollback successful', {
          tenantId,
          secretKey,
          targetVersion
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Secret rollback failed', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        secretKey,
        targetVersion
      });
      throw error;
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    tenantId: string,
    secretKey: string,
    version1Id: string,
    version2Id: string
  ): Promise<VersionComparison> {
    const v1 = await this.getVersion(tenantId, secretKey, version1Id);
    const v2 = await this.getVersion(tenantId, secretKey, version2Id);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const differences: VersionComparison['differences'] = [];

    // Get all keys from both versions
    const allKeys = new Set([
      ...Object.keys(v1.value),
      ...Object.keys(v2.value)
    ]);

    // Compare each key
    for (const key of allKeys) {
      const val1 = v1.value[key];
      const val2 = v2.value[key];

      if (val1 === undefined && val2 !== undefined) {
        differences.push({
          key,
          newValue: this.maskValue(val2),
          changeType: 'added'
        });
      } else if (val1 !== undefined && val2 === undefined) {
        differences.push({
          key,
          oldValue: this.maskValue(val1),
          changeType: 'removed'
        });
      } else if (val1 !== val2) {
        differences.push({
          key,
          oldValue: this.maskValue(val1),
          newValue: this.maskValue(val2),
          changeType: 'modified'
        });
      }
    }

    return {
      version1: version1Id,
      version2: version2Id,
      differences
    };
  }

  /**
   * Mask secret value for logging
   */
  private maskValue(value: string | undefined): string {
    if (!value) return '(empty)';
    if (value.length <= 8) return '***';
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }

  /**
   * Deprecate a version (mark as obsolete)
   */
  async deprecateVersion(
    tenantId: string,
    secretKey: string,
    versionId: string,
    userId: string
  ): Promise<boolean> {
    const versionKey = this.getVersionKey(tenantId, secretKey);
    const versions = this.versionStore.get(versionKey) || [];

    const version = versions.find(v => v.version === versionId);

    if (!version) {
      return false;
    }

    version.deprecated = true;

    logger.info('Version deprecated', {
      tenantId,
      secretKey,
      versionId,
      userId
    });

    return true;
  }

  /**
   * Delete old versions (cleanup)
   */
  async pruneVersions(
    tenantId: string,
    secretKey: string,
    keepCount: number = 5
  ): Promise<number> {
    const versionKey = this.getVersionKey(tenantId, secretKey);
    const versions = this.versionStore.get(versionKey) || [];

    if (versions.length <= keepCount) {
      return 0;
    }

    const toRemove = versions.length - keepCount;
    versions.splice(keepCount);

    this.versionStore.set(versionKey, versions);

    logger.info('Pruned versions', {
      tenantId,
      secretKey,
      removed: toRemove,
      remaining: keepCount
    });

    return toRemove;
  }

  /**
   * Get version statistics
   */
  getStatistics(): {
    totalSecrets: number;
    totalVersions: number;
    averageVersionsPerSecret: number;
  } {
    let totalVersions = 0;

    for (const versions of this.versionStore.values()) {
      totalVersions += versions.length;
    }

    const totalSecrets = this.versionStore.size;
    const averageVersionsPerSecret = totalSecrets > 0 ? totalVersions / totalSecrets : 0;

    return {
      totalSecrets,
      totalVersions,
      averageVersionsPerSecret
    };
  }

  /**
   * Export version history (for backup)
   */
  exportVersionHistory(tenantId: string, secretKey: string): string {
    const versionKey = this.getVersionKey(tenantId, secretKey);
    const versions = this.versionStore.get(versionKey) || [];

    // Remove sensitive values
    const sanitized = versions.map(v => ({
      ...v,
      value: Object.keys(v.value) // Only export keys, not values
    }));

    return JSON.stringify(sanitized, null, 2);
  }
}

/**
 * Create versioning manager from environment
 */
export function createSecretVersioning(provider: ISecretProvider): SecretVersioning {
  const maxVersions = parseInt(process.env.SECRET_MAX_VERSIONS || '10', 10);
  return new SecretVersioning(provider, maxVersions);
}

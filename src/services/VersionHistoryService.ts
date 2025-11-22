/**
 * Version History Service
 * Tracks all configuration changes with rollback capabilities
 */

import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { NotFoundError } from './errors';

export interface SettingsVersion {
  id: string;
  settingKey: string;
  oldValue: any;
  newValue: any;
  scope: 'user' | 'team' | 'organization';
  scopeId: string;
  changedBy: string;
  changeDescription?: string;
  changeType: 'create' | 'update' | 'delete';
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  rolledBack: boolean;
  rolledBackAt?: string;
  rolledBackBy?: string;
}

export interface VersionCreateInput {
  settingKey: string;
  oldValue?: any;
  newValue: any;
  scope: 'user' | 'team' | 'organization';
  scopeId: string;
  changedBy: string;
  changeDescription?: string;
  changeType: 'create' | 'update' | 'delete';
  ipAddress?: string;
  userAgent?: string;
}

export interface VersionQueryOptions {
  scope?: string;
  scopeId?: string;
  settingKey?: string;
  changedBy?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class VersionHistoryService extends BaseService {
  constructor() {
    super('VersionHistoryService');
  }

  /**
   * Record a settings change
   */
  async recordChange(input: VersionCreateInput): Promise<SettingsVersion> {
    this.validateRequired(input, ['settingKey', 'newValue', 'scope', 'scopeId', 'changedBy', 'changeType']);

    this.log('info', 'Recording settings change', { key: input.settingKey });

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('settings_versions')
          .insert({
            setting_key: input.settingKey,
            old_value: input.oldValue,
            new_value: input.newValue,
            scope: input.scope,
            scope_id: input.scopeId,
            changed_by: input.changedBy,
            change_description: input.changeDescription,
            change_type: input.changeType,
            ip_address: input.ipAddress,
            user_agent: input.userAgent,
          })
          .select()
          .single();

        if (error) throw error;
        return this.mapVersion(data);
      },
      { skipCache: true }
    );
  }

  /**
   * Get version history
   */
  async getHistory(options: VersionQueryOptions = {}): Promise<SettingsVersion[]> {
    this.log('info', 'Getting version history', options);

    return this.executeRequest(
      async () => {
        let query = this.supabase.from('settings_versions').select('*');

        if (options.scope) {
          query = query.eq('scope', options.scope);
        }

        if (options.scopeId) {
          query = query.eq('scope_id', options.scopeId);
        }

        if (options.settingKey) {
          query = query.eq('setting_key', options.settingKey);
        }

        if (options.changedBy) {
          query = query.eq('changed_by', options.changedBy);
        }

        if (options.startDate) {
          query = query.gte('created_at', options.startDate);
        }

        if (options.endDate) {
          query = query.lte('created_at', options.endDate);
        }

        query = query.order('created_at', { ascending: false });

        if (options.limit) {
          query = query.limit(options.limit);
        }

        if (options.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
        }

        const { data, error } = await query;

        if (error) throw error;
        return (data || []).map(this.mapVersion);
      },
      {
        deduplicationKey: `version-history-${JSON.stringify(options)}`,
      }
    );
  }

  /**
   * Get specific version
   */
  async getVersion(id: string): Promise<SettingsVersion> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('settings_versions')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new NotFoundError('Version');

        return this.mapVersion(data);
      },
      {
        deduplicationKey: `version-${id}`,
      }
    );
  }

  /**
   * Rollback to a specific version
   */
  async rollback(versionId: string, rolledBackBy: string): Promise<SettingsVersion> {
    this.log('warn', 'Rolling back settings', { versionId });

    return this.executeRequest(
      async () => {
        // Get the version to rollback to
        const version = await this.getVersion(versionId);

        // Mark as rolled back
        const { data, error } = await this.supabase
          .from('settings_versions')
          .update({
            rolled_back: true,
            rolled_back_at: new Date().toISOString(),
            rolled_back_by: rolledBackBy,
          })
          .eq('id', versionId)
          .select()
          .single();

        if (error) throw error;

        // Create a new version entry for the rollback
        await this.recordChange({
          settingKey: version.settingKey,
          oldValue: version.newValue,
          newValue: version.oldValue,
          scope: version.scope,
          scopeId: version.scopeId,
          changedBy: rolledBackBy,
          changeDescription: `Rolled back to version ${versionId}`,
          changeType: 'update',
        });

        this.clearCache();
        return this.mapVersion(data);
      },
      { skipCache: true }
    );
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    versionId1: string,
    versionId2: string
  ): Promise<{
    version1: SettingsVersion;
    version2: SettingsVersion;
    differences: Array<{ field: string; value1: any; value2: any }>;
  }> {
    const [version1, version2] = await Promise.all([
      this.getVersion(versionId1),
      this.getVersion(versionId2),
    ]);

    const differences: Array<{ field: string; value1: any; value2: any }> = [];

    // Deep compare values
    const keys = new Set([
      ...Object.keys(version1.newValue || {}),
      ...Object.keys(version2.newValue || {}),
    ]);

    keys.forEach((key) => {
      const val1 = version1.newValue?.[key];
      const val2 = version2.newValue?.[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences.push({ field: key, value1: val1, value2: val2 });
      }
    });

    return { version1, version2, differences };
  }

  /**
   * Get rollback preview
   */
  async getRollbackPreview(versionId: string): Promise<{
    version: SettingsVersion;
    currentValue: any;
    rollbackValue: any;
    affectedSettings: string[];
  }> {
    const version = await this.getVersion(versionId);

    return {
      version,
      currentValue: version.newValue,
      rollbackValue: version.oldValue,
      affectedSettings: Object.keys(version.oldValue || {}),
    };
  }

  /**
   * Map database record to SettingsVersion
   */
  private mapVersion(data: any): SettingsVersion {
    return {
      id: data.id,
      settingKey: data.setting_key,
      oldValue: data.old_value,
      newValue: data.new_value,
      scope: data.scope,
      scopeId: data.scope_id,
      changedBy: data.changed_by,
      changeDescription: data.change_description,
      changeType: data.change_type,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      createdAt: data.created_at,
      rolledBack: data.rolled_back,
      rolledBackAt: data.rolled_back_at,
      rolledBackBy: data.rolled_back_by,
    };
  }
}

export const versionHistoryService = new VersionHistoryService();

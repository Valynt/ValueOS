/**
 * Settings Service
 * Centralized settings API calls with caching, validation, and error handling
 */

import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { ValidationError, NotFoundError } from './errors';
import { tenantCache } from './cache/TenantCache';

export interface Setting {
  id: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  scope: 'user' | 'team' | 'organization';
  scopeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingCreateInput {
  key: string;
  value: any;
  type: Setting['type'];
  scope: Setting['scope'];
  scopeId: string;
}

export interface SettingUpdateInput {
  value: any;
}

export interface SettingsQueryOptions {
  scope?: Setting['scope'];
  scopeId?: string;
  keys?: string[];
}

export class SettingsService extends BaseService {
  constructor() {
    super('SettingsService');
  }

  /**
   * Get a single setting by key and scope
   * @param key - Setting key
   * @param scope - Setting scope
   * @param scopeId - Scope identifier
   * @returns Setting value or null if not found
   */
  async getSetting(
    key: string,
    scope: Setting['scope'],
    scopeId: string
  ): Promise<any | null> {
    this.log('info', 'Getting setting', { key, scope, scopeId });

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('settings')
          .select('*')
          .eq('key', key)
          .eq('scope', scope)
          .eq('scope_id', scopeId)
          .maybeSingle();

        if (error) throw error;

        return data ? this.deserializeValue(data.value, data.type) : null;
      },
      {
        deduplicationKey: `get-setting-${scope}-${scopeId}-${key}`,
      }
    );
  }

  /**
   * Get multiple settings by query
   * @param options - Query options
   * @returns Array of settings
   */
  async getSettings(options: SettingsQueryOptions = {}): Promise<Setting[]> {
    this.log('info', 'Getting settings', options);

    return this.executeRequest(
      async () => {
        let query = this.supabase.from('settings').select('*');

        if (options.scope) {
          query = query.eq('scope', options.scope);
        }

        if (options.scopeId) {
          query = query.eq('scope_id', options.scopeId);
        }

        if (options.keys && options.keys.length > 0) {
          query = query.in('key', options.keys);
        }

        const { data, error } = await query.order('key');

        if (error) throw error;

        return (data || []).map((setting) => ({
          ...setting,
          value: this.deserializeValue(setting.value, setting.type),
        }));
      },
      {
        deduplicationKey: `get-settings-${JSON.stringify(options)}`,
      }
    );
  }

  /**
   * Get organization-level configuration with tenant-aware caching
   */
  async getOrganizationConfig(tenantId: string): Promise<Record<string, any>> {
    const cacheKey = tenantCache.buildOrgConfigKey(tenantId);
    const cached = await tenantCache.get<Record<string, any>>(cacheKey);

    if (cached) {
      return cached;
    }

    const settings = await this.getSettings({
      scope: 'organization',
      scopeId: tenantId,
    });

    const config = settings.reduce<Record<string, any>>((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    await tenantCache.set(cacheKey, config);
    return config;
  }

  /**
   * Create a new setting
   * @param input - Setting creation input
   * @returns Created setting
   */
  async createSetting(input: SettingCreateInput): Promise<Setting> {
    this.validateRequired(input, ['key', 'value', 'type', 'scope', 'scopeId']);
    this.validateSettingType(input.value, input.type);

    this.log('info', 'Creating setting', input);

    return this.executeRequest(
      async () => {
        // Check if setting already exists
        const { data: existing } = await this.supabase
          .from('settings')
          .select('id')
          .eq('key', input.key)
          .eq('scope', input.scope)
          .eq('scope_id', input.scopeId)
          .maybeSingle();

        if (existing) {
          throw new ValidationError(
            `Setting with key '${input.key}' already exists for this scope`
          );
        }

        const { data, error } = await this.supabase
          .from('settings')
          .insert({
            key: input.key,
            value: this.serializeValue(input.value, input.type),
            type: input.type,
            scope: input.scope,
            scope_id: input.scopeId,
          })
          .select()
          .single();

        if (error) throw error;

        this.clearCache(`get-setting-${input.scope}-${input.scopeId}-${input.key}`);
        this.clearCache(); // Clear all cached queries

        if (input.scope === 'organization') {
          await tenantCache.invalidate(tenantCache.buildOrgConfigKey(input.scopeId));
        }

        return {
          ...data,
          value: this.deserializeValue(data.value, data.type),
        };
      },
      {
        skipCache: true,
      }
    );
  }

  /**
   * Update an existing setting
   * @param key - Setting key
   * @param scope - Setting scope
   * @param scopeId - Scope identifier
   * @param input - Update input
   * @returns Updated setting
   */
  async updateSetting(
    key: string,
    scope: Setting['scope'],
    scopeId: string,
    input: SettingUpdateInput
  ): Promise<Setting> {
    this.validateRequired(input, ['value']);

    this.log('info', 'Updating setting', { key, scope, scopeId, input });

    return this.executeRequest(
      async () => {
        // Get current setting to determine type
        const { data: current } = await this.supabase
          .from('settings')
          .select('*')
          .eq('key', key)
          .eq('scope', scope)
          .eq('scope_id', scopeId)
          .maybeSingle();

        if (!current) {
          throw new NotFoundError(`Setting '${key}'`);
        }

        this.validateSettingType(input.value, current.type);

        const { data, error } = await this.supabase
          .from('settings')
          .update({
            value: this.serializeValue(input.value, current.type),
            updated_at: new Date().toISOString(),
          })
          .eq('key', key)
          .eq('scope', scope)
          .eq('scope_id', scopeId)
          .select()
          .single();

        if (error) throw error;

        this.clearCache(`get-setting-${scope}-${scopeId}-${key}`);
        this.clearCache(); // Clear all cached queries

        if (scope === 'organization') {
          await tenantCache.invalidate(tenantCache.buildOrgConfigKey(scopeId));
        }

        return {
          ...data,
          value: this.deserializeValue(data.value, data.type),
        };
      },
      {
        skipCache: true,
      }
    );
  }

  /**
   * Upsert a setting (create or update)
   * @param input - Setting input
   * @returns Setting
   */
  async upsertSetting(input: SettingCreateInput): Promise<Setting> {
    try {
      const existing = await this.getSetting(input.key, input.scope, input.scopeId);

      if (existing !== null) {
        return this.updateSetting(input.key, input.scope, input.scopeId, {
          value: input.value,
        });
      } else {
        return this.createSetting(input);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a setting
   * @param key - Setting key
   * @param scope - Setting scope
   * @param scopeId - Scope identifier
   */
  async deleteSetting(
    key: string,
    scope: Setting['scope'],
    scopeId: string
  ): Promise<void> {
    this.log('info', 'Deleting setting', { key, scope, scopeId });

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from('settings')
          .delete()
          .eq('key', key)
          .eq('scope', scope)
          .eq('scope_id', scopeId);

        if (error) throw error;

        this.clearCache(`get-setting-${scope}-${scopeId}-${key}`);
        this.clearCache();

        if (scope === 'organization') {
          await tenantCache.invalidate(tenantCache.buildOrgConfigKey(scopeId));
        }
      },
      {
        skipCache: true,
      }
    );
  }

  /**
   * Bulk update settings
   * @param scope - Setting scope
   * @param scopeId - Scope identifier
   * @param settings - Key-value pairs to update
   * @returns Updated settings
   */
  async bulkUpdateSettings(
    scope: Setting['scope'],
    scopeId: string,
    settings: Record<string, any>
  ): Promise<Setting[]> {
    this.log('info', 'Bulk updating settings', { scope, scopeId, count: Object.keys(settings).length });

    const updates = Object.entries(settings).map(([key, value]) =>
      this.upsertSetting({
        key,
        value,
        type: this.inferType(value),
        scope,
        scopeId,
      })
    );

    return Promise.all(updates);
  }

  /**
   * Serialize value for storage
   */
  private serializeValue(value: any, type: Setting['type']): string {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return String(value);
      case 'boolean':
        return String(value);
      case 'object':
      case 'array':
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  /**
   * Deserialize value from storage
   */
  private deserializeValue(value: string, type: Setting['type']): any {
    switch (type) {
      case 'string':
        return value;
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'object':
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  /**
   * Validate that value matches type
   */
  private validateSettingType(value: any, type: Setting['type']): void {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ValidationError(`Value must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new ValidationError(`Value must be a valid number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new ValidationError(`Value must be a boolean`);
        }
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          throw new ValidationError(`Value must be an object`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new ValidationError(`Value must be an array`);
        }
        break;
    }
  }

  /**
   * Infer type from value
   */
  private inferType(value: any): Setting['type'] {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }
}

// Export singleton instance
export const settingsService = new SettingsService();

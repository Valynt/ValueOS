/**
 * User Settings Service
 * Handles user profile and preference operations
 * 
 * SEC-003: Migrated to TenantAwareService for tenant isolation
 */

import { logger } from '../lib/logger';
import { TenantAwareService } from './TenantAwareService';
import { settingsService } from './SettingsService';
import { NotFoundError, ValidationError } from './errors';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  bio?: string;
  timezone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  emailNotifications: boolean;
  desktopNotifications: boolean;
  weeklyDigest: boolean;
  compactMode: boolean;
}

export interface UserProfileUpdateInput {
  fullName?: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

export class UserSettingsService extends TenantAwareService {
  constructor() {
    super('UserSettingsService');
  }

  /**
   * Get user profile
   * SEC-003: Added tenant validation
   */
  async getProfile(userId: string, tenantId: string): Promise<UserProfile> {
    this.log('info', 'Getting user profile', { userId, tenantId });

    // SEC-003: Validate tenant access
    await this.validateTenantAccess(userId, tenantId);

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;
        if (!data) throw new NotFoundError('User profile');

        // SEC-003: Verify user belongs to tenant
        const userTenants = await this.getUserTenants(userId);
        if (!userTenants.includes(tenantId)) {
          throw new NotFoundError('User profile');
        }

        return data;
      },
      { deduplicationKey: `user-profile-${userId}-${tenantId}` }
    );
  }

  /**
   * Update user profile
   * SEC-003: Added tenant validation
   */
  async updateProfile(
    userId: string,
    tenantId: string,
    input: UserProfileUpdateInput
  ): Promise<UserProfile> {
    this.log('info', 'Updating user profile', { userId, tenantId });

    if (input.email) {
      throw new ValidationError('Email cannot be changed through this endpoint');
    }

    // SEC-003: Validate tenant access
    await this.validateTenantAccess(userId, tenantId);

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('users')
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;

        this.clearCache(`user-profile-${userId}-${tenantId}`);
        return data;
      },
      { skipCache: true }
    );
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    this.log('info', 'Getting user preferences', { userId });

    const defaults: UserPreferences = {
      theme: 'auto',
      emailNotifications: true,
      desktopNotifications: true,
      weeklyDigest: true,
      compactMode: false,
    };

    const settings = await settingsService.getSettings({
      scope: 'user',
      scopeId: userId,
    });

    const preferences = { ...defaults };
    settings.forEach((setting) => {
      if (setting.key in preferences) {
        preferences[setting.key as keyof UserPreferences] = setting.value;
      }
    });

    return preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    this.log('info', 'Updating user preferences', { userId });

    await settingsService.bulkUpdateSettings('user', userId, preferences);

    return this.getPreferences(userId);
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string): Promise<void> {
    this.log('warn', 'Deleting user account', { userId });

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) throw error;

        this.clearCache();
      },
      { skipCache: true }
    );
  }
}

export const userSettingsService = new UserSettingsService();

import { SettingsRoute, SettingsSearchResult, SettingsPermission } from '../types';
import { supabase } from './supabase';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SettingValue {
  key: string;
  value: any;
  scope: 'user' | 'team' | 'organization' | 'system';
  scopeId?: string;
  updatedAt?: string;
}

export interface SettingsContext {
  userId?: string;
  teamId?: string;
  organizationId?: string;
}

export interface UseSettingsResult<T = any> {
  value: T | null;
  loading: boolean;
  error: Error | null;
  update: (newValue: T) => Promise<void>;
  reset: () => Promise<void>;
}

// ============================================================================
// Settings Registry Class
// ============================================================================

export class SettingsRegistry {
  private routes: SettingsRoute[] = [];
  private flatRoutes: Map<string, SettingsRoute> = new Map();
  private defaultSettings: Map<string, any> = new Map();
  private settingsCache: Map<string, SettingValue> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(routes: SettingsRoute[]) {
    this.routes = routes;
    this.buildFlatRoutes(routes);
    this.initializeDefaultSettings();
  }

  private buildFlatRoutes(routes: SettingsRoute[], parentPath: string = ''): void {
    routes.forEach(route => {
      const fullPath = parentPath + route.path;
      this.flatRoutes.set(fullPath, { ...route, path: fullPath });

      if (route.children) {
        this.buildFlatRoutes(route.children, fullPath);
      }
    });
  }

  getRoute(path: string): SettingsRoute | undefined {
    return this.flatRoutes.get(path);
  }

  getAllRoutes(): SettingsRoute[] {
    return this.routes;
  }

  getBreadcrumbs(path: string): Array<{ label: string; path: string }> {
    const breadcrumbs: Array<{ label: string; path: string }> = [];
    const parts = path.split('/').filter(Boolean);
    let currentPath = '';

    parts.forEach(part => {
      currentPath += '/' + part;
      const route = this.flatRoutes.get(currentPath);
      if (route) {
        breadcrumbs.push({
          label: route.label,
          path: currentPath,
        });
      }
    });

    return breadcrumbs;
  }

  search(query: string, userPermissions: SettingsPermission[]): SettingsSearchResult[] {
    if (!query.trim()) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const results: SettingsSearchResult[] = [];

    this.flatRoutes.forEach((route) => {
      if (route.permission && !userPermissions.includes(route.permission)) {
        return;
      }

      const searchableText = [
        route.label,
        route.description || '',
        ...(route.keywords || []),
        route.path,
      ].join(' ').toLowerCase();

      if (searchableText.includes(normalizedQuery)) {
        const score = this.calculateScore(normalizedQuery, route);
        const matchedTerms = this.getMatchedTerms(normalizedQuery, route);

        results.push({
          route,
          score,
          matchedTerms,
        });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  }

  private calculateScore(query: string, route: SettingsRoute): number {
    let score = 0;
    const labelLower = route.label.toLowerCase();
    const descriptionLower = (route.description || '').toLowerCase();

    if (labelLower === query) {
      score += 100;
    } else if (labelLower.startsWith(query)) {
      score += 50;
    } else if (labelLower.includes(query)) {
      score += 25;
    }

    if (descriptionLower.includes(query)) {
      score += 10;
    }

    if (route.keywords?.some(k => k.toLowerCase().includes(query))) {
      score += 15;
    }

    return score;
  }

  private getMatchedTerms(query: string, route: SettingsRoute): string[] {
    const terms: string[] = [];
    const queryWords = query.split(/\s+/);

    queryWords.forEach(word => {
      if (route.label.toLowerCase().includes(word)) {
        terms.push(route.label);
      }
      if (route.description?.toLowerCase().includes(word)) {
        terms.push('description');
      }
      if (route.keywords?.some(k => k.toLowerCase().includes(word))) {
        terms.push('keyword');
      }
    });

    return [...new Set(terms)];
  }

  filterByPermission(
    routes: SettingsRoute[],
    userPermissions: SettingsPermission[]
  ): SettingsRoute[] {
    return routes
      .filter(route => {
        if (!route.permission) return true;
        return userPermissions.includes(route.permission);
      })
      .map(route => ({
        ...route,
        children: route.children
          ? this.filterByPermission(route.children, userPermissions)
          : undefined,
      }))
      .filter(route => !route.children || route.children.length > 0);
  }

  // ==========================================================================
  // Default Settings Management
  // ==========================================================================

  /**
   * Initialize default settings for all scopes
   */
  private initializeDefaultSettings(): void {
    // User-level defaults
    this.defaultSettings.set('user.theme', 'system');
    this.defaultSettings.set('user.language', 'en');
    this.defaultSettings.set('user.timezone', 'UTC');
    this.defaultSettings.set('user.dateFormat', 'MM/DD/YYYY');
    this.defaultSettings.set('user.timeFormat', '12h');
    this.defaultSettings.set('user.notifications.email', true);
    this.defaultSettings.set('user.notifications.push', true);
    this.defaultSettings.set('user.notifications.slack', false);
    this.defaultSettings.set('user.accessibility.highContrast', false);
    this.defaultSettings.set('user.accessibility.fontSize', 'medium');
    this.defaultSettings.set('user.accessibility.reducedMotion', false);

    // Team-level defaults
    this.defaultSettings.set('team.defaultRole', 'member');
    this.defaultSettings.set('team.allowGuestAccess', false);
    this.defaultSettings.set('team.requireApproval', true);
    this.defaultSettings.set('team.notifications.mentions', true);
    this.defaultSettings.set('team.notifications.updates', true);
    this.defaultSettings.set('team.workflow.autoAssign', false);
    this.defaultSettings.set('team.workflow.defaultPriority', 'medium');

    // Organization-level defaults
    this.defaultSettings.set('organization.currency', 'USD');
    this.defaultSettings.set('organization.fiscalYearStart', '01-01');
    this.defaultSettings.set('organization.workingDays', ['mon', 'tue', 'wed', 'thu', 'fri']);
    this.defaultSettings.set('organization.workingHours.start', '09:00');
    this.defaultSettings.set('organization.workingHours.end', '17:00');
    this.defaultSettings.set('organization.security.mfaRequired', false);
    this.defaultSettings.set('organization.security.ssoRequired', false);
    this.defaultSettings.set('organization.security.sessionTimeout', 480); // 8 hours in minutes
    this.defaultSettings.set('organization.security.passwordPolicy.minLength', 8);
    this.defaultSettings.set('organization.security.passwordPolicy.requireUppercase', true);
    this.defaultSettings.set('organization.security.passwordPolicy.requireLowercase', true);
    this.defaultSettings.set('organization.security.passwordPolicy.requireNumbers', true);
    this.defaultSettings.set('organization.security.passwordPolicy.requireSymbols', false);
    this.defaultSettings.set('organization.billing.autoRenew', true);
    this.defaultSettings.set('organization.billing.invoiceEmail', '');
  }

  /**
   * Get default value for a setting key
   */
  getDefaultValue(key: string): any {
    return this.defaultSettings.get(key);
  }

  /**
   * Set default value for a setting key
   */
  setDefaultValue(key: string, value: any): void {
    this.defaultSettings.set(key, value);
  }

  // ==========================================================================
  // Settings Loading with Tenant Overrides
  // ==========================================================================

  /**
   * Load setting with tenant override cascade
   * Priority: User > Team > Organization > System Default
   */
  async loadSetting(
    key: string,
    context: SettingsContext
  ): Promise<any> {
    // Check cache first
    const cacheKey = this.getCacheKey(key, context);
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Try to load from database with priority cascade
    let value: any = null;

    // 1. User-level override
    if (context.userId) {
      value = await this.loadFromDatabase(key, 'user', context.userId);
      if (value !== null) {
        this.setCache(cacheKey, value);
        return value;
      }
    }

    // 2. Team-level override
    if (context.teamId) {
      value = await this.loadFromDatabase(key, 'team', context.teamId);
      if (value !== null) {
        this.setCache(cacheKey, value);
        return value;
      }
    }

    // 3. Organization-level override
    if (context.organizationId) {
      value = await this.loadFromDatabase(key, 'organization', context.organizationId);
      if (value !== null) {
        this.setCache(cacheKey, value);
        return value;
      }
    }

    // 4. System default
    value = this.getDefaultValue(key);
    this.setCache(cacheKey, value);
    return value;
  }

  /**
   * Load multiple settings at once
   */
  async loadSettings(
    keys: string[],
    context: SettingsContext
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.loadSetting(key, context);
      })
    );

    return results;
  }

  /**
   * Save setting to database
   */
  async saveSetting(
    key: string,
    value: any,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<void> {
    // Determine the appropriate table based on scope
    const table = this.getTableForScope(scope);
    
    // For user preferences, update the user_preferences JSONB column
    if (scope === 'user' && table === 'users') {
      const { data: user } = await supabase
        .from('users')
        .select('user_preferences')
        .eq('id', scopeId)
        .single();

      const preferences = user?.user_preferences || {};
      const updatedPreferences = this.setNestedValue(preferences, key, value);

      await supabase
        .from('users')
        .update({
          user_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scopeId);
    }
    // For team settings, update the team_settings JSONB column
    else if (scope === 'team' && table === 'teams') {
      const { data: team } = await supabase
        .from('teams')
        .select('team_settings')
        .eq('id', scopeId)
        .single();

      const settings = team?.team_settings || {};
      const updatedSettings = this.setNestedValue(settings, key, value);

      await supabase
        .from('teams')
        .update({
          team_settings: updatedSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scopeId);
    }
    // For organization settings, update the organization_settings JSONB column
    else if (scope === 'organization' && table === 'organizations') {
      const { data: org } = await supabase
        .from('organizations')
        .select('organization_settings')
        .eq('id', scopeId)
        .single();

      const settings = org?.organization_settings || {};
      const updatedSettings = this.setNestedValue(settings, key, value);

      await supabase
        .from('organizations')
        .update({
          organization_settings: updatedSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scopeId);
    }

    // Invalidate cache
    const context: SettingsContext = {
      userId: scope === 'user' ? scopeId : undefined,
      teamId: scope === 'team' ? scopeId : undefined,
      organizationId: scope === 'organization' ? scopeId : undefined,
    };
    const cacheKey = this.getCacheKey(key, context);
    this.invalidateCache(cacheKey);
  }

  /**
   * Delete setting (revert to default)
   */
  async deleteSetting(
    key: string,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<void> {
    const table = this.getTableForScope(scope);
    
    if (scope === 'user' && table === 'users') {
      const { data: user } = await supabase
        .from('users')
        .select('user_preferences')
        .eq('id', scopeId)
        .single();

      const preferences = user?.user_preferences || {};
      const updatedPreferences = this.deleteNestedValue(preferences, key);

      await supabase
        .from('users')
        .update({
          user_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scopeId);
    } else if (scope === 'team' && table === 'teams') {
      const { data: team } = await supabase
        .from('teams')
        .select('team_settings')
        .eq('id', scopeId)
        .single();

      const settings = team?.team_settings || {};
      const updatedSettings = this.deleteNestedValue(settings, key);

      await supabase
        .from('teams')
        .update({
          team_settings: updatedSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scopeId);
    } else if (scope === 'organization' && table === 'organizations') {
      const { data: org } = await supabase
        .from('organizations')
        .select('organization_settings')
        .eq('id', scopeId)
        .single();

      const settings = org?.organization_settings || {};
      const updatedSettings = this.deleteNestedValue(settings, key);

      await supabase
        .from('organizations')
        .update({
          organization_settings: updatedSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scopeId);
    }

    // Invalidate cache
    const context: SettingsContext = {
      userId: scope === 'user' ? scopeId : undefined,
      teamId: scope === 'team' ? scopeId : undefined,
      organizationId: scope === 'organization' ? scopeId : undefined,
    };
    const cacheKey = this.getCacheKey(key, context);
    this.invalidateCache(cacheKey);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async loadFromDatabase(
    key: string,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<any> {
    const table = this.getTableForScope(scope);
    const column = this.getColumnForScope(scope);

    const { data, error } = await supabase
      .from(table)
      .select(column)
      .eq('id', scopeId)
      .single();

    if (error || !data) {
      return null;
    }

    const settings = data[column] || {};
    return this.getNestedValue(settings, key);
  }

  private getTableForScope(scope: 'user' | 'team' | 'organization'): string {
    const tableMap = {
      user: 'users',
      team: 'teams',
      organization: 'organizations',
    };
    return tableMap[scope];
  }

  private getColumnForScope(scope: 'user' | 'team' | 'organization'): string {
    const columnMap = {
      user: 'user_preferences',
      team: 'team_settings',
      organization: 'organization_settings',
    };
    return columnMap[scope];
  }

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return null;
      }
      current = current[key];
    }

    return current !== undefined ? current : null;
  }

  private setNestedValue(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const result = { ...obj };
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      } else {
        current[key] = { ...current[key] };
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return result;
  }

  private deleteNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    const result = { ...obj };
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        return result;
      }
      current[key] = { ...current[key] };
      current = current[key];
    }

    delete current[keys[keys.length - 1]];
    return result;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  private getCacheKey(key: string, context: SettingsContext): string {
    const parts = [key];
    if (context.userId) parts.push(`user:${context.userId}`);
    if (context.teamId) parts.push(`team:${context.teamId}`);
    if (context.organizationId) parts.push(`org:${context.organizationId}`);
    return parts.join('|');
  }

  private getFromCache(cacheKey: string): any {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (expiry && Date.now() > expiry) {
      this.settingsCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      return undefined;
    }

    const cached = this.settingsCache.get(cacheKey);
    return cached?.value;
  }

  private setCache(cacheKey: string, value: any): void {
    this.settingsCache.set(cacheKey, { key: cacheKey, value, scope: 'system' });
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);
  }

  private invalidateCache(cacheKey: string): void {
    this.settingsCache.delete(cacheKey);
    this.cacheExpiry.delete(cacheKey);
  }

  clearCache(): void {
    this.settingsCache.clear();
    this.cacheExpiry.clear();
  }
}

export const settingsRoutes: SettingsRoute[] = [
  {
    id: 'user',
    path: '/user',
    label: 'My Account',
    tier: 'user',
    icon: 'User',
    children: [
      {
        id: 'user-profile',
        path: '/profile',
        label: 'Profile',
        description: 'Manage your personal information and avatar',
        tier: 'user',
        keywords: ['name', 'email', 'avatar', 'picture', 'display name'],
        component: 'UserProfile',
      },
      {
        id: 'user-security',
        path: '/security',
        label: 'Account Security',
        description: 'Password, two-factor authentication, and active sessions',
        tier: 'user',
        keywords: ['password', 'mfa', '2fa', 'sessions', 'login', 'authentication'],
        component: 'UserSecurity',
      },
      {
        id: 'user-notifications',
        path: '/notifications',
        label: 'Notifications',
        description: 'Control your notification preferences',
        tier: 'user',
        keywords: ['email', 'push', 'slack', 'alerts', 'mute'],
        component: 'UserNotifications',
      },
      {
        id: 'user-appearance',
        path: '/appearance',
        label: 'Appearance & Accessibility',
        description: 'Theme, language, and accessibility settings',
        tier: 'user',
        keywords: ['theme', 'dark mode', 'light mode', 'language', 'accessibility', 'font'],
        component: 'UserAppearance',
      },
      {
        id: 'user-apps',
        path: '/authorized-apps',
        label: 'Authorized Apps',
        description: 'Manage third-party applications with access to your account',
        tier: 'user',
        keywords: ['oauth', 'third party', 'connected', 'integrations'],
        component: 'UserAuthorizedApps',
      },
    ],
  },
  {
    id: 'team',
    path: '/team',
    label: 'Workspace',
    tier: 'team',
    icon: 'Users',
    permission: 'team.view',
    children: [
      {
        id: 'team-general',
        path: '/general',
        label: 'General',
        description: 'Workspace name, icon, and basic settings',
        tier: 'team',
        permission: 'team.view',
        keywords: ['workspace name', 'team name', 'icon'],
        component: 'TeamGeneral',
      },
      {
        id: 'team-members',
        path: '/members',
        label: 'Members',
        description: 'Invite and manage workspace members',
        tier: 'team',
        permission: 'team.manage',
        keywords: ['invite', 'users', 'people', 'roles'],
        component: 'TeamMembers',
      },
      {
        id: 'team-permissions',
        path: '/permissions',
        label: 'Permissions',
        description: 'Configure role permissions and access control',
        tier: 'team',
        permission: 'team.manage',
        keywords: ['roles', 'access', 'security', 'permissions matrix'],
        component: 'TeamPermissions',
      },
      {
        id: 'team-integrations',
        path: '/integrations',
        label: 'Integrations',
        description: 'Connect apps and services to this workspace',
        tier: 'team',
        permission: 'team.manage',
        keywords: ['slack', 'github', 'apps', 'connections'],
        component: 'TeamIntegrations',
      },
      {
        id: 'team-settings',
        path: '/settings',
        label: 'Settings',
        description: 'Notification preferences and workflow configuration',
        tier: 'team',
        permission: 'team.manage',
        keywords: ['notifications', 'workflow', 'defaults', 'automation'],
        component: 'TeamSettings',
      },
      {
        id: 'team-audit-logs',
        path: '/audit-logs',
        label: 'Audit Logs',
        description: 'View workspace activity and member actions',
        tier: 'team',
        permission: 'team.manage',
        keywords: ['activity', 'history', 'logs', 'compliance'],
        component: 'TeamAuditLog',
      },
    ],
  },
  {
    id: 'organization',
    path: '/organization',
    label: 'Organization',
    tier: 'organization',
    icon: 'Building2',
    permission: 'organization.manage',
    children: [
      {
        id: 'org-general',
        path: '/general',
        label: 'General',
        description: 'Organization name, logo, and company settings',
        tier: 'organization',
        permission: 'organization.manage',
        keywords: ['company', 'logo', 'branding'],
        component: 'OrganizationGeneral',
      },
      {
        id: 'org-members',
        path: '/members',
        label: 'Members & Access',
        description: 'Manage all users across the organization',
        tier: 'organization',
        permission: 'members.manage',
        keywords: ['users', 'directory', 'invite', 'deactivate'],
        component: 'OrganizationUsers',
      },
      {
        id: 'org-roles',
        path: '/roles',
        label: 'Roles & Permissions',
        description: 'Define roles and permission matrix',
        tier: 'organization',
        permission: 'members.manage',
        keywords: ['roles', 'permissions', 'access control', 'custom roles'],
        component: 'OrganizationRoles',
      },
      {
        id: 'org-security',
        path: '/security',
        label: 'Security & Authentication',
        description: 'SSO, MFA requirements, and security policies',
        tier: 'organization',
        permission: 'security.manage',
        keywords: ['sso', 'saml', 'mfa', 'password policy', 'session'],
        component: 'OrganizationSecurity',
      },
      {
        id: 'org-audit',
        path: '/audit-logs',
        label: 'Audit Logs',
        description: 'View and export organization activity logs',
        tier: 'organization',
        permission: 'audit.view',
        keywords: ['compliance', 'history', 'activity', 'export'],
        component: 'OrganizationAuditLogs',
      },
      {
        id: 'org-billing',
        path: '/billing',
        label: 'Billing & Subscription',
        description: 'Manage plan, invoices, and payment methods',
        tier: 'organization',
        permission: 'billing.manage',
        keywords: ['plan', 'invoice', 'payment', 'subscription', 'upgrade'],
        component: 'OrganizationBilling',
      },
      {
        id: 'org-integrations',
        path: '/integrations',
        label: 'Integrations & API',
        description: 'Organization-wide integrations, API keys, and webhooks',
        tier: 'organization',
        permission: 'integrations.manage',
        keywords: ['api', 'webhooks', 'marketplace', 'apps'],
        component: 'OrganizationIntegrations',
      },
    ],
  },
];

export const settingsRegistry = new SettingsRegistry(settingsRoutes);

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to access and manage a single setting
 * 
 * @example
 * ```tsx
 * const { value, loading, update } = useSettings('user.theme', {
 *   userId: currentUser.id
 * });
 * 
 * // Update setting
 * await update('dark');
 * ```
 */
export function useSettings<T = any>(
  key: string,
  context: SettingsContext,
  options: {
    scope?: 'user' | 'team' | 'organization';
    defaultValue?: T;
  } = {}
): UseSettingsResult<T> {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load setting on mount and when dependencies change
  useEffect(() => {
    let mounted = true;

    async function loadSetting() {
      try {
        setLoading(true);
        setError(null);

        const loadedValue = await settingsRegistry.loadSetting(key, context);
        
        if (mounted) {
          setValue(loadedValue ?? options.defaultValue ?? null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setValue(options.defaultValue ?? null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSetting();

    return () => {
      mounted = false;
    };
  }, [key, context.userId, context.teamId, context.organizationId]);

  // Update setting
  const update = async (newValue: T): Promise<void> => {
    try {
      setError(null);

      // Determine scope and scopeId
      const scope = options.scope || inferScope(context);
      const scopeId = getScopeId(context, scope);

      if (!scopeId) {
        throw new Error(`No ${scope} ID provided in context`);
      }

      await settingsRegistry.saveSetting(key, newValue, scope, scopeId);
      setValue(newValue);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  // Reset to default
  const reset = async (): Promise<void> => {
    try {
      setError(null);

      const scope = options.scope || inferScope(context);
      const scopeId = getScopeId(context, scope);

      if (!scopeId) {
        throw new Error(`No ${scope} ID provided in context`);
      }

      await settingsRegistry.deleteSetting(key, scope, scopeId);
      
      // Reload from cascade
      const loadedValue = await settingsRegistry.loadSetting(key, context);
      setValue(loadedValue ?? options.defaultValue ?? null);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    value,
    loading,
    error,
    update,
    reset,
  };
}

/**
 * Hook to access and manage multiple settings
 * 
 * @example
 * ```tsx
 * const { values, loading, updateSetting } = useSettingsGroup(
 *   ['user.theme', 'user.language', 'user.timezone'],
 *   { userId: currentUser.id }
 * );
 * 
 * // Access values
 * logger.debug(values['user.theme']);
 * 
 * // Update a setting
 * await updateSetting('user.theme', 'dark');
 * ```
 */
export function useSettingsGroup(
  keys: string[],
  context: SettingsContext,
  options: {
    scope?: 'user' | 'team' | 'organization';
  } = {}
): {
  values: Record<string, any>;
  loading: boolean;
  error: Error | null;
  updateSetting: (key: string, value: any) => Promise<void>;
  resetSetting: (key: string) => Promise<void>;
} {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load settings on mount
  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        setLoading(true);
        setError(null);

        const loadedValues = await settingsRegistry.loadSettings(keys, context);
        
        if (mounted) {
          setValues(loadedValues);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [keys.join(','), context.userId, context.teamId, context.organizationId]);

  // Update a single setting
  const updateSetting = async (key: string, value: any): Promise<void> => {
    try {
      setError(null);

      const scope = options.scope || inferScope(context);
      const scopeId = getScopeId(context, scope);

      if (!scopeId) {
        throw new Error(`No ${scope} ID provided in context`);
      }

      await settingsRegistry.saveSetting(key, value, scope, scopeId);
      
      setValues(prev => ({
        ...prev,
        [key]: value,
      }));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  // Reset a single setting
  const resetSetting = async (key: string): Promise<void> => {
    try {
      setError(null);

      const scope = options.scope || inferScope(context);
      const scopeId = getScopeId(context, scope);

      if (!scopeId) {
        throw new Error(`No ${scope} ID provided in context`);
      }

      await settingsRegistry.deleteSetting(key, scope, scopeId);
      
      // Reload from cascade
      const loadedValue = await settingsRegistry.loadSetting(key, context);
      
      setValues(prev => ({
        ...prev,
        [key]: loadedValue,
      }));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  };

  return {
    values,
    loading,
    error,
    updateSetting,
    resetSetting,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function inferScope(context: SettingsContext): 'user' | 'team' | 'organization' {
  if (context.userId) return 'user';
  if (context.teamId) return 'team';
  if (context.organizationId) return 'organization';
  return 'user'; // Default to user
}

function getScopeId(
  context: SettingsContext,
  scope: 'user' | 'team' | 'organization'
): string | undefined {
  switch (scope) {
    case 'user':
      return context.userId;
    case 'team':
      return context.teamId;
    case 'organization':
      return context.organizationId;
  }
}

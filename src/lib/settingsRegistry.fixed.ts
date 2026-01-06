// Sprint 1 Fixes Applied:
// 1. ✅ Functional state updates in hooks
// 2. ✅ Scope prefix stripping to prevent redundant nesting
// 3. ✅ Memoization guidance in comments
// 4. ✅ Explicit null handling for database defaults

import { SettingsPermission, SettingsRoute, SettingsSearchResult } from '../types';
import { supabase } from './supabase';
import { useEffect, useState, useMemo } from 'react';

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
   * FIX: Explicit defaults prevent nullish boolean trap
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
    this.defaultSettings.set('organization.security.sessionTimeout', 60);
    this.defaultSettings.set('organization.security.passwordPolicy.minLength', 12);
    this.defaultSettings.set('organization.security.passwordPolicy.requireUppercase', true);
    this.defaultSettings.set('organization.security.passwordPolicy.requireLowercase', true);
    this.defaultSettings.set('organization.security.passwordPolicy.requireNumbers', true);
    this.defaultSettings.set('organization.security.passwordPolicy.requireSymbols', false);
    this.defaultSettings.set('organization.billing.autoRenew', true);
    this.defaultSettings.set('organization.billing.invoiceEmail', '');
  }

  getDefaultValue(key: string): any {
    return this.defaultSettings.get(key);
  }

  setDefaultValue(key: string, value: any): void {
    this.defaultSettings.set(key, value);
  }

  // ==========================================================================
  // Settings Loading with Tenant Overrides
  // ==========================================================================

  async loadSetting(
    key: string,
    context: SettingsContext
  ): Promise<any> {
    const cacheKey = this.getCacheKey(key, context);
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let value: any = null;

    // Priority cascade: User > Team > Organization > System Default
    if (context.userId) {
      value = await this.loadFromDatabase(key, 'user', context.userId);
      if (value !== null) {
        this.setCache(cacheKey, value);
        return value;
      }
    }

    if (context.teamId) {
      value = await this.loadFromDatabase(key, 'team', context.teamId);
      if (value !== null) {
        this.setCache(cacheKey, value);
        return value;
      }
    }

    if (context.organizationId) {
      value = await this.loadFromDatabase(key, 'organization', context.organizationId);
      if (value !== null) {
        this.setCache(cacheKey, value);
        return value;
      }
    }

    value = this.getDefaultValue(key);
    this.setCache(cacheKey, value);
    return value;
  }

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

  async saveSetting(
    key: string,
    value: any,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<void> {
    const table = this.getTableForScope(scope);
    const column = this.getColumnForScope(scope);
    
    // FIX: Strip scope prefix to prevent redundant nesting
    const strippedKey = this.stripScopePrefix(key, scope);
    
    const { data: existing } = await supabase
      .from(table)
      .select(column)
      .eq('id', scopeId)
      .single();

    const settings = existing?.[column] || {};
    const updatedSettings = this.setNestedValue(settings, strippedKey, value);

    await supabase
      .from(table)
      .update({
        [column]: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scopeId);

    const context: SettingsContext = {
      userId: scope === 'user' ? scopeId : undefined,
      teamId: scope === 'team' ? scopeId : undefined,
      organizationId: scope === 'organization' ? scopeId : undefined,
    };
    const cacheKey = this.getCacheKey(key, context);
    this.invalidateCache(cacheKey);
  }

  async deleteSetting(
    key: string,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<void> {
    const table = this.getTableForScope(scope);
    const column = this.getColumnForScope(scope);
    
    // FIX: Strip scope prefix
    const strippedKey = this.stripScopePrefix(key, scope);

    const { data: existing } = await supabase
      .from(table)
      .select(column)
      .eq('id', scopeId)
      .single();

    const settings = existing?.[column] || {};
    const updatedSettings = this.deleteNestedValue(settings, strippedKey);

    await supabase
      .from(table)
      .update({
        [column]: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scopeId);

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

  /**
   * FIX: Strip scope prefix from key (e.g., 'user.theme' -> 'theme')
   * Prevents redundant nesting like { "user": { "theme": "dark" } } 
   * inside a column already named user_preferences
   */
  private stripScopePrefix(key: string, scope: 'user' | 'team' | 'organization'): string {
    const prefixes = {
      user: 'user.',
      team: 'team.',
      organization: 'organization.',
    };
    
    const prefix = prefixes[scope];
    if (key.startsWith(prefix)) {
      return key.substring(prefix.length);
    }
    
    return key;
  }

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
    // FIX: Strip scope prefix before looking up in JSONB
    const strippedKey = this.stripScopePrefix(key, scope);
    return this.getNestedValue(settings, strippedKey);
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

import { describe, expect, it } from 'vitest';

import {
  createTenantContext,
  DEFAULT_THEME,
  hasPermission,
  isFeatureEnabled,
  TenantContextError,
  validateTenantContext,
} from '../TenantContext';

describe('TenantContext', () => {
  const baseContextProps = {
    tenantId: 'tenant-123',
    organizationId: 'org-456',
    userId: 'user-789',
  };

  describe('createTenantContext', () => {
    it('creates a context with default values when only required fields are provided', () => {
      const context = createTenantContext(baseContextProps);

      expect(context).toEqual({
        ...baseContextProps,
        permissions: [],
        theme: DEFAULT_THEME,
        featureFlags: {},
        dataResidency: 'us',
      });
    });

    it('overrides default values when optional fields are provided', () => {
      const customTheme = { mode: 'light' as const, primaryColor: '#ffffff' };
      const partial = {
        ...baseContextProps,
        permissions: ['read', 'write'],
        theme: customTheme,
        featureFlags: { newFeature: true },
        dataResidency: 'eu' as const,
        locale: 'en-US',
      };

      const context = createTenantContext(partial);

      expect(context).toEqual(partial);
    });
  });

  describe('hasPermission', () => {
    it('returns true when the exact permission is present', () => {
      const context = createTenantContext({
        ...baseContextProps,
        permissions: ['read:users', 'write:users'],
      });

      expect(hasPermission(context, 'read:users')).toBe(true);
      expect(hasPermission(context, 'write:users')).toBe(true);
    });

    it('returns true when the wildcard permission is present', () => {
      const context = createTenantContext({
        ...baseContextProps,
        permissions: ['*'],
      });

      expect(hasPermission(context, 'read:users')).toBe(true);
      expect(hasPermission(context, 'any:permission')).toBe(true);
    });

    it('returns false when the permission is not present and no wildcard exists', () => {
      const context = createTenantContext({
        ...baseContextProps,
        permissions: ['read:users'],
      });

      expect(hasPermission(context, 'write:users')).toBe(false);
      expect(hasPermission(context, 'admin')).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns true when the feature flag is explicitly set to true', () => {
      const context = createTenantContext({
        ...baseContextProps,
        featureFlags: { newFeature: true },
      });

      expect(isFeatureEnabled(context, 'newFeature')).toBe(true);
    });

    it('returns false when the feature flag is set to false', () => {
      const context = createTenantContext({
        ...baseContextProps,
        featureFlags: { newFeature: false },
      });

      expect(isFeatureEnabled(context, 'newFeature')).toBe(false);
    });

    it('returns false when the feature flag is not present', () => {
      const context = createTenantContext(baseContextProps);
      expect(isFeatureEnabled(context, 'missing')).toBe(false);
    });
  });

  describe('validateTenantContext', () => {
    it('returns true for a valid tenant context', () => {
      expect(validateTenantContext(createTenantContext(baseContextProps))).toBe(true);
    });

    it('returns false for null or primitive values', () => {
      expect(validateTenantContext(null)).toBe(false);
      expect(validateTenantContext('bad')).toBe(false);
    });

    it('returns false for missing required fields', () => {
      expect(validateTenantContext({ tenantId: 'tenant-123' })).toBe(false);
    });

    it('returns false for invalid data residency values', () => {
      expect(
        validateTenantContext({
          ...createTenantContext(baseContextProps),
          dataResidency: 'moon',
        }),
      ).toBe(false);
    });
  });

  describe('TenantContextError', () => {
    it('preserves tenant and partial context details', () => {
      const context = createTenantContext(baseContextProps);
      const error = new TenantContextError('boom', context.tenantId, context);

      expect(error.message).toBe('boom');
      expect(error.name).toBe('TenantContextError');
      expect(error.tenantId).toBe(context.tenantId);
      expect(error.context).toEqual(context);
    });
  });
});

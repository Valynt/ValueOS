import { describe, it, expect } from 'vitest';
import {
  createTenantContext,
  hasPermission,
  isFeatureEnabled,
  validateTenantContext,
  TenantContextError,
  DEFAULT_THEME,
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
      const context = createTenantContext({
        ...baseContextProps,
        featureFlags: {},
      });

      expect(isFeatureEnabled(context, 'newFeature')).toBe(false);
    });
  });

  describe('validateTenantContext', () => {
    it('returns true for a valid context', () => {
      const context = createTenantContext(baseContextProps);
      expect(validateTenantContext(context)).toBe(true);
    });

    it('returns false for null or undefined', () => {
      expect(validateTenantContext(null)).toBe(false);
      expect(validateTenantContext(undefined)).toBe(false);
    });

    it('returns false for non-object inputs', () => {
      expect(validateTenantContext('string')).toBe(false);
      expect(validateTenantContext(123)).toBe(false);
      expect(validateTenantContext(true)).toBe(false);
    });

    it('returns false when required fields are missing', () => {
      expect(validateTenantContext({ organizationId: 'org', userId: 'user' })).toBe(false);
      expect(validateTenantContext({ tenantId: 'tenant', userId: 'user' })).toBe(false);
      expect(validateTenantContext({ tenantId: 'tenant', organizationId: 'org' })).toBe(false);
    });

    it('returns false when fields are of incorrect type', () => {
      const context = createTenantContext(baseContextProps);

      expect(validateTenantContext({ ...context, permissions: 'not-an-array' })).toBe(false);
      expect(validateTenantContext({ ...context, theme: 'not-an-object' })).toBe(false);
      expect(validateTenantContext({ ...context, featureFlags: 'not-an-object' })).toBe(false);
      expect(validateTenantContext({ ...context, tenantId: 123 })).toBe(false);
    });

    it('returns false when dataResidency is invalid', () => {
      const context = createTenantContext(baseContextProps);

      expect(validateTenantContext({ ...context, dataResidency: 'invalid-region' })).toBe(false);
      expect(validateTenantContext({ ...context, dataResidency: null })).toBe(false);
    });

    it('returns true for valid dataResidency values', () => {
      const context = createTenantContext(baseContextProps);

      expect(validateTenantContext({ ...context, dataResidency: 'us' })).toBe(true);
      expect(validateTenantContext({ ...context, dataResidency: 'eu' })).toBe(true);
      expect(validateTenantContext({ ...context, dataResidency: 'apac' })).toBe(true);
    });
  });

  describe('TenantContextError', () => {
    it('initializes correctly with message', () => {
      const error = new TenantContextError('Something went wrong');

      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('TenantContextError');
      expect(error.tenantId).toBeUndefined();
      expect(error.context).toBeUndefined();
    });

    it('initializes correctly with message, tenantId, and context', () => {
      const partialContext = { tenantId: 'tenant-123', dataResidency: 'us' as const };
      const error = new TenantContextError('Something went wrong', 'tenant-123', partialContext);

      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('TenantContextError');
      expect(error.tenantId).toBe('tenant-123');
      expect(error.context).toEqual(partialContext);
    });
  });
});
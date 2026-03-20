import { describe, it, expect } from 'vitest';
import {
  createTenantContext,
  hasPermission,
  isFeatureEnabled,
  validateTenantContext,
  TenantContextError,
  DEFAULT_THEME,
  TenantContext,
} from '../TenantContext';

describe('TenantContext', () => {
  describe('createTenantContext', () => {
    it('should create a context with default values', () => {
      const partial = {
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
      };

      const context = createTenantContext(partial);

      expect(context).toEqual({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        permissions: [],
        theme: DEFAULT_THEME,
        featureFlags: {},
        dataResidency: 'us',
      });
    });

    it('should allow overriding default values', () => {
      const partial = {
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        permissions: ['read:data'],
        theme: {
          mode: 'light' as const,
          primaryColor: '#ffffff',
        },
        featureFlags: { newFeature: true },
        dataResidency: 'eu' as const,
        locale: 'en-US',
      };

      const context = createTenantContext(partial);

      expect(context).toEqual(partial);
    });
  });

  describe('hasPermission', () => {
    it('should return true if the user has the exact permission', () => {
      const context = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        permissions: ['read:data', 'write:data'],
      });

      expect(hasPermission(context, 'read:data')).toBe(true);
      expect(hasPermission(context, 'write:data')).toBe(true);
    });

    it('should return false if the user does not have the exact permission', () => {
      const context = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        permissions: ['read:data'],
      });

      expect(hasPermission(context, 'write:data')).toBe(false);
    });

    it('should return true if the user has the wildcard permission (*)', () => {
      const context = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        permissions: ['*'],
      });

      expect(hasPermission(context, 'any:permission')).toBe(true);
      expect(hasPermission(context, 'admin:access')).toBe(true);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true if the feature flag is explicitly set to true', () => {
      const context = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        featureFlags: { newFeature: true, oldFeature: false },
      });

      expect(isFeatureEnabled(context, 'newFeature')).toBe(true);
    });

    it('should return false if the feature flag is set to false', () => {
      const context = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        featureFlags: { newFeature: true, oldFeature: false },
      });

      expect(isFeatureEnabled(context, 'oldFeature')).toBe(false);
    });

    it('should return false if the feature flag is not defined', () => {
      const context = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
        featureFlags: {},
      });

      expect(isFeatureEnabled(context, 'unknownFeature')).toBe(false);
    });
  });

  describe('validateTenantContext', () => {
    it('should return true for a valid context', () => {
      const validContext = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
      });

      expect(validateTenantContext(validContext)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(validateTenantContext(null)).toBe(false);
      expect(validateTenantContext(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(validateTenantContext('string')).toBe(false);
      expect(validateTenantContext(123)).toBe(false);
      expect(validateTenantContext(true)).toBe(false);
    });

    it('should return false if missing required fields', () => {
      const invalidContext = {
        tenantId: 't-1',
        // organizationId is missing
        userId: 'u-1',
        permissions: [],
        theme: DEFAULT_THEME,
        featureFlags: {},
        dataResidency: 'us',
      };

      expect(validateTenantContext(invalidContext)).toBe(false);
    });

    it('should return false if field types are incorrect', () => {
      const validContext = createTenantContext({
        tenantId: 't-1',
        organizationId: 'o-1',
        userId: 'u-1',
      });

      expect(validateTenantContext({ ...validContext, permissions: 'not-an-array' })).toBe(false);
      expect(validateTenantContext({ ...validContext, theme: 'not-an-object' })).toBe(false);
      expect(validateTenantContext({ ...validContext, featureFlags: 'not-an-object' })).toBe(false);
      expect(validateTenantContext({ ...validContext, dataResidency: 'invalid-region' })).toBe(false);
    });
  });

  describe('TenantContextError', () => {
    it('should correctly construct an error with given properties', () => {
      const message = 'Invalid context';
      const tenantId = 't-1';
      const context = { userId: 'u-1' };

      const error = new TenantContextError(message, tenantId, context);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TenantContextError');
      expect(error.message).toBe(message);
      expect(error.tenantId).toBe(tenantId);
      expect(error.context).toEqual(context);
    });

    it('should correctly construct an error with only message', () => {
      const message = 'Invalid context';

      const error = new TenantContextError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TenantContextError');
      expect(error.message).toBe(message);
      expect(error.tenantId).toBeUndefined();
      expect(error.context).toBeUndefined();
    });
  });
});

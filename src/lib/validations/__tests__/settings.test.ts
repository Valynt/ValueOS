/**
 * Settings Validation Tests
 * 
 * Tests Zod schemas for runtime type safety
 */

import { describe, it, expect } from 'vitest';
import {
  OrgSecuritySchema,
  UserProfileSchema,
  TeamWorkflowSchema,
  validateSettings,
  parseSettingsWithDefaults,
  getTemplate,
  listTemplates,
} from '../settings';

describe('Settings Validation', () => {
  describe('OrgSecuritySchema', () => {
    it('validates correct security settings', () => {
      const validSettings = {
        enforceMFA: true,
        enforceSSO: false,
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: false,
          expiryDays: 90,
        },
        sessionManagement: {
          sessionTimeoutMinutes: 60,
          idleTimeoutMinutes: 30,
          maxConcurrentSessions: 3,
        },
        ipWhitelistEnabled: false,
        ipWhitelist: [],
        webAuthnEnabled: false,
      };

      const result = OrgSecuritySchema.safeParse(validSettings);
      expect(result.success).toBe(true);
    });

    it('rejects invalid password length', () => {
      const invalidSettings = {
        enforceMFA: false,
        enforceSSO: false,
        passwordPolicy: {
          minLength: 5, // Too short (min is 8)
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: false,
          expiryDays: 90,
        },
        sessionManagement: {
          sessionTimeoutMinutes: 60,
          idleTimeoutMinutes: 30,
          maxConcurrentSessions: 3,
        },
        ipWhitelistEnabled: false,
        ipWhitelist: [],
        webAuthnEnabled: false,
      };

      const result = OrgSecuritySchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
    });

    it('applies default values', () => {
      const minimalSettings = {};
      const result = OrgSecuritySchema.parse(minimalSettings);
      
      expect(result.enforceMFA).toBe(false);
      expect(result.passwordPolicy.minLength).toBe(12);
      expect(result.sessionManagement.sessionTimeoutMinutes).toBe(60);
    });
  });

  describe('UserProfileSchema', () => {
    it('validates email format', () => {
      const invalidProfile = {
        displayName: 'John Doe',
        email: 'not-an-email', // Invalid email
      };

      const result = UserProfileSchema.safeParse(invalidProfile);
      expect(result.success).toBe(false);
    });

    it('accepts valid profile', () => {
      const validProfile = {
        displayName: 'John Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        language: 'en' as const,
      };

      const result = UserProfileSchema.safeParse(validProfile);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Helpers', () => {
    it('validateSettings returns detailed errors', () => {
      const invalidData = {
        minLength: 5, // Too short
      };

      const result = validateSettings(
        OrgSecuritySchema,
        invalidData,
        'security'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('parseSettingsWithDefaults returns defaults on error', () => {
      const invalidData = { invalid: 'data' };
      
      const result = parseSettingsWithDefaults(
        TeamWorkflowSchema,
        invalidData
      );

      expect(result.defaultTaskStatus).toBe('todo');
      expect(result.archiveDays).toBe(90);
    });
  });

  describe('Settings Templates', () => {
    it('lists all templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBe(3);
      expect(templates.map(t => t.id)).toContain('standard');
      expect(templates.map(t => t.id)).toContain('strict');
      expect(templates.map(t => t.id)).toContain('creative');
    });

    it('gets template by ID', () => {
      const template = getTemplate('strict');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Strict');
      expect(template?.settings.security.enforceMFA).toBe(true);
    });

    it('returns null for invalid template ID', () => {
      const template = getTemplate('nonexistent');
      expect(template).toBeNull();
    });

    it('strict template has higher security', () => {
      const strict = getTemplate('strict');
      const standard = getTemplate('standard');
      
      expect(strict?.settings.security.enforceMFA).toBe(true);
      expect(standard?.settings.security.enforceMFA).toBe(false);
      
      expect(strict?.settings.security.passwordPolicy.minLength).toBeGreaterThan(
        standard?.settings.security.passwordPolicy.minLength || 0
      );
    });
  });
});

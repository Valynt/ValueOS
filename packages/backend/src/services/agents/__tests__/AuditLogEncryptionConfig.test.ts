import { describe, expect, it, vi } from 'vitest';
import {
  AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV,
  isAuditLogEncryptionEnabled,
  isAuditLogEncryptionTestEnvironment,
  isAuditLogEncryptionTestFallbackEnabled,
  validateAuditLogEncryptionConfig,
  resolveAuditLogEncryptionKey,
} from '../AuditLogEncryptionConfig.js';

vi.mock('../../../lib/crypto/CryptoUtils.js', () => ({
  generateEncryptionKey: vi.fn(() => 'mock-generated-key'),
}));

describe('AuditLogEncryptionConfig', () => {
  describe('isAuditLogEncryptionEnabled', () => {
    it('returns true when AUDIT_LOG_ENCRYPTION_ENABLED is "true"', () => {
      expect(isAuditLogEncryptionEnabled({ AUDIT_LOG_ENCRYPTION_ENABLED: 'true' })).toBe(true);
    });

    it('returns false when AUDIT_LOG_ENCRYPTION_ENABLED is not "true"', () => {
      expect(isAuditLogEncryptionEnabled({})).toBe(false);
      expect(isAuditLogEncryptionEnabled({ AUDIT_LOG_ENCRYPTION_ENABLED: 'false' })).toBe(false);
      expect(isAuditLogEncryptionEnabled({ AUDIT_LOG_ENCRYPTION_ENABLED: '1' })).toBe(false);
    });
  });

  describe('isAuditLogEncryptionTestEnvironment', () => {
    it('returns true when NODE_ENV is "test"', () => {
      expect(isAuditLogEncryptionTestEnvironment({ NODE_ENV: 'test' })).toBe(true);
    });

    it('returns true when LOCAL_TEST_MODE is "true"', () => {
      expect(isAuditLogEncryptionTestEnvironment({ LOCAL_TEST_MODE: 'true' })).toBe(true);
    });

    it('returns false otherwise', () => {
      expect(isAuditLogEncryptionTestEnvironment({ NODE_ENV: 'production' })).toBe(false);
      expect(isAuditLogEncryptionTestEnvironment({ LOCAL_TEST_MODE: 'false' })).toBe(false);
      expect(isAuditLogEncryptionTestEnvironment({})).toBe(false);
    });
  });

  describe('isAuditLogEncryptionTestFallbackEnabled', () => {
    it('returns true when fallback env is "true"', () => {
      expect(
        isAuditLogEncryptionTestFallbackEnabled({
          [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: 'true',
        }),
      ).toBe(true);
    });

    it('returns false otherwise', () => {
      expect(
        isAuditLogEncryptionTestFallbackEnabled({
          [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: 'false',
        }),
      ).toBe(false);
      expect(isAuditLogEncryptionTestFallbackEnabled({})).toBe(false);
    });
  });

  describe('validateAuditLogEncryptionConfig', () => {
    it('returns error if fallback is enabled but not in test environment', () => {
      const errors = validateAuditLogEncryptionConfig({
        [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: 'true',
        NODE_ENV: 'production',
      });
      expect(errors).toContain(
        `${AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV}=true is only allowed when NODE_ENV=test or LOCAL_TEST_MODE=true.`,
      );
    });

    it('returns no errors if encryption is disabled and no fallback issues', () => {
      const errors = validateAuditLogEncryptionConfig({
        AUDIT_LOG_ENCRYPTION_ENABLED: 'false',
      });
      expect(errors).toHaveLength(0);
    });

    it('returns no errors if encryption is enabled and key is provided', () => {
      const errors = validateAuditLogEncryptionConfig({
        AUDIT_LOG_ENCRYPTION_ENABLED: 'true',
        AUDIT_LOG_ENCRYPTION_KEY: 'some-secret-key',
      });
      expect(errors).toHaveLength(0);
    });

    it('returns no errors if encryption is enabled, in test env, and fallback is enabled', () => {
      const errors = validateAuditLogEncryptionConfig({
        AUDIT_LOG_ENCRYPTION_ENABLED: 'true',
        NODE_ENV: 'test',
        [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: 'true',
      });
      expect(errors).toHaveLength(0);
    });

    it('returns error if encryption is enabled without a key and not in test fallback', () => {
      const errors = validateAuditLogEncryptionConfig({
        AUDIT_LOG_ENCRYPTION_ENABLED: 'true',
        NODE_ENV: 'production',
      });
      expect(errors).toContain(
        'AUDIT_LOG_ENCRYPTION_ENABLED=true requires AUDIT_LOG_ENCRYPTION_KEY to be configured via managed secrets or environment before startup. Automatic key generation is disabled outside explicit test fallback.',
      );
    });
  });

  describe('resolveAuditLogEncryptionKey', () => {
    it('returns configured key if provided', () => {
      const key = resolveAuditLogEncryptionKey({
        AUDIT_LOG_ENCRYPTION_KEY: ' my-secret-key ',
      });
      expect(key).toBe('my-secret-key');
    });

    it('returns generated key if in test env, encryption enabled, and fallback enabled', () => {
      const key = resolveAuditLogEncryptionKey({
        AUDIT_LOG_ENCRYPTION_ENABLED: 'true',
        NODE_ENV: 'test',
        [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: 'true',
      });
      expect(key).toBe('mock-generated-key');
    });

    it('returns null otherwise', () => {
      expect(resolveAuditLogEncryptionKey({})).toBeNull();

      expect(
        resolveAuditLogEncryptionKey({
          AUDIT_LOG_ENCRYPTION_ENABLED: 'true',
          NODE_ENV: 'production',
        })
      ).toBeNull();

      expect(
        resolveAuditLogEncryptionKey({
          AUDIT_LOG_ENCRYPTION_ENABLED: 'false',
          NODE_ENV: 'test',
          [AUDIT_LOG_ENCRYPTION_TEST_FALLBACK_ENV]: 'true',
        })
      ).toBeNull();
    });
  });
});
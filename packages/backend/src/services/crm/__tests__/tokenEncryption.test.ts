/**
 * Token Encryption Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('tokenEncryption', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.CRM_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-32chars!';
    process.env.CRM_TOKEN_KEK_SECRET = 'test-kek-secret-for-unit-tests';
    // Default to key version 1
    delete process.env.CRM_TOKEN_KEY_VERSION;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.resetModules();
  });

  it('encrypts and decrypts a token round-trip (versioned format)', async () => {
    const { encryptToken, decryptToken } = await import('../tokenEncryption.js');

    const plaintext = 'sf_access_token_abc123xyz';
    const encrypted = encryptToken(plaintext);

    expect(encrypted).not.toBe(plaintext);
    // Versioned envelope format: v2:{kekVersion}:{dataKeyVersion}:{createdAt}:{wrappedDataKey}:{iv}:{authTag}:{ciphertext}
    expect(encrypted).toMatch(/^v2:/);
    expect(encrypted.split(':')).toHaveLength(8);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const { encryptToken } = await import('../tokenEncryption.js');

    const plaintext = 'same-token-value';
    const enc1 = encryptToken(plaintext);
    const enc2 = encryptToken(plaintext);

    expect(enc1).not.toBe(enc2);
  });

  it('throws on missing encryption key', async () => {
    delete process.env.CRM_TOKEN_KEK_SECRET;
    delete process.env.CRM_TOKEN_ENCRYPTION_KEY;
    vi.resetModules();

    const { encryptToken } = await import('../tokenEncryption.js');

    expect(() => encryptToken('test')).toThrow('CRM_TOKEN_KEK_SECRET');
  });

  it('throws on invalid encrypted format', async () => {
    const { decryptToken } = await import('../tokenEncryption.js');

    expect(() => decryptToken('not-valid-format')).toThrow('Invalid encrypted token format');
  });

  it('throws on tampered ciphertext', async () => {
    const { encryptToken, decryptToken } = await import('../tokenEncryption.js');

    const encrypted = encryptToken('secret-token');
    const parts = encrypted.split(':');
    // Tamper with ciphertext payload (8th part in v2 envelope format)
    parts[7] = 'AAAA' + parts[7].slice(4);
    const tampered = parts.join(':');

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('decrypts legacy (non-versioned) format for backward compatibility', async () => {
    // Simulate legacy format by manually creating iv:authTag:ciphertext
    const { createCipheriv, randomBytes, createHash } = await import('node:crypto');
    const key = createHash('sha256').update('test-encryption-key-for-unit-tests-32chars!').digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    let encrypted = cipher.update('legacy-token', 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    const legacyFormat = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

    const { decryptToken } = await import('../tokenEncryption.js');
    const decrypted = decryptToken(legacyFormat);
    expect(decrypted).toBe('legacy-token');
  });

  it('generates a stable token fingerprint', async () => {
    const { tokenFingerprint } = await import('../tokenEncryption.js');

    const fp1 = tokenFingerprint('test-token');
    const fp2 = tokenFingerprint('test-token');
    const fp3 = tokenFingerprint('different-token');

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1).toHaveLength(16);
  });

  it('detects when re-encryption is needed after key rotation', async () => {
    const { encryptToken, needsReEncryption } = await import('../tokenEncryption.js');

    const encrypted = encryptToken('test');
    expect(needsReEncryption(encrypted)).toBe(false);

    // Simulate key version bump
    process.env.CRM_TOKEN_KEY_VERSION = '2';
    process.env.CRM_TOKEN_KEK_SECRET_V2 = 'new-kek-secret-for-version-2';
    process.env.CRM_TOKEN_ENCRYPTION_KEY_V2 = 'new-key-for-version-2';
    expect(needsReEncryption(encrypted)).toBe(true);
  });
});

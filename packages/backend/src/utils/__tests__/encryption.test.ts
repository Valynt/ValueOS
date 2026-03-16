import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { decrypt, encrypt } from '../encryption.js'

describe('Encryption Utils', () => {
  const originalKey = process.env.APP_ENCRYPTION_KEY;
  const originalKek = process.env.APP_ENCRYPTION_KEK_MATERIAL;

  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEK_MATERIAL = Buffer.from('a'.repeat(32), 'utf8').toString('base64');
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.APP_ENCRYPTION_KEY;
    } else {
      process.env.APP_ENCRYPTION_KEY = originalKey;
    }

    if (originalKek === undefined) {
      delete process.env.APP_ENCRYPTION_KEK_MATERIAL;
      return;
    }

    process.env.APP_ENCRYPTION_KEK_MATERIAL = originalKek;
  });

  it('should encrypt and decrypt correctly', () => {
    const original = 'super-secret-password';
    const encrypted = encrypt(original);

    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':'); // Checks format

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should return empty string for empty input', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('should handle special characters', () => {
    const original = 'Sp€c!al Ch@r$';
    const decrypted = decrypt(encrypt(original));
    expect(decrypted).toBe(original);
  });

  it('should produce different outputs for same input (random IV)', () => {
     const input = 'test';
     const enc1 = encrypt(input);
     const enc2 = encrypt(input);
     expect(enc1).not.toBe(enc2);
     expect(decrypt(enc1)).toBe(input);
     expect(decrypt(enc2)).toBe(input);
  });

  it('should reject malformed key lengths', () => {
    process.env.APP_ENCRYPTION_KEK_MATERIAL = Buffer.from('short-key', 'utf8').toString('base64');
    expect(() => encrypt('value')).toThrow('APP_ENCRYPTION_KEK_MATERIAL must be a 32-byte key encoded as hex/base64');
  });

  it('should support PBKDF2-derived keys with explicit parameters', () => {
    process.env.APP_ENCRYPTION_KEK_MATERIAL = 'pbkdf2:100000:c2FsdC1mb3ItdGVzdHMxMjM0NTY=:passphrase';
    const plaintext = 'pbkdf2-encrypted';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('should decrypt legacy ciphertext format for backward compatibility', async () => {
    const { createCipheriv, randomBytes } = await import('node:crypto');
    process.env.APP_ENCRYPTION_KEY = Buffer.from('b'.repeat(32), 'utf8').toString('base64');
    const key = Buffer.from('b'.repeat(32), 'utf8');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update('legacy-value', 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    const legacyFormat = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    expect(decrypt(legacyFormat)).toBe('legacy-value');
  });
});

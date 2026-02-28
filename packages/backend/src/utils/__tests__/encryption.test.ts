import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../encryption.js'

describe('Encryption Utils', () => {
  const originalKey = process.env.APP_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = Buffer.from('a'.repeat(32), 'utf8').toString('base64');
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.APP_ENCRYPTION_KEY;
      return;
    }

    process.env.APP_ENCRYPTION_KEY = originalKey;
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
    process.env.APP_ENCRYPTION_KEY = Buffer.from('short-key', 'utf8').toString('base64');
    expect(() => encrypt('value')).toThrow('APP_ENCRYPTION_KEY must be a 32-byte key encoded as hex/base64');
  });

  it('should support PBKDF2-derived keys with explicit parameters', () => {
    process.env.APP_ENCRYPTION_KEY = 'pbkdf2:100000:c2FsdC1mb3ItdGVzdHMxMjM0NTY=:passphrase';
    const plaintext = 'pbkdf2-encrypted';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });
});

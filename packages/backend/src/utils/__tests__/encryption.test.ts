import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../encryption';

describe('Encryption Utils', () => {
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
});

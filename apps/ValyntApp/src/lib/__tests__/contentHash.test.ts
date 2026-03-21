import { describe, expect, it } from 'vitest';

import { sha256 } from '../contentHash';

describe('contentHash', () => {
  describe('sha256', () => {
    it('should compute the correct SHA-256 hash for a known string', async () => {
      const input = 'hello world';
      const expectedHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

      const result = await sha256(input);
      expect(result).toBe(expectedHash);
    });

    it('should compute the correct SHA-256 hash for an empty string', async () => {
      const input = '';
      const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

      const result = await sha256(input);
      expect(result).toBe(expectedHash);
    });

    it('should be deterministic (return the same hash for the same input)', async () => {
      const input = 'deterministic test string';
      const hash1 = await sha256(input);
      const hash2 = await sha256(input);

      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', async () => {
      const hash1 = await sha256('test string 1');
      const hash2 = await sha256('test string 2');

      expect(hash1).not.toBe(hash2);
    });
  });
});

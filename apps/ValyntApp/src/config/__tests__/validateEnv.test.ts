/**
 * Tests for Environment Validation
 * Phase 1: Environment & Configuration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateEnv, validateLLMConfig } from '../validateEnv';

describe('Phase 1: Environment Validation', () => {
  describe('validateLLMConfig', () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    it('should pass when Together AI is configured', () => {
      vi.stubEnv('TOGETHER_API_KEY', 'test-key-123');

      const result = validateLLMConfig();

      // provider is hardcoded to "together" — no env override needed
      expect(result.provider).toBe('together');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error when TOGETHER_API_KEY is missing', () => {
      vi.stubEnv('TOGETHER_API_KEY', '');

      const result = validateLLMConfig();

      expect(result.errors.some(e => e.toLowerCase().includes('together'))).toBe(true);
    });

    it('should detect leaked VITE_-prefixed API keys', () => {
      vi.stubEnv('VITE_TOGETHER_API_KEY', 'leaked-key');

      const result = validateLLMConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('VITE_TOGETHER_API_KEY'))).toBe(true);
    });
  });

  describe('validateEnv', () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    it('should return valid/errors/warnings shape', () => {
      const result = validateEnv();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should aggregate errors when configuration is invalid', () => {
      vi.stubEnv('VITE_TOGETHER_API_KEY', 'leaked');

      const result = validateEnv();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.valid).toBe(false);
    });
  });
});

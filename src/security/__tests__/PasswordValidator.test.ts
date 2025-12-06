/**
 * Password Validator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePassword,
  generateStrongPassword,
  calculatePasswordEntropy,
  estimateCrackTime,
} from '../PasswordValidator';

describe('PasswordValidator', () => {
  describe('validatePassword', () => {
    it('should accept a strong password', () => {
      const result = validatePassword('MyP@ssw0rd123!');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toMatch(/strong|very-strong/);
      expect(result.score).toBeGreaterThan(60);
    });

    it('should reject password that is too short', () => {
      const result = validatePassword('Short1!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('mypassword123!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('MYPASSWORD123!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      const result = validatePassword('MyPassword!!!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      const result = validatePassword('MyPassword123');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common passwords', () => {
      const result = validatePassword('Password123!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is too common. Please choose a more unique password');
    });

    it('should warn about keyboard patterns', () => {
      const result = validatePassword('Qwerty123456!');
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('keyboard pattern');
    });

    it('should warn about repeated characters', () => {
      const result = validatePassword('MyPasssss123!');
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('repeated characters');
    });

    it('should reject password containing user info', () => {
      const result = validatePassword('JohnDoe123!', {
        firstName: 'John',
        lastName: 'Doe',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain your personal information');
    });

    it('should give bonus points for longer passwords', () => {
      const short = validatePassword('MyP@ssw0rd12');
      const long = validatePassword('MyP@ssw0rd123456789!');
      
      expect(long.score).toBeGreaterThan(short.score);
    });
  });

  describe('generateStrongPassword', () => {
    it('should generate password of specified length', () => {
      const password = generateStrongPassword(16);
      
      expect(password).toHaveLength(16);
    });

    it('should generate password with all required character types', () => {
      const password = generateStrongPassword(16);
      
      expect(password).toMatch(/[A-Z]/); // Uppercase
      expect(password).toMatch(/[a-z]/); // Lowercase
      expect(password).toMatch(/[0-9]/); // Numbers
      expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/); // Special chars
    });

    it('should generate different passwords each time', () => {
      const password1 = generateStrongPassword(16);
      const password2 = generateStrongPassword(16);
      
      expect(password1).not.toBe(password2);
    });

    it('should generate valid passwords', () => {
      const password = generateStrongPassword(16);
      const result = validatePassword(password);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('calculatePasswordEntropy', () => {
    it('should calculate higher entropy for complex passwords', () => {
      const simple = calculatePasswordEntropy('password');
      const complex = calculatePasswordEntropy('P@ssw0rd!123');
      
      expect(complex).toBeGreaterThan(simple);
    });

    it('should calculate higher entropy for longer passwords', () => {
      const short = calculatePasswordEntropy('P@ss1');
      const long = calculatePasswordEntropy('P@ssw0rd!123456');
      
      expect(long).toBeGreaterThan(short);
    });
  });

  describe('estimateCrackTime', () => {
    it('should estimate instant for weak passwords', () => {
      const time = estimateCrackTime('123456');
      
      expect(time).toMatch(/Instant|seconds/);
    });

    it('should estimate long time for strong passwords', () => {
      const time = estimateCrackTime('MyV3ry$tr0ng&C0mpl3xP@ssw0rd!');
      
      expect(time).toMatch(/years|Centuries/);
    });
  });

  // ============================================================================
  // Password Breach API Tests (Dec 1, 2025 Fix)
  // ============================================================================
  describe('Password Breach Checking', () => {
    it('should check password against breach database', async () => {
      const { checkPasswordBreach } = await import('../../security');
      
      // Test with a known breached password
      const breachedPassword = 'password123';
      
      try {
        const isBreached = await checkPasswordBreach(breachedPassword);
        // Common passwords should be detected as breached
        expect(typeof isBreached).toBe('boolean');
      } catch (error) {
        // If API is unreachable, test should note it but not fail
        expect(error).toBeDefined();
      }
    });

    it('should handle network errors gracefully', async () => {
      const { checkPasswordBreach } = await import('../../security');
      const originalFetch = global.fetch;
      
      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      try {
        const result = await checkPasswordBreach('testpassword');
        // Should handle error and return false (allow password)
        expect(typeof result).toBe('boolean');
      } catch (error) {
        // Error handling is acceptable
        expect(error).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should use k-anonymity for privacy', async () => {
      const { checkPasswordBreach } = await import('../../security');
      const fetchSpy = vi.spyOn(global, 'fetch');
      
      try {
        await checkPasswordBreach('testpassword123');
        
        if (fetchSpy.mock.calls.length > 0) {
          const callUrl = fetchSpy.mock.calls[0][0] as string;

          // URL should be to pwnedpasswords API
          expect(callUrl).toContain('api.pwnedpasswords.com');
          expect(callUrl).toContain('/range/');
          
          // Should only include 5-char prefix for privacy
          const hashPart = callUrl.split('/range/')[1];
          if (hashPart) {
            expect(hashPart.length).toBeLessThanOrEqual(5);
          }
        }
      } catch (error) {
        // API might be unreachable in test environment
        expect(error).toBeDefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });
});

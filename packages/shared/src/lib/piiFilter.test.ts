// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as environment from '../config/environment.js';
import {
  sanitizeForLogging,
  sanitizeUser,
  sanitizeRequest,
  sanitizeError,
  createLogContext,
  validateLogMessage
} from './piiFilter.js';

// Mock the environment to easily switch between dev and prod
vi.mock('../config/environment.js', () => ({
  isDevelopment: vi.fn(),
}));

describe('piiFilter', () => {
  beforeEach(() => {
    // Default to production mode for most tests
    vi.mocked(environment.isDevelopment).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeForLogging', () => {
    it('handles null and undefined', () => {
      expect(sanitizeForLogging(null)).toBeNull();
      expect(sanitizeForLogging(undefined)).toBeUndefined();
    });

    it('handles non-object primitives', () => {
      expect(sanitizeForLogging(42)).toBe(42);
      expect(sanitizeForLogging(true)).toBe(true);
      expect(sanitizeForLogging(false)).toBe(false);
      expect(sanitizeForLogging('regular string')).toBe('regular string');
    });

    it('redacts sensitive primitive string values', () => {
      // JWT
      expect(sanitizeForLogging('eyJhbGciOiJIUzI1NiIsInR5cCI.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBe('[REDACTED]');
      // Bearer token
      expect(sanitizeForLogging('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBe('[REDACTED]');
      // API Key (>= 32 chars alphanumeric)
      expect(sanitizeForLogging('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0')).toBe('[REDACTED]');
      // Credit card (13-19 digits, with or without spaces)
      expect(sanitizeForLogging('1234567812345678')).toBe('[REDACTED]');
      expect(sanitizeForLogging('1234 5678 1234 5678')).toBe('[REDACTED]');
      // Email
      expect(sanitizeForLogging('test@example.com')).toBe('[REDACTED]');
    });

    it('partially redacts sensitive values in development', () => {
      vi.mocked(environment.isDevelopment).mockReturnValue(true);
      expect(sanitizeForLogging('test@example.com')).toBe('[REDACTED:test...]');
      // To test less than 4 chars, we need an object with a sensitive key, since '123' won't trigger isSensitiveValue
      const obj = { password: '123' };
      const sanitized = sanitizeForLogging(obj) as any;
      expect(sanitized.password).toBe('[REDACTED]');
    });

    it('redacts sensitive object keys', () => {
      const obj = {
        name: 'John Doe',
        password: 'my-secret-password',
        email: 'john@example.com',
        credit_card: '1234567812345678',
        safe_info: 'safe'
      };

      const sanitized = sanitizeForLogging(obj) as Record<string, unknown>;
      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.email).toBe('[REDACTED]');
      expect(sanitized.credit_card).toBe('[REDACTED]');
      expect(sanitized.safe_info).toBe('safe');
    });

    it('redacts sensitive values in objects regardless of key', () => {
      const obj = {
        some_key: 'test@example.com',
        another_key: '1234567812345678'
      };

      const sanitized = sanitizeForLogging(obj) as Record<string, unknown>;
      expect(sanitized.some_key).toBe('[REDACTED]');
      expect(sanitized.another_key).toBe('[REDACTED]');
    });

    it('handles nested objects recursively', () => {
      const obj = {
        user: {
          profile: {
            name: 'John',
            email: 'john@example.com'
          }
        }
      };

      const sanitized = sanitizeForLogging(obj) as any;
      expect(sanitized.user.profile.name).toBe('John');
      expect(sanitized.user.profile.email).toBe('[REDACTED]');
    });

    it('handles arrays', () => {
      const arr = ['safe', 'test@example.com', { password: 'secret' }];
      const sanitized = sanitizeForLogging(arr) as any[];

      expect(sanitized[0]).toBe('safe');
      expect(sanitized[1]).toBe('[REDACTED]');
      expect(sanitized[2].password).toBe('[REDACTED]');
    });

    it('respects maxDepth to prevent infinite recursion', () => {
      const circular: any = {};
      circular.self = circular;

      const sanitized = sanitizeForLogging(circular, 2) as any;
      expect(sanitized.self.self).toBe('[MAX_DEPTH_EXCEEDED]');
    });
  });

  describe('sanitizeUser', () => {
    it('returns null user if not an object', () => {
      expect(sanitizeUser(null)).toEqual({ user: null });
      expect(sanitizeUser('string')).toEqual({ user: null });
    });

    it('only returns safe identifiers', () => {
      const user = {
        id: '123',
        role: 'admin',
        tenant_id: 't-1',
        email: 'test@example.com',
        name: 'John',
        password: 'secret'
      };

      expect(sanitizeUser(user)).toEqual({
        id: '123',
        role: 'admin',
        tenant_id: 't-1'
      });
    });
  });

  describe('sanitizeRequest', () => {
    it('returns null request if not an object', () => {
      expect(sanitizeRequest(null)).toEqual({ request: null });
    });

    it('only returns safe metadata in production', () => {
      const req = {
        method: 'GET',
        path: '/api/test',
        query: { q: 'search', secret: '123' },
        user: { id: 'u-1', tenant_id: 't-1', email: 'u@e.com' },
        tenantId: 't-2', // takes precedence? Actually `req.tenantId ?? req.user?.tenant_id`
        ip: '192.168.1.1',
        body: { password: 'secret' },
        headers: { authorization: 'Bearer token' }
      };

      const sanitized = sanitizeRequest(req);
      expect(sanitized).toEqual({
        method: 'GET',
        path: '/api/test',
        query: { q: 'search', secret: '[REDACTED]' },
        user_id: 'u-1',
        tenant_id: 't-2',
        ip: '[REDACTED]'
      });
    });

    it('returns IP in development', () => {
      vi.mocked(environment.isDevelopment).mockReturnValue(true);
      const req = { method: 'GET', ip: '192.168.1.1' };
      const sanitized = sanitizeRequest(req);
      expect(sanitized.ip).toBe('192.168.1.1');
    });

    it('uses url if path is not provided', () => {
      const req = { url: '/api/test2' };
      expect(sanitizeRequest(req).path).toBe('/api/test2');
    });
  });

  describe('sanitizeError', () => {
    it('returns null error if not provided', () => {
      expect(sanitizeError(null)).toEqual({ error: null });
      expect(sanitizeError(undefined)).toEqual({ error: null });
    });

    it('handles Error instances in production', () => {
      const error = new Error('Something went wrong');
      Object.assign(error, { code: 500, email: 'test@example.com' });

      const sanitized = sanitizeError(error);
      expect(sanitized).toEqual({
        name: 'Error',
        message: 'Something went wrong',
        stack: '[REDACTED]',
        code: 500,
        email: '[REDACTED]'
      });
    });

    it('handles Error instances in development (includes stack)', () => {
      vi.mocked(environment.isDevelopment).mockReturnValue(true);
      const error = new Error('Test');
      const sanitized = sanitizeError(error);

      expect(sanitized.name).toBe('Error');
      expect(sanitized.message).toBe('Test');
      expect(sanitized.stack).toContain('Error: Test'); // stack trace string
    });

    it('handles non-Error objects', () => {
      const errorObj = { message: 'Failed', email: 'test@example.com' };
      const sanitized = sanitizeError(errorObj);
      expect(sanitized).toEqual({
        message: 'Failed',
        email: '[REDACTED]'
      });
    });

    it('handles primitive errors', () => {
      expect(sanitizeError('string error')).toEqual({ value: 'string error' });
    });
  });

  describe('createLogContext', () => {
    it('sanitizes context objects', () => {
      const context = {
        action: 'login',
        userEmail: 'test@example.com',
        details: { token: 'secret-token' }
      };

      const result = createLogContext(context);
      expect(result).toEqual({
        action: 'login',
        userEmail: '[REDACTED]',
        details: { token: '[REDACTED]' }
      });
    });

    it('handles non-object contexts', () => {
      // Though type says Record<string, unknown>, at runtime it might be anything
      expect(createLogContext('string' as any)).toEqual({ value: 'string' });
    });
  });

  describe('validateLogMessage', () => {
    let consoleWarnSpy: any;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('does nothing in production', () => {
      validateLogMessage('User test@example.com logged in');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('warns about possible email in message in development', () => {
      vi.mocked(environment.isDevelopment).mockReturnValue(true);
      validateLogMessage('User test@example.com logged in');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️ WARNING: Possible email in log message:',
        'User test@example.com logged in'
      );
    });

    it('warns about sensitive keys in context in development', () => {
      vi.mocked(environment.isDevelopment).mockReturnValue(true);
      validateLogMessage('Login attempt', { email: 'test@example.com' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️ WARNING: Sensitive keys in log context:',
        ['email']
      );
    });
  });
});

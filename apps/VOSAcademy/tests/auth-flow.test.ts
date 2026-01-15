import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateSessionToken, createSessionToken, parseCookies, getSessionFromRequest } from '../src/data/_core/session';
import { handleOAuthCallback } from '../src/data/_core/oauth';

// Mock database
vi.mock('../src/data/db', () => ({
  getUserByOpenId: vi.fn(async (openId: string) => {
    if (openId === 'test-user-123') {
      return {
        id: 'user-uuid-123',
        openId: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        vosRole: 'Sales',
        maturityLevel: 1,
        createdAt: new Date(),
      };
    }
    return null;
  }),
  upsertUser: vi.fn(async () => {}),
}));

describe('Session Management', () => {
  describe('createSessionToken', () => {
    it('should create a valid base64 token', () => {
      const token = createSessionToken('test-user-123');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      // Should be valid base64
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      expect(() => JSON.parse(decoded)).not.toThrow();
    });

    it('should include openId and timestamp', () => {
      const token = createSessionToken('test-user-123');
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const data = JSON.parse(decoded);
      
      expect(data.openId).toBe('test-user-123');
      expect(data.createdAt).toBeTruthy();
      expect(typeof data.createdAt).toBe('number');
    });
  });

  describe('validateSessionToken', () => {
    it('should validate a fresh token', async () => {
      const token = createSessionToken('test-user-123');
      const user = await validateSessionToken(token);
      
      expect(user).toBeTruthy();
      expect(user?.openId).toBe('test-user-123');
      expect(user?.name).toBe('Test User');
    });

    it('should reject expired token', async () => {
      // Create token with old timestamp
      const oldSessionData = {
        openId: 'test-user-123',
        createdAt: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
      };
      const expiredToken = Buffer.from(JSON.stringify(oldSessionData)).toString('base64');
      
      const user = await validateSessionToken(expiredToken);
      expect(user).toBeNull();
    });

    it('should reject invalid token format', async () => {
      const user = await validateSessionToken('invalid-token');
      expect(user).toBeNull();
    });

    it('should reject token for non-existent user', async () => {
      const token = createSessionToken('non-existent-user');
      const user = await validateSessionToken(token);
      expect(user).toBeNull();
    });
  });

  describe('parseCookies', () => {
    it('should parse cookie header correctly', () => {
      const cookieHeader = 'session=abc123; theme=dark; lang=en';
      const cookies = parseCookies(cookieHeader);
      
      expect(cookies.session).toBe('abc123');
      expect(cookies.theme).toBe('dark');
      expect(cookies.lang).toBe('en');
    });

    it('should handle empty cookie header', () => {
      const cookies = parseCookies('');
      expect(Object.keys(cookies).length).toBe(0);
    });

    it('should handle undefined cookie header', () => {
      const cookies = parseCookies(undefined);
      expect(Object.keys(cookies).length).toBe(0);
    });

    it('should decode URL-encoded values', () => {
      const cookieHeader = 'name=John%20Doe';
      const cookies = parseCookies(cookieHeader);
      expect(cookies.name).toBe('John Doe');
    });
  });

  describe('getSessionFromRequest', () => {
    it('should extract session token from request', () => {
      const req = {
        headers: {
          cookie: 'vosacademy_session=abc123; other=value',
        },
      };
      
      const token = getSessionFromRequest(req);
      expect(token).toBe('abc123');
    });

    it('should return null if no session cookie', () => {
      const req = {
        headers: {
          cookie: 'other=value',
        },
      };
      
      const token = getSessionFromRequest(req);
      expect(token).toBeNull();
    });

    it('should return null if no cookies', () => {
      const req = {
        headers: {},
      };
      
      const token = getSessionFromRequest(req);
      expect(token).toBeNull();
    });
  });
});

describe('OAuth Flow', () => {
  describe('handleOAuthCallback', () => {
    it('should handle successful OAuth callback', async () => {
      const req = { headers: {} };
      const res = {
        setHeader: vi.fn(),
        statusCode: 200,
      };
      
      const result = await handleOAuthCallback(
        'test-code-123',
        Buffer.from('/dashboard').toString('base64'),
        req,
        res
      );
      
      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe('/dashboard');
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('vosacademy_session='));
    });

    it('should handle missing code', async () => {
      const req = { headers: {} };
      const res = { setHeader: vi.fn() };
      
      const result = await handleOAuthCallback(
        '',
        'state',
        req,
        res
      );
      
      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('error');
    });
  });
});

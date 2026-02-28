import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createSessionToken, getSessionFromRequest, parseCookies, validateSessionToken } from '../src/data/_core/session';
import { handleOAuthCallback, handleOAuthLogin } from '../src/data/_core/oauth';

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
  const oauthPortalUrl = 'https://oauth.test';
  const issuer = 'https://issuer.test';
  const appId = 'app-123';
  const userInfo = {
    sub: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
  };

  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;

  const createIdToken = () =>
    jwt.sign(
      { sub: userInfo.sub, name: userInfo.name, email: userInfo.email },
      privateKey,
      {
        algorithm: 'RS256',
        keyid: 'test-kid',
        issuer,
        audience: appId,
        expiresIn: '1h',
      }
    );

  beforeEach(() => {
    process.env.VITE_OAUTH_PORTAL_URL = oauthPortalUrl;
    process.env.VITE_APP_ID = appId;
    process.env.OAUTH_STATE_SECRET = 'state-secret';

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url === `${oauthPortalUrl}/.well-known/openid-configuration`) {
        return new Response(
          JSON.stringify({
            token_endpoint: `${oauthPortalUrl}/token`,
            userinfo_endpoint: `${oauthPortalUrl}/userinfo`,
            issuer,
            jwks_uri: `${oauthPortalUrl}/.well-known/jwks.json`,
          }),
          { status: 200 }
        );
      }

      if (url === `${oauthPortalUrl}/token`) {
        return new Response(
          JSON.stringify({
            access_token: 'access-token',
            id_token: createIdToken(),
            token_type: 'Bearer',
          }),
          { status: 200 }
        );
      }

      if (url === `${oauthPortalUrl}/userinfo`) {
        return new Response(JSON.stringify(userInfo), { status: 200 });
      }

      if (url === `${oauthPortalUrl}/.well-known/jwks.json`) {
        return new Response(
          JSON.stringify({
            keys: [
              {
                ...jwk,
                kid: 'test-kid',
                use: 'sig',
                alg: 'RS256',
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response('Not Found', { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('handleOAuthCallback', () => {
    it('should handle successful OAuth callback', async () => {
      const loginReq = { headers: {}, url: '/api/oauth/login?returnTo=/dashboard' };
      const loginRes = { setHeader: vi.fn(), statusCode: 200 };
      const loginResult = await handleOAuthLogin(loginReq, loginRes);
      const loginRedirect = new URL(loginResult.redirectUrl);
      const state = loginRedirect.searchParams.get('state');
      const cookieHeader = loginRes.setHeader.mock.calls[0][1] as string;

      const req = { headers: { cookie: cookieHeader } };
      const res = {
        setHeader: vi.fn(),
        statusCode: 200,
      };
      
      const result = await handleOAuthCallback(
        'test-code-123',
        state || '',
        req,
        res
      );
      
      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe('/dashboard');
      expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('vosacademy_session='));
    });

    it('should handle missing code', async () => {
      const loginReq = { headers: {}, url: '/api/oauth/login?returnTo=/dashboard' };
      const loginRes = { setHeader: vi.fn(), statusCode: 200 };
      const loginResult = await handleOAuthLogin(loginReq, loginRes);
      const loginRedirect = new URL(loginResult.redirectUrl);
      const state = loginRedirect.searchParams.get('state');
      const cookieHeader = loginRes.setHeader.mock.calls[0][1] as string;

      const req = { headers: { cookie: cookieHeader } };
      const res = { setHeader: vi.fn() };
      
      const result = await handleOAuthCallback(
        '',
        state || '',
        req,
        res
      );
      
      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('error');
    });
  });
});

/**
 * CORS Middleware Tests
 *
 * Tests for: allowed origin, denied origin, preflight handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import {
  createCorsMiddleware,
  isOriginAllowed,
  validateOrigin,
} from '../cors';
import {
  resetSecurityConfig,
  SecurityConfig,
  setSecurityConfig,
} from '../config';

describe('CORS Middleware', () => {
  let app: Express;

  // Default test configuration
  const testConfig: SecurityConfig = {
    cors: {
      allowedOrigins: [
        'https://app.example.com',
        'https://admin.example.com',
        '^https://.*\\.example\\.com$', // Regex pattern
      ],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
      maxAge: 86400,
      credentials: true,
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: false,
    },
    csp: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: true,
      reportOnly: false,
    },
    environment: 'test',
  };

  beforeEach(() => {
    resetSecurityConfig();
    setSecurityConfig(testConfig);

    app = express();
    app.use(createCorsMiddleware());
    app.get('/test', (req, res) => res.json({ success: true }));
    app.post('/test', (req, res) => res.json({ success: true }));
  });

  afterEach(() => {
    resetSecurityConfig();
  });

  // ============================================================================
  // Allowed Origin Tests
  // ============================================================================

  describe('Allowed Origins', () => {
    it('allows exact match origin', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://app.example.com');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
    });

    it('allows regex pattern match origin', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://subdomain.example.com');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://subdomain.example.com');
    });

    it('sets credentials header when enabled', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://app.example.com');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('sets Vary: Origin header', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://app.example.com');

      expect(response.headers['vary']).toBe('Origin');
    });

    it('sets exposed headers for actual requests', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://app.example.com');

      expect(response.headers['access-control-expose-headers']).toBe(
        'X-Request-ID, X-RateLimit-Remaining'
      );
    });

    it('allows requests without Origin header (same-origin)', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      // No CORS headers for same-origin requests
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // ============================================================================
  // Denied Origin Tests
  // ============================================================================

  describe('Denied Origins', () => {
    it('does not set CORS headers for disallowed origin', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://evil.com');

      expect(response.status).toBe(200); // Request still succeeds
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('returns 403 when rejectDisallowed is true', async () => {
      const strictApp = express();
      strictApp.use(createCorsMiddleware({ rejectDisallowed: true }));
      strictApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(strictApp)
        .get('/test')
        .set('Origin', 'https://evil.com');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CORS_ORIGIN_NOT_ALLOWED');
    });

    it('does not match partial origin', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://app.example.com.evil.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('does not match different protocol', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://app.example.com'); // http instead of https

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // ============================================================================
  // Preflight (OPTIONS) Tests
  // ============================================================================

  describe('Preflight Requests', () => {
    it('handles preflight request with 204', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://app.example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
    });

    it('sets allowed methods in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://app.example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-methods']).toBe(
        'GET, POST, PUT, DELETE, OPTIONS'
      );
    });

    it('sets allowed headers in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://app.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

      expect(response.headers['access-control-allow-headers']).toBe(
        'Content-Type, Authorization, X-Request-ID'
      );
    });

    it('sets max-age in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://app.example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-max-age']).toBe('86400');
    });

    it('rejects preflight from disallowed origin', async () => {
      const strictApp = express();
      strictApp.use(createCorsMiddleware({ rejectDisallowed: true }));
      strictApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(strictApp)
        .options('/test')
        .set('Origin', 'https://evil.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(403);
    });

    it('does not set exposed headers in preflight response', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://app.example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-expose-headers']).toBeUndefined();
    });
  });

  // ============================================================================
  // Credentials + Wildcard Tests
  // ============================================================================

  describe('Credentials and Wildcard', () => {
    it('throws error when wildcard used with credentials', () => {
      expect(() => {
        setSecurityConfig({
          ...testConfig,
          cors: {
            ...testConfig.cors,
            allowedOrigins: ['*'],
            credentials: true,
          },
        });
      }).toThrow('Cannot use wildcard');
    });

    it('allows wildcard when credentials are disabled', () => {
      expect(() => {
        setSecurityConfig({
          ...testConfig,
          cors: {
            ...testConfig.cors,
            allowedOrigins: ['*'],
            credentials: false,
          },
        });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // validateOrigin Function Tests
  // ============================================================================

  describe('validateOrigin', () => {
    it('returns allowed for exact match', () => {
      const result = validateOrigin('https://app.example.com', [
        'https://app.example.com',
      ]);
      expect(result.allowed).toBe(true);
      expect(result.origin).toBe('https://app.example.com');
    });

    it('returns allowed for regex match', () => {
      const result = validateOrigin('https://sub.example.com', [
        '^https://.*\\.example\\.com$',
      ]);
      expect(result.allowed).toBe(true);
    });

    it('returns allowed for wildcard', () => {
      const result = validateOrigin('https://any.com', ['*']);
      expect(result.allowed).toBe(true);
    });

    it('returns not allowed for non-matching origin', () => {
      const result = validateOrigin('https://evil.com', [
        'https://app.example.com',
      ]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in allow-list');
    });

    it('returns allowed with null origin for same-origin requests', () => {
      const result = validateOrigin(undefined, ['https://app.example.com']);
      expect(result.allowed).toBe(true);
      expect(result.origin).toBeNull();
    });
  });

  // ============================================================================
  // isOriginAllowed Function Tests
  // ============================================================================

  describe('isOriginAllowed', () => {
    it('returns true for allowed origin', () => {
      expect(isOriginAllowed('https://app.example.com')).toBe(true);
    });

    it('returns false for disallowed origin', () => {
      expect(isOriginAllowed('https://evil.com')).toBe(false);
    });
  });

  // ============================================================================
  // Custom Configuration Tests
  // ============================================================================

  describe('Custom Configuration', () => {
    it('merges custom config with defaults', async () => {
      const customApp = express();
      customApp.use(
        createCorsMiddleware({
          config: {
            allowedOrigins: ['https://custom.example.com'],
          },
        })
      );
      customApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(customApp)
        .get('/test')
        .set('Origin', 'https://custom.example.com');

      expect(response.headers['access-control-allow-origin']).toBe(
        'https://custom.example.com'
      );
    });

    it('uses custom logger', async () => {
      const logger = vi.fn();
      const customApp = express();
      customApp.use(createCorsMiddleware({ logger, rejectDisallowed: true }));
      customApp.get('/test', (req, res) => res.json({ success: true }));

      await request(customApp)
        .get('/test')
        .set('Origin', 'https://evil.com');

      expect(logger).toHaveBeenCalledWith(
        'CORS request blocked',
        expect.objectContaining({ origin: 'https://evil.com' })
      );
    });
  });
});

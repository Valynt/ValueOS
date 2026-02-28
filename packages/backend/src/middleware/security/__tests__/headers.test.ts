/**
 * Security Headers Middleware Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import {
  buildCspHeader,
  buildHstsHeader,
  buildPermissionsPolicy,
  createSecurityHeadersMiddleware,
  getApiSafeCspConfig,
} from '../headers';
import {
  CspConfig,
  HstsConfig,
  resetSecurityConfig,
  SecurityConfig,
  setSecurityConfig,
} from '../config';

describe('Security Headers Middleware', () => {
  let app: Express;

  const testConfig: SecurityConfig = {
    cors: {
      allowedOrigins: ['https://app.example.com'],
      allowedMethods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      exposedHeaders: [],
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
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: true,
      reportUri: '/api/csp-report',
      reportOnly: false,
    },
    environment: 'production',
  };

  beforeEach(() => {
    resetSecurityConfig();
    setSecurityConfig(testConfig);

    app = express();
    app.use(createSecurityHeadersMiddleware());
    app.get('/test', (req, res) => res.json({ success: true }));
  });

  afterEach(() => {
    resetSecurityConfig();
  });

  // ============================================================================
  // HSTS Header Tests
  // ============================================================================

  describe('Strict-Transport-Security (HSTS)', () => {
    it('sets HSTS header in production', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains'
      );
    });

    it('includes preload when enabled', async () => {
      setSecurityConfig({
        ...testConfig,
        hsts: { ...testConfig.hsts, preload: true },
      });

      const preloadApp = express();
      preloadApp.use(createSecurityHeadersMiddleware());
      preloadApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(preloadApp).get('/test');

      expect(response.headers['strict-transport-security']).toContain('preload');
    });

    it('does not set HSTS in development', async () => {
      setSecurityConfig({ ...testConfig, environment: 'development' });

      const devApp = express();
      devApp.use(createSecurityHeadersMiddleware());
      devApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(devApp).get('/test');

      expect(response.headers['strict-transport-security']).toBeUndefined();
    });
  });

  // ============================================================================
  // X-Content-Type-Options Tests
  // ============================================================================

  describe('X-Content-Type-Options', () => {
    it('sets nosniff header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  // ============================================================================
  // X-Frame-Options Tests
  // ============================================================================

  describe('X-Frame-Options', () => {
    it('sets DENY when frame-ancestors is none', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('sets SAMEORIGIN when frame-ancestors is self', async () => {
      setSecurityConfig({
        ...testConfig,
        csp: { ...testConfig.csp, frameAncestors: ["'self'"] },
      });

      const selfApp = express();
      selfApp.use(createSecurityHeadersMiddleware());
      selfApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(selfApp).get('/test');

      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  // ============================================================================
  // Referrer-Policy Tests
  // ============================================================================

  describe('Referrer-Policy', () => {
    it('sets default referrer policy', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('allows custom referrer policy', async () => {
      const customApp = express();
      customApp.use(createSecurityHeadersMiddleware({ referrerPolicy: 'no-referrer' }));
      customApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(customApp).get('/test');

      expect(response.headers['referrer-policy']).toBe('no-referrer');
    });
  });

  // ============================================================================
  // Permissions-Policy Tests
  // ============================================================================

  describe('Permissions-Policy', () => {
    it('sets permissions policy header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['permissions-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toContain('camera=()');
      expect(response.headers['permissions-policy']).toContain('microphone=()');
    });

    it('allows custom permissions policy', async () => {
      const customApp = express();
      customApp.use(
        createSecurityHeadersMiddleware({
          permissionsPolicy: { camera: ['self'], microphone: [] },
        })
      );
      customApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(customApp).get('/test');

      expect(response.headers['permissions-policy']).toContain('camera=(self)');
      expect(response.headers['permissions-policy']).toContain('microphone=()');
    });
  });

  // ============================================================================
  // Content-Security-Policy Tests
  // ============================================================================

  describe('Content-Security-Policy', () => {
    it('sets CSP header', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('includes all directives', async () => {
      const response = await request(app).get('/test');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
      expect(csp).toContain("img-src 'self' data:");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('report-uri /api/csp-report');
    });

    it('uses report-only header when configured', async () => {
      setSecurityConfig({
        ...testConfig,
        csp: { ...testConfig.csp, reportOnly: true },
      });

      const reportOnlyApp = express();
      reportOnlyApp.use(createSecurityHeadersMiddleware());
      reportOnlyApp.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(reportOnlyApp).get('/test');

      expect(response.headers['content-security-policy-report-only']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeUndefined();
    });
  });

  // ============================================================================
  // Additional Security Headers Tests
  // ============================================================================

  describe('Additional Security Headers', () => {
    it('sets X-XSS-Protection', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('sets X-DNS-Prefetch-Control', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('sets X-Download-Options', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-download-options']).toBe('noopen');
    });

    it('sets X-Permitted-Cross-Domain-Policies', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    });

    it('sets Cross-Origin-Opener-Policy', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    });

    it('sets Cross-Origin-Resource-Policy', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    });
  });

  // ============================================================================
  // Skip Paths Tests
  // ============================================================================

  describe('Skip Paths', () => {
    it('skips security headers for specified paths', async () => {
      const skipApp = express();
      skipApp.use(createSecurityHeadersMiddleware({ skipPaths: ['/health'] }));
      skipApp.get('/health', (req, res) => res.json({ status: 'ok' }));
      skipApp.get('/api', (req, res) => res.json({ data: 'test' }));

      const healthResponse = await request(skipApp).get('/health');
      const apiResponse = await request(skipApp).get('/api');

      expect(healthResponse.headers['content-security-policy']).toBeUndefined();
      expect(apiResponse.headers['content-security-policy']).toBeDefined();
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('buildHstsHeader', () => {
    it('builds basic HSTS header', () => {
      const config: HstsConfig = {
        maxAge: 31536000,
        includeSubDomains: false,
        preload: false,
      };

      expect(buildHstsHeader(config)).toBe('max-age=31536000');
    });

    it('includes includeSubDomains', () => {
      const config: HstsConfig = {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      };

      expect(buildHstsHeader(config)).toBe('max-age=31536000; includeSubDomains');
    });

    it('includes preload', () => {
      const config: HstsConfig = {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      };

      expect(buildHstsHeader(config)).toBe('max-age=31536000; includeSubDomains; preload');
    });
  });

  describe('buildCspHeader', () => {
    it('builds CSP header from config', () => {
      const config: CspConfig = {
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
      };

      const csp = buildCspHeader(config);

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('adds nonce to script-src and style-src', () => {
      const config: CspConfig = {
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
        upgradeInsecureRequests: false,
        reportOnly: false,
      };

      const csp = buildCspHeader(config, 'abc123');

      expect(csp).toContain("script-src 'self' 'nonce-abc123'");
      expect(csp).toContain("style-src 'self' 'nonce-abc123'");
    });
  });

  describe('buildPermissionsPolicy', () => {
    it('builds permissions policy string', () => {
      const policy = buildPermissionsPolicy({
        camera: [],
        microphone: ['self'],
        geolocation: ['self', 'https://maps.example.com'],
      });

      expect(policy).toContain('camera=()');
      expect(policy).toContain('microphone=(self)');
      expect(policy).toContain('geolocation=(self https://maps.example.com)');
    });
  });

  describe('getApiSafeCspConfig', () => {
    it('returns restrictive CSP for APIs', () => {
      const config = getApiSafeCspConfig();

      expect(config.defaultSrc).toEqual(["'none'"]);
      expect(config.scriptSrc).toEqual(["'none'"]);
      expect(config.styleSrc).toEqual(["'none'"]);
      expect(config.connectSrc).toEqual(["'self'"]);
      expect(config.frameAncestors).toEqual(["'none'"]);
    });
  });
});

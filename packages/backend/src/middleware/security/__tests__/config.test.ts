/**
 * Security Configuration Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ENV_VARS,
  getDefaultCspConfig,
  parseCorsConfig,
  parseHstsConfig,
  parseSecurityConfig,
  resetSecurityConfig,
} from '../config';

describe('Security Configuration', () => {
  beforeEach(() => {
    resetSecurityConfig();
  });

  afterEach(() => {
    resetSecurityConfig();
  });

  // ============================================================================
  // CORS Config Parsing
  // ============================================================================

  describe('parseCorsConfig', () => {
    it('uses default origins when not specified', () => {
      const config = parseCorsConfig({});

      expect(config.allowedOrigins).toContain('http://localhost:3000');
      expect(config.allowedOrigins).toContain('http://localhost:5173');
    });

    it('parses comma-separated origins', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_ALLOWED_ORIGINS]: 'https://app.example.com,https://admin.example.com',
      });

      expect(config.allowedOrigins).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
      ]);
    });

    it('trims whitespace from origins', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_ALLOWED_ORIGINS]: '  https://app.example.com  ,  https://admin.example.com  ',
      });

      expect(config.allowedOrigins).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
      ]);
    });

    it('parses allowed methods', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_ALLOWED_METHODS]: 'GET,POST,PUT',
      });

      expect(config.allowedMethods).toEqual(['GET', 'POST', 'PUT']);
    });

    it('parses allowed headers', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_ALLOWED_HEADERS]: 'Content-Type,Authorization,X-Custom',
      });

      expect(config.allowedHeaders).toEqual(['Content-Type', 'Authorization', 'X-Custom']);
    });

    it('parses max age', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_MAX_AGE]: '3600',
      });

      expect(config.maxAge).toBe(3600);
    });

    it('parses credentials boolean', () => {
      const configTrue = parseCorsConfig({
        [ENV_VARS.CORS_CREDENTIALS]: 'true',
      });
      expect(configTrue.credentials).toBe(true);

      const configFalse = parseCorsConfig({
        [ENV_VARS.CORS_CREDENTIALS]: 'false',
      });
      expect(configFalse.credentials).toBe(false);
    });

    it('throws error for wildcard with credentials', () => {
      expect(() => {
        parseCorsConfig({
          [ENV_VARS.CORS_ALLOWED_ORIGINS]: '*',
          [ENV_VARS.CORS_CREDENTIALS]: 'true',
        });
      }).toThrow('Cannot use wildcard');
    });

    it('allows wildcard without credentials', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_ALLOWED_ORIGINS]: '*',
        [ENV_VARS.CORS_CREDENTIALS]: 'false',
      });

      expect(config.allowedOrigins).toEqual(['*']);
    });

    it('validates origin URL format', () => {
      expect(() => {
        parseCorsConfig({
          [ENV_VARS.CORS_ALLOWED_ORIGINS]: 'not-a-url',
          [ENV_VARS.CORS_CREDENTIALS]: 'false',
        });
      }).toThrow('Invalid origin');
    });

    it('allows regex patterns starting with ^', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_ALLOWED_ORIGINS]: '^https://.*\\.example\\.com$',
        [ENV_VARS.CORS_CREDENTIALS]: 'false',
      });

      expect(config.allowedOrigins).toEqual(['^https://.*\\.example\\.com$']);
    });
  });

  // ============================================================================
  // HSTS Config Parsing
  // ============================================================================

  describe('parseHstsConfig', () => {
    it('uses default max age', () => {
      const config = parseHstsConfig({});

      expect(config.maxAge).toBe(31536000); // 1 year
    });

    it('parses custom max age', () => {
      const config = parseHstsConfig({
        [ENV_VARS.HSTS_MAX_AGE]: '86400',
      });

      expect(config.maxAge).toBe(86400);
    });

    it('parses includeSubDomains', () => {
      const configTrue = parseHstsConfig({
        [ENV_VARS.HSTS_INCLUDE_SUBDOMAINS]: 'true',
      });
      expect(configTrue.includeSubDomains).toBe(true);

      const configFalse = parseHstsConfig({
        [ENV_VARS.HSTS_INCLUDE_SUBDOMAINS]: 'false',
      });
      expect(configFalse.includeSubDomains).toBe(false);
    });

    it('parses preload', () => {
      const config = parseHstsConfig({
        [ENV_VARS.HSTS_PRELOAD]: 'true',
      });

      expect(config.preload).toBe(true);
    });

    it('defaults preload to false', () => {
      const config = parseHstsConfig({});

      expect(config.preload).toBe(false);
    });
  });

  // ============================================================================
  // CSP Config
  // ============================================================================

  describe('getDefaultCspConfig', () => {
    it('returns relaxed CSP for development', () => {
      const config = getDefaultCspConfig('development');

      expect(config.scriptSrc).toContain("'unsafe-eval'");
      expect(config.styleSrc).toContain("'unsafe-inline'");
      expect(config.upgradeInsecureRequests).toBe(false);
    });

    it('returns strict CSP for production', () => {
      const config = getDefaultCspConfig('production');

      expect(config.scriptSrc).not.toContain("'unsafe-eval'");
      expect(config.styleSrc).not.toContain("'unsafe-inline'");
      expect(config.upgradeInsecureRequests).toBe(true);
    });

    it('parses report URI from env', () => {
      const config = getDefaultCspConfig('production', {
        [ENV_VARS.CSP_REPORT_URI]: '/custom/csp-report',
      });

      expect(config.reportUri).toBe('/custom/csp-report');
    });

    it('parses report-only mode', () => {
      const config = getDefaultCspConfig('production', {
        [ENV_VARS.CSP_REPORT_ONLY]: 'true',
      });

      expect(config.reportOnly).toBe(true);
    });

    it('parses frame ancestors', () => {
      const config = getDefaultCspConfig('production', {
        [ENV_VARS.FRAME_ANCESTORS]: "'self',https://parent.example.com",
      });

      expect(config.frameAncestors).toEqual(["'self'", 'https://parent.example.com']);
    });
  });

  // ============================================================================
  // Full Security Config
  // ============================================================================

  describe('parseSecurityConfig', () => {
    it('parses complete configuration', () => {
      const config = parseSecurityConfig({
        [ENV_VARS.NODE_ENV]: 'production',
        [ENV_VARS.CORS_ALLOWED_ORIGINS]: 'https://app.example.com',
        [ENV_VARS.HSTS_MAX_AGE]: '86400',
        [ENV_VARS.CSP_REPORT_URI]: '/api/csp-report',
      });

      expect(config.environment).toBe('production');
      expect(config.cors.allowedOrigins).toEqual(['https://app.example.com']);
      expect(config.hsts.maxAge).toBe(86400);
      expect(config.csp.reportUri).toBe('/api/csp-report');
    });

    it('defaults to development environment', () => {
      const config = parseSecurityConfig({});

      expect(config.environment).toBe('development');
    });

    it('validates the complete configuration', () => {
      // Should not throw for valid config
      expect(() => {
        parseSecurityConfig({
          [ENV_VARS.NODE_ENV]: 'production',
          [ENV_VARS.CORS_ALLOWED_ORIGINS]: 'https://app.example.com',
        });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Boolean Parsing Edge Cases
  // ============================================================================

  describe('Boolean Parsing', () => {
    it('parses "1" as true', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_CREDENTIALS]: '1',
      });

      expect(config.credentials).toBe(true);
    });

    it('parses "yes" as true', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_CREDENTIALS]: 'yes',
      });

      expect(config.credentials).toBe(true);
    });

    it('parses "0" as false', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_CREDENTIALS]: '0',
      });

      expect(config.credentials).toBe(false);
    });

    it('parses empty string as default', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_CREDENTIALS]: '',
      });

      expect(config.credentials).toBe(true); // default is true
    });
  });

  // ============================================================================
  // Integer Parsing Edge Cases
  // ============================================================================

  describe('Integer Parsing', () => {
    it('uses default for invalid integer', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_MAX_AGE]: 'not-a-number',
      });

      expect(config.maxAge).toBe(86400); // default
    });

    it('uses default for empty string', () => {
      const config = parseCorsConfig({
        [ENV_VARS.CORS_MAX_AGE]: '',
      });

      expect(config.maxAge).toBe(86400); // default
    });
  });
});

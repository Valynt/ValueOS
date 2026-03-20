import { describe, it, expect, beforeEach } from 'vitest';
import { securityHeaders } from '../securityHeaders.js';

describe('SecurityHeaders', () => {
  // Save the default config so we can restore it before each test
  // to avoid state leakage between tests, since it's a singleton.
  const defaultConfig = JSON.parse(JSON.stringify(securityHeaders.getConfig()));

  beforeEach(() => {
    // Reset config to default before each test
    securityHeaders.updateConfig(defaultConfig);
  });

  describe('generateHeaders', () => {
    it('generates expected default security headers', () => {
      const headers = securityHeaders.generateHeaders();

      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'");

      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');

      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(headers).toHaveProperty('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(headers).toHaveProperty('Permissions-Policy');
    });

    it('does not generate headers when disabled in config', () => {
      securityHeaders.updateConfig({
        xFrameOptions: { enabled: false, value: 'DENY' },
        strictTransportSecurity: { enabled: false, maxAge: 0, includeSubDomains: false, preload: false }
      });

      const headers = securityHeaders.generateHeaders();

      expect(headers).not.toHaveProperty('X-Frame-Options');
      expect(headers).not.toHaveProperty('Strict-Transport-Security');
      // CSP should still be generated as it wasn't disabled
      expect(headers).toHaveProperty('Content-Security-Policy');
    });
  });

  describe('updateConfig', () => {
    it('merges configuration updates correctly', () => {
      securityHeaders.updateConfig({
        xFrameOptions: { enabled: true, value: 'SAMEORIGIN' }
      });

      const config = securityHeaders.getConfig();
      expect(config.xFrameOptions.value).toBe('SAMEORIGIN');
      // Other defaults should remain intact
      expect(config.xContentTypeOptions.enabled).toBe(true);
    });
  });

  describe('validateCSP', () => {
    it('returns valid when all directives are secure', () => {
      // The default config includes unsafe-eval and unsafe-inline which makes it "invalid".
      // Create a secure config to test the true valid path.
      securityHeaders.updateConfig({
        contentSecurityPolicy: {
          enabled: true,
          directives: {
            'default-src': "'self'",
            'script-src': "'self'",
            'frame-ancestors': "'none'"
          }
        }
      });
      const result = securityHeaders.validateCSP();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('identifies missing default-src directive', () => {
      // Create an invalid config for testing
      const config = securityHeaders.getConfig();
      delete config.contentSecurityPolicy.directives['default-src'];

      // Update config using the modified object directly (as updateConfig merges)
      securityHeaders.updateConfig({
        contentSecurityPolicy: {
          ...config.contentSecurityPolicy,
          directives: config.contentSecurityPolicy.directives
        }
      });

      const result = securityHeaders.validateCSP();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('default-src directive is required');
    });

    it('identifies unsafe script-src directives', () => {
      securityHeaders.updateConfig({
        contentSecurityPolicy: {
          enabled: true,
          directives: {
            'script-src': "'unsafe-inline' 'unsafe-eval'"
          }
        }
      });

      const result = securityHeaders.validateCSP();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('unsafe-eval in script-src is not recommended for production');
      expect(result.errors).toContain('unsafe-inline in script-src is not recommended for production');
    });
  });

  describe('applyToFetchRequest', () => {
    it('appends security headers to RequestInit', () => {
      const options: RequestInit = { headers: new Headers({ 'X-Custom': 'test' }) };
      const updatedOptions = securityHeaders.applyToFetchRequest(options);

      const headers = updatedOptions.headers as Headers;
      expect(headers.get('X-Custom')).toBe('test');
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.has('Content-Security-Policy')).toBe(true);
    });
  });

  describe('applyToResponse', () => {
    it('appends security headers to Response object', () => {
      const response = new Response('body', { headers: new Headers({ 'X-Custom': 'test' }) });
      const updatedResponse = securityHeaders.applyToResponse(response);

      expect(updatedResponse.headers.get('X-Custom')).toBe('test');
      expect(updatedResponse.headers.get('X-Frame-Options')).toBe('DENY');
      expect(updatedResponse.headers.has('Content-Security-Policy')).toBe(true);
    });
  });

  describe('generateNonce & addNonceToDirective', () => {
    it('generates a valid nonce string', () => {
      const nonce = securityHeaders.generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      expect(nonce).not.toMatch(/[/+=]/);
    });

    it('adds nonce to specified CSP directive', () => {
      const nonce = 'testnonce123';
      securityHeaders.addNonceToDirective('script-src', nonce);

      const config = securityHeaders.getConfig();
      const scriptSrc = config.contentSecurityPolicy.directives['script-src'];
      expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    });
  });

  describe('getSecurityScore', () => {
    it('returns appropriate score and recommendations for default config', () => {
      // The default config has unsafe CSP directives, so it won't be max score
      const result = securityHeaders.getSecurityScore();
      expect(result.score).toBeLessThan(result.maxScore);
      // We know from validateCSP that the default config triggers 2 recommendations
      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations).toContain('unsafe-eval in script-src is not recommended for production');
      expect(result.recommendations).toContain('unsafe-inline in script-src is not recommended for production');
    });

    it('returns maximum score when all security features are enabled and valid', () => {
      securityHeaders.updateConfig({
        contentSecurityPolicy: {
          enabled: true,
          directives: {
            'default-src': "'self'",
            'script-src': "'self'",
            'frame-ancestors': "'none'"
          }
        }
      });
      const result = securityHeaders.getSecurityScore();
      expect(result.score).toBe(result.maxScore);
      expect(result.recommendations).toHaveLength(0);
    });

    it('reduces score and provides recommendations when features disabled', () => {
      securityHeaders.updateConfig({
        xFrameOptions: { enabled: false, value: 'DENY' },
        xXSSProtection: { enabled: false, mode: '0' }
      });

      const result = securityHeaders.getSecurityScore();
      expect(result.score).toBeLessThan(result.maxScore);
      expect(result.recommendations).toContain('Enable X-Frame-Options');
      expect(result.recommendations).toContain('Enable X-XSS-Protection');
    });
  });
});

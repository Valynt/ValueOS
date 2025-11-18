/**
 * Security Headers Configuration
 * Comprehensive security headers for production deployment
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  strictTransportSecurity: string;
  xFrameOptions: string;
  xContentTypeOptions: string;
  xXSSProtection: string;
  referrerPolicy: string;
  permissionsPolicy: string;
}

export const SECURITY_HEADERS: SecurityHeadersConfig = {
  /**
   * Content Security Policy (CSP)
   * Prevents XSS, injection attacks, and other code execution vulnerabilities
   */
  contentSecurityPolicy: [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self' https://*.supabase.co",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),

  /**
   * Strict-Transport-Security (HSTS)
   * Forces HTTPS for 1 year, including subdomains
   */
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',

  /**
   * X-Frame-Options
   * Prevents clickjacking attacks
   */
  xFrameOptions: 'DENY',

  /**
   * X-Content-Type-Options
   * Prevents MIME-sniffing attacks
   */
  xContentTypeOptions: 'nosniff',

  /**
   * X-XSS-Protection
   * Legacy XSS protection (for older browsers)
   */
  xXSSProtection: '1; mode=block',

  /**
   * Referrer-Policy
   * Controls how much referrer information is included
   */
  referrerPolicy: 'strict-origin-when-cross-origin',

  /**
   * Permissions-Policy
   * Restricts browser features
   */
  permissionsPolicy: [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'speaker=()',
  ].join(', '),
};

/**
 * Convert headers object to HTTP headers format
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': SECURITY_HEADERS.contentSecurityPolicy,
    'Strict-Transport-Security': SECURITY_HEADERS.strictTransportSecurity,
    'X-Frame-Options': SECURITY_HEADERS.xFrameOptions,
    'X-Content-Type-Options': SECURITY_HEADERS.xContentTypeOptions,
    'X-XSS-Protection': SECURITY_HEADERS.xXSSProtection,
    'Referrer-Policy': SECURITY_HEADERS.referrerPolicy,
    'Permissions-Policy': SECURITY_HEADERS.permissionsPolicy,
  };
}

/**
 * Validate CSP configuration
 */
export function validateCSP(csp: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (csp.includes("'unsafe-eval'")) {
    warnings.push("CSP contains 'unsafe-eval' - reduces security");
  }

  if (csp.includes("*") && !csp.includes("https://*")) {
    warnings.push("CSP contains wildcard '*' - should be more specific");
  }

  if (!csp.includes("default-src")) {
    warnings.push("CSP missing 'default-src' directive");
  }

  if (!csp.includes("script-src")) {
    warnings.push("CSP missing 'script-src' directive");
  }

  if (!csp.includes("object-src 'none'")) {
    warnings.push("CSP should include \"object-src 'none'\" for security");
  }

  if (!csp.includes("base-uri")) {
    warnings.push("CSP missing 'base-uri' directive");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Get headers for specific environment
 */
export function getEnvironmentHeaders(env: 'development' | 'production'): Record<string, string> {
  const headers = getSecurityHeaders();

  if (env === 'development') {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-eval'", // Allow eval for HMR
      "connect-src 'self' https://*.supabase.co ws://localhost:* http://localhost:*", // Allow dev server
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    delete headers['Strict-Transport-Security'];
  }

  return headers;
}

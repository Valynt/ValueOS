/**
 * Security Headers
 * 
 * Implements security headers to protect against common web vulnerabilities.
 * Includes CSP, HSTS, X-Frame-Options, and other security headers.
 */

import { getSecurityConfig } from './SecurityConfig';

/**
 * Generate Content Security Policy header value
 */
export function generateCSPHeader(): string {
  const config = getSecurityConfig().csp;

  if (!config.enabled) {
    return '';
  }

  const directives: string[] = [];

  // Add each directive
  for (const [key, value] of Object.entries(config.directives)) {
    if (key === 'upgradeInsecureRequests') {
      if (value) {
        directives.push('upgrade-insecure-requests');
      }
      continue;
    }

    const directiveName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const directiveValue = Array.isArray(value) ? value.join(' ') : value;
    
    if (directiveValue) {
      directives.push(`${directiveName} ${directiveValue}`);
    }
  }

  return directives.join('; ');
}

/**
 * Generate Strict-Transport-Security header value
 */
export function generateHSTSHeader(): string {
  const config = getSecurityConfig().headers.strictTransportSecurity;

  if (!config.enabled) {
    return '';
  }

  const parts = [`max-age=${config.maxAge}`];

  if (config.includeSubDomains) {
    parts.push('includeSubDomains');
  }

  if (config.preload) {
    parts.push('preload');
  }

  return parts.join('; ');
}

/**
 * Generate X-Frame-Options header value
 */
export function generateXFrameOptionsHeader(): string {
  const config = getSecurityConfig().headers.xFrameOptions;

  if (!config.enabled) {
    return '';
  }

  return config.value;
}

/**
 * Generate X-Content-Type-Options header value
 */
export function generateXContentTypeOptionsHeader(): string {
  const config = getSecurityConfig().headers.xContentTypeOptions;

  if (!config.enabled) {
    return '';
  }

  return 'nosniff';
}

/**
 * Generate X-XSS-Protection header value
 */
export function generateXXSSProtectionHeader(): string {
  const config = getSecurityConfig().headers.xXssProtection;

  if (!config.enabled) {
    return '';
  }

  return config.mode === 'block' ? '1; mode=block' : '1';
}

/**
 * Generate Referrer-Policy header value
 */
export function generateReferrerPolicyHeader(): string {
  const config = getSecurityConfig().headers.referrerPolicy;

  if (!config.enabled) {
    return '';
  }

  return config.value;
}

/**
 * Generate Permissions-Policy header value
 */
export function generatePermissionsPolicyHeader(): string {
  const config = getSecurityConfig().headers.permissionsPolicy;

  if (!config.enabled) {
    return '';
  }

  const directives: string[] = [];

  for (const [feature, origins] of Object.entries(config.directives)) {
    const featureName = feature.replace(/([A-Z])/g, '-$1').toLowerCase();
    const originsValue = origins.length === 0 ? '()' : `(${origins.join(' ')})`;
    directives.push(`${featureName}=${originsValue}`);
  }

  return directives.join(', ');
}

/**
 * Get all security headers
 */
export function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  // Content Security Policy
  const csp = generateCSPHeader();
  if (csp) {
    const config = getSecurityConfig().csp;
    const headerName = config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    headers[headerName] = csp;
  }

  // Strict-Transport-Security
  const hsts = generateHSTSHeader();
  if (hsts) {
    headers['Strict-Transport-Security'] = hsts;
  }

  // X-Frame-Options
  const xFrameOptions = generateXFrameOptionsHeader();
  if (xFrameOptions) {
    headers['X-Frame-Options'] = xFrameOptions;
  }

  // X-Content-Type-Options
  const xContentTypeOptions = generateXContentTypeOptionsHeader();
  if (xContentTypeOptions) {
    headers['X-Content-Type-Options'] = xContentTypeOptions;
  }

  // X-XSS-Protection
  const xXSSProtection = generateXXSSProtectionHeader();
  if (xXSSProtection) {
    headers['X-XSS-Protection'] = xXSSProtection;
  }

  // Referrer-Policy
  const referrerPolicy = generateReferrerPolicyHeader();
  if (referrerPolicy) {
    headers['Referrer-Policy'] = referrerPolicy;
  }

  // Permissions-Policy
  const permissionsPolicy = generatePermissionsPolicyHeader();
  if (permissionsPolicy) {
    headers['Permissions-Policy'] = permissionsPolicy;
  }

  return headers;
}

/**
 * Apply security headers to fetch request
 */
export function applySecurityHeaders(
  headers: Headers | Record<string, string>
): Headers | Record<string, string> {
  const securityHeaders = getSecurityHeaders();

  if (headers instanceof Headers) {
    for (const [key, value] of Object.entries(securityHeaders)) {
      headers.set(key, value);
    }
  } else {
    Object.assign(headers, securityHeaders);
  }

  return headers;
}

/**
 * Create meta tags for security headers
 */
export function createSecurityMetaTags(): void {
  const config = getSecurityConfig();

  // CSP meta tag
  if (config.csp.enabled) {
    const csp = generateCSPHeader();
    if (csp) {
      let metaTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement;
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.httpEquiv = 'Content-Security-Policy';
        document.head.appendChild(metaTag);
      }
      metaTag.content = csp;
    }
  }

  // Referrer-Policy meta tag
  if (config.headers.referrerPolicy.enabled) {
    let metaTag = document.querySelector('meta[name="referrer"]') as HTMLMetaElement;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'referrer';
      document.head.appendChild(metaTag);
    }
    metaTag.content = config.headers.referrerPolicy.value;
  }
}

/**
 * Validate security headers in response
 */
export function validateSecurityHeaders(response: Response): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const expectedHeaders = getSecurityHeaders();

  for (const [header, expectedValue] of Object.entries(expectedHeaders)) {
    const actualValue = response.headers.get(header);

    if (!actualValue) {
      missing.push(header);
    } else if (actualValue !== expectedValue) {
      warnings.push(`${header} value differs from expected`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Log security headers for debugging
 */
export function logSecurityHeaders(): void {
  const headers = getSecurityHeaders();

  console.group('Security Headers');
  for (const [key, value] of Object.entries(headers)) {
    logger.debug(`${key}: ${value}`);
  }
  console.groupEnd();
}

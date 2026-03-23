/**
 * Security Headers Middleware
 *
 * Implements security headers for production environments:
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options
 * - X-Frame-Options / CSP frame-ancestors
 * - Referrer-Policy
 * - Permissions-Policy
 * - Content-Security-Policy
 */

import { randomBytes } from 'crypto';

import { NextFunction, Request, Response } from 'express';

import { logger } from '../../lib/logger.js';
import { CspConfig, getSecurityConfig, HstsConfig } from './config.js'

// ============================================================================
// Types
// ============================================================================

export interface SecurityHeadersOptions {
  /**
   * Custom HSTS configuration.
   */
  hsts?: Partial<HstsConfig>;

  /**
   * Custom CSP configuration.
   */
  csp?: Partial<CspConfig>;

  /**
   * Additional CSP sources to merge with defaults.
   */
  additionalCspSources?: Partial<Record<keyof CspConfig, string[]>>;

  /**
   * Enable nonce generation for scripts/styles.
   * Only recommended for SSR applications.
   */
  enableNonce?: boolean;

  /**
   * Custom Referrer-Policy value.
   */
  referrerPolicy?: string;

  /**
   * Custom Permissions-Policy directives.
   */
  permissionsPolicy?: Record<string, string[]>;

  /**
   * Skip security headers for certain paths (e.g., health checks).
   */
  skipPaths?: string[];
}

// ============================================================================
// HSTS Header
// ============================================================================

/**
 * Build Strict-Transport-Security header value.
 */
export function buildHstsHeader(config: HstsConfig): string {
  const parts = [`max-age=${config.maxAge}`];

  if (config.includeSubDomains) {
    parts.push('includeSubDomains');
  }

  if (config.preload) {
    parts.push('preload');
  }

  return parts.join('; ');
}

// ============================================================================
// CSP Header
// ============================================================================

/**
 * CSP directive names mapping.
 */
const CSP_DIRECTIVE_MAP: Record<keyof CspConfig, string> = {
  defaultSrc: 'default-src',
  scriptSrc: 'script-src',
  styleSrc: 'style-src',
  imgSrc: 'img-src',
  connectSrc: 'connect-src',
  fontSrc: 'font-src',
  objectSrc: 'object-src',
  frameAncestors: 'frame-ancestors',
  baseUri: 'base-uri',
  formAction: 'form-action',
  upgradeInsecureRequests: 'upgrade-insecure-requests',
  reportUri: 'report-uri',
  reportOnly: '', // Not a directive, controls header name
};

/**
 * Build Content-Security-Policy header value.
 */
export function buildCspHeader(config: CspConfig, nonce?: string): string {
  const directives: string[] = [];

  // Add nonce to script-src and style-src if provided
  const scriptSrc = nonce
    ? [...config.scriptSrc, `'nonce-${nonce}'`]
    : config.scriptSrc;
  const styleSrc = nonce
    ? [...config.styleSrc, `'nonce-${nonce}'`]
    : config.styleSrc;

  // Build directives
  const addDirective = (name: string, values: string[]) => {
    if (values.length > 0) {
      directives.push(`${name} ${values.join(' ')}`);
    }
  };

  addDirective('default-src', config.defaultSrc);
  addDirective('script-src', scriptSrc);
  addDirective('style-src', styleSrc);
  addDirective('img-src', config.imgSrc);
  addDirective('connect-src', config.connectSrc);
  addDirective('font-src', config.fontSrc);
  addDirective('object-src', config.objectSrc);
  addDirective('frame-ancestors', config.frameAncestors);
  addDirective('base-uri', config.baseUri);
  addDirective('form-action', config.formAction);

  if (config.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }

  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Get the CSP header name based on report-only mode.
 */
export function getCspHeaderName(reportOnly: boolean): string {
  return reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
}

// ============================================================================
// Permissions-Policy Header
// ============================================================================

/**
 * Default Permissions-Policy directives.
 * Disables features not typically needed by APIs.
 */
const DEFAULT_PERMISSIONS_POLICY: Record<string, string[]> = {
  camera: [],
  microphone: [],
  geolocation: [],
  'interest-cohort': [], // Disable FLoC
  accelerometer: [],
  gyroscope: [],
  magnetometer: [],
  payment: [],
  usb: [],
  'screen-wake-lock': [],
  'xr-spatial-tracking': [],
};

/**
 * Build Permissions-Policy header value.
 */
export function buildPermissionsPolicy(
  directives: Record<string, string[]>
): string {
  return Object.entries(directives)
    .map(([feature, allowList]) => {
      if (allowList.length === 0) {
        return `${feature}=()`;
      }
      return `${feature}=(${allowList.join(' ')})`;
    })
    .join(', ');
}

// ============================================================================
// API-Safe CSP
// ============================================================================

/**
 * Get a CSP configuration optimized for JSON APIs.
 * More restrictive than web app CSP since APIs don't serve HTML.
 */
export function getApiSafeCspConfig(): CspConfig {
  return {
    defaultSrc: ["'none'"],
    scriptSrc: ["'none'"],
    styleSrc: ["'none'"],
    imgSrc: ["'none'"],
    connectSrc: ["'self'"],
    fontSrc: ["'none'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    upgradeInsecureRequests: true,
    reportOnly: false,
  };
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Create security headers middleware with the given options.
 */
export function createSecurityHeadersMiddleware(options: SecurityHeadersOptions = {}) {
  const {
    enableNonce = false,
    referrerPolicy = 'strict-origin-when-cross-origin',
    permissionsPolicy = DEFAULT_PERMISSIONS_POLICY,
    skipPaths = [],
  } = options;

  return function securityHeadersMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Skip for certain paths
    if (skipPaths.some((path) => req.path.startsWith(path))) {
      next();
      return;
    }

    const securityConfig = getSecurityConfig();
    const isDevelopment = securityConfig.environment === 'development';

    // Merge configurations
    const hstsConfig: HstsConfig = {
      ...securityConfig.hsts,
      ...options.hsts,
    };

    const cspConfig: CspConfig = {
      ...securityConfig.csp,
      ...options.csp,
    };

    // Merge additional CSP sources
    if (options.additionalCspSources) {
      for (const [key, values] of Object.entries(options.additionalCspSources)) {
        const directive = key as keyof CspConfig;
        if (Array.isArray(cspConfig[directive]) && Array.isArray(values)) {
          (cspConfig as Record<string, unknown>)[directive] = [
            ...(cspConfig[directive] as string[]),
            ...values,
          ];
        }
      }
    }

    // Generate nonce if enabled (production only)
    let nonce: string | undefined;
    if (enableNonce && !isDevelopment) {
      nonce = randomBytes(16).toString('base64');
      res.locals.cspNonce = nonce;
    }

    // ========================================================================
    // Set Security Headers
    // ========================================================================

    // 1. Strict-Transport-Security (HSTS)
    // Only set in production (HTTPS)
    if (!isDevelopment && hstsConfig.maxAge > 0) {
      res.setHeader('Strict-Transport-Security', buildHstsHeader(hstsConfig));
    }

    // 2. X-Content-Type-Options
    // Prevents MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 3. X-Frame-Options
    // Legacy header, CSP frame-ancestors is preferred but we set both for compatibility
    if (cspConfig.frameAncestors.includes("'none'")) {
      res.setHeader('X-Frame-Options', 'DENY');
    } else if (cspConfig.frameAncestors.includes("'self'")) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }

    // 4. Referrer-Policy
    res.setHeader('Referrer-Policy', referrerPolicy);

    // 5. Permissions-Policy
    res.setHeader('Permissions-Policy', buildPermissionsPolicy(permissionsPolicy));

    // 6. Content-Security-Policy
    const cspHeaderName = getCspHeaderName(cspConfig.reportOnly);
    const cspHeaderValue = buildCspHeader(cspConfig, nonce);
    res.setHeader(cspHeaderName, cspHeaderValue);

    // 7. X-XSS-Protection
    // Deprecated but still useful for older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 8. X-DNS-Prefetch-Control
    // Disable DNS prefetching for privacy
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // 9. X-Download-Options
    // Prevent IE from executing downloads in site's context
    res.setHeader('X-Download-Options', 'noopen');

    // 10. X-Permitted-Cross-Domain-Policies
    // Restrict Adobe Flash and PDF policies
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // 11. Cross-Origin-Embedder-Policy (COEP)
    // Required for SharedArrayBuffer and high-resolution timers
    // Only enable if needed, can break third-party resources
    // res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    // 12. Cross-Origin-Opener-Policy (COOP)
    // Isolates browsing context
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // 13. Cross-Origin-Resource-Policy (CORP)
    // Protects against Spectre attacks
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    next();
  };
}

/**
 * Pre-configured security headers middleware using environment configuration.
 */
export const securityHeadersMiddleware = createSecurityHeadersMiddleware();

/**
 * Security headers middleware optimized for JSON APIs.
 * Uses stricter CSP since APIs don't serve HTML.
 */
export const apiSecurityHeadersMiddleware = createSecurityHeadersMiddleware({
  csp: getApiSafeCspConfig(),
});

// ============================================================================
// CSP Report Handler
// ============================================================================

export interface CspViolationReport {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'original-policy'?: string;
    'blocked-uri'?: string;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}

/**
 * CSP violation report handler.
 * Logs violations for monitoring and debugging.
 */
export function createCspReportHandler(
  logFn: (message: string, meta?: Record<string, unknown>) => void = (msg, meta) => logger.warn(msg, meta)
) {
  return function cspReportHandler(req: Request, res: Response): void {
    const report = req.body as CspViolationReport;

    if (report && report['csp-report']) {
      const violation = report['csp-report'];

      logFn('CSP Violation', {
        documentUri: violation['document-uri'],
        violatedDirective: violation['violated-directive'],
        effectiveDirective: violation['effective-directive'],
        blockedUri: violation['blocked-uri'],
        sourceFile: violation['source-file'],
        lineNumber: violation['line-number'],
        columnNumber: violation['column-number'],
      });
    }

    // Always return 204 No Content
    res.status(204).end();
  };
}

/**
 * Default CSP report handler.
 */
export const cspReportHandler = createCspReportHandler();

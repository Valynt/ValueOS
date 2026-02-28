/**
 * Security Middleware Pack
 *
 * Combined CORS and security headers middleware for Express applications.
 * Provides a single entry point for all security-related middleware.
 */

import { Router } from 'express';

// Re-export configuration types
export type {
  CorsConfig,
  HstsConfig,
  CspConfig,
  SecurityConfig,
} from './config';

// Re-export configuration values
export {
  parseCorsConfig,
  parseHstsConfig,
  getDefaultCspConfig,
  parseSecurityConfig,
  getSecurityConfig,
  resetSecurityConfig,
  setSecurityConfig,
  ENV_VARS,
} from './config';

// Re-export CORS types and middleware
export type {
  CorsOptions,
  CorsResult,
} from './cors';

export {
  createCorsMiddleware,
  corsMiddleware,
  strictCorsMiddleware,
  validateOrigin,
  isOriginAllowed,
  getAllowedOrigins,
} from './cors';

// Re-export security headers types and middleware
export type {
  SecurityHeadersOptions,
  CspViolationReport,
} from './headers';

export {
  createSecurityHeadersMiddleware,
  securityHeadersMiddleware,
  apiSecurityHeadersMiddleware,
  buildHstsHeader,
  buildCspHeader,
  getCspHeaderName,
  buildPermissionsPolicy,
  getApiSafeCspConfig,
  createCspReportHandler,
  cspReportHandler,
} from './headers';

// ============================================================================
// Combined Middleware Pack
// ============================================================================

export interface SecurityMiddlewareOptions {
  /**
   * CORS options.
   */
  cors?: {
    enabled?: boolean;
    rejectDisallowed?: boolean;
    config?: Partial<import('./config').CorsConfig>;
  };

  /**
   * Security headers options.
   */
  headers?: {
    enabled?: boolean;
    enableNonce?: boolean;
    referrerPolicy?: string;
    skipPaths?: string[];
  };

  /**
   * CSP report endpoint path.
   * Set to false to disable.
   */
  cspReportPath?: string | false;

  /**
   * Logger function.
   */
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * Create a combined security middleware pack.
 * Includes CORS, security headers, and CSP reporting.
 *
 * Usage:
 * ```typescript
 * import { createSecurityMiddleware } from './index.js';
 *
 * const app = express();
 * app.use(createSecurityMiddleware({
 *   cors: { rejectDisallowed: true },
 *   headers: { enableNonce: true },
 *   cspReportPath: '/api/csp-report',
 * }));
 * ```
 */
export function createSecurityMiddleware(options: SecurityMiddlewareOptions = {}) {
  const {
    cors: corsOptions = {},
    headers: headersOptions = {},
    cspReportPath = '/api/csp-report',
    logger,
  } = options;

  const router = Router();

  // CSP Report endpoint (must be before other middleware)
  if (cspReportPath !== false) {
    const { createCspReportHandler } = require('./headers');
    router.post(
      cspReportPath,
      require('express').json({ type: 'application/csp-report' }),
      createCspReportHandler(logger)
    );
  }

  // CORS middleware
  if (corsOptions.enabled !== false) {
    const { createCorsMiddleware } = require('./cors');
    router.use(
      createCorsMiddleware({
        config: corsOptions.config,
        rejectDisallowed: corsOptions.rejectDisallowed,
        logger,
      })
    );
  }

  // Security headers middleware
  if (headersOptions.enabled !== false) {
    const { createSecurityHeadersMiddleware } = require('./headers');
    router.use(
      createSecurityHeadersMiddleware({
        enableNonce: headersOptions.enableNonce,
        referrerPolicy: headersOptions.referrerPolicy,
        skipPaths: headersOptions.skipPaths,
      })
    );
  }

  return router;
}

/**
 * Pre-configured security middleware for web applications.
 * Includes CORS with credentials and full security headers.
 */
export function webSecurityMiddleware() {
  return createSecurityMiddleware({
    cors: { enabled: true },
    headers: { enabled: true, enableNonce: true },
    cspReportPath: '/api/csp-report',
  });
}

/**
 * Pre-configured security middleware for JSON APIs.
 * Uses stricter CSP and rejects disallowed CORS origins.
 */
export function apiSecurityMiddleware() {
  const { createCorsMiddleware } = require('./cors');
  const { apiSecurityHeadersMiddleware } = require('./headers');

  const router = Router();

  router.use(createCorsMiddleware({ rejectDisallowed: true }));
  router.use(apiSecurityHeadersMiddleware);

  return router;
}

// ============================================================================
// Utility: Apply Security to Express App
// ============================================================================

/**
 * Apply all security middleware to an Express app.
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { applySecurityMiddleware } from './index.js';
 *
 * const app = express();
 * applySecurityMiddleware(app, {
 *   cors: { rejectDisallowed: true },
 * });
 * ```
 */
export function applySecurityMiddleware(
  app: { use: (middleware: unknown) => void },
  options: SecurityMiddlewareOptions = {}
): void {
  app.use(createSecurityMiddleware(options));
}

// ============================================================================
// Environment Variable Documentation
// ============================================================================

/**
 * Environment variables used by the security middleware:
 *
 * CORS Configuration:
 * - CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins
 *   Example: "https://app.example.com,https://admin.example.com"
 *   Default: "http://localhost:3000,http://localhost:5173,http://localhost:8080"
 *
 * - CORS_ALLOWED_METHODS: Comma-separated list of allowed HTTP methods
 *   Default: "GET,POST,PUT,PATCH,DELETE,OPTIONS"
 *
 * - CORS_ALLOWED_HEADERS: Comma-separated list of allowed request headers
 *   Default: "Content-Type,Authorization,X-Request-ID,X-Correlation-ID"
 *
 * - CORS_EXPOSED_HEADERS: Comma-separated list of headers exposed to client
 *   Default: "X-Request-ID,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,Retry-After"
 *
 * - CORS_MAX_AGE: Preflight cache duration in seconds
 *   Default: 86400 (24 hours)
 *
 * - CORS_CREDENTIALS: Allow credentials (cookies, auth headers)
 *   Default: true
 *   WARNING: Cannot use "*" origin when credentials are enabled
 *
 * HSTS Configuration:
 * - HSTS_MAX_AGE: HSTS max-age in seconds
 *   Default: 31536000 (1 year)
 *
 * - HSTS_INCLUDE_SUBDOMAINS: Include subdomains in HSTS
 *   Default: true
 *
 * - HSTS_PRELOAD: Enable HSTS preload
 *   Default: false (only enable after submitting to preload list)
 *
 * CSP Configuration:
 * - CSP_REPORT_URI: URI for CSP violation reports
 *   Default: undefined
 *
 * - CSP_REPORT_ONLY: Use report-only mode (doesn't block)
 *   Default: false
 *
 * - FRAME_ANCESTORS: Comma-separated list of frame-ancestors
 *   Default: "'none'"
 *
 * General:
 * - NODE_ENV: Environment (development, staging, production, test)
 *   Affects CSP strictness and HSTS
 */

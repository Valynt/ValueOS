/**
 * CORS Middleware
 *
 * Production-grade CORS implementation with:
 * - Allow-list based origin validation
 * - Proper preflight (OPTIONS) handling
 * - Credentials support (never allows * with credentials)
 * - Regex pattern matching for origins
 * - Logging of blocked requests
 */

import { NextFunction, Request, Response } from 'express';

import { logger } from '../../lib/logger.js';
import { CorsConfig, getSecurityConfig } from './config.js'

// ============================================================================
// Types
// ============================================================================

export interface CorsOptions {
  /**
   * Custom configuration (overrides environment config).
   */
  config?: Partial<CorsConfig>;

  /**
   * Logger function for blocked requests.
   */
  logger?: (message: string, meta?: Record<string, unknown>) => void;

  /**
   * Whether to reject requests from disallowed origins.
   * If false, just doesn't set CORS headers (browser will block).
   * If true, returns 403 for disallowed origins.
   */
  rejectDisallowed?: boolean;
}

export interface CorsResult {
  allowed: boolean;
  origin: string | null;
  reason?: string;
}

// ============================================================================
// Origin Validation
// ============================================================================

/**
 * Compiled regex cache for performance.
 */
const regexCache = new Map<string, RegExp>();

/**
 * Get or create a compiled regex from a pattern string.
 */
function getCompiledRegex(pattern: string): RegExp | null {
  if (regexCache.has(pattern)) {
    return regexCache.get(pattern)!;
  }

  try {
    // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is validated/controlled
    const regex = new RegExp(pattern);
    regexCache.set(pattern, regex);
    return regex;
  } catch {
    return null;
  }
}

/**
 * Check if an origin matches an allowed origin pattern.
 */
function matchesOrigin(origin: string, pattern: string): boolean {
  // Exact match
  if (origin === pattern) {
    return true;
  }

  // Wildcard (only valid when credentials are disabled)
  if (pattern === '*') {
    return true;
  }

  // Regex pattern (starts with ^)
  if (pattern.startsWith('^')) {
    const regex = getCompiledRegex(pattern);
    if (regex) {
      return regex.test(origin);
    }
  }

  return false;
}

/**
 * Validate an origin against the allow-list.
 */
export function validateOrigin(
  origin: string | undefined,
  allowedOrigins: string[]
): CorsResult {
  // No origin header (same-origin request or non-browser client)
  if (!origin) {
    return {
      allowed: true,
      origin: null,
      reason: 'No origin header (same-origin or non-browser)',
    };
  }

  // Check against allow-list
  for (const pattern of allowedOrigins) {
    if (matchesOrigin(origin, pattern)) {
      return {
        allowed: true,
        origin,
      };
    }
  }

  return {
    allowed: false,
    origin,
    reason: `Origin "${origin}" not in allow-list`,
  };
}

// ============================================================================
// CORS Headers
// ============================================================================

/**
 * Set CORS headers on the response.
 */
function setCorsHeaders(
  res: Response,
  origin: string | null,
  config: CorsConfig,
  isPreflight: boolean
): void {
  // Access-Control-Allow-Origin
  // IMPORTANT: Never use * when credentials are enabled
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Access-Control-Allow-Credentials
  if (config.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Vary header - important for caching
  res.setHeader('Vary', 'Origin');

  // Preflight-specific headers
  if (isPreflight) {
    // Access-Control-Allow-Methods
    res.setHeader('Access-Control-Allow-Methods', config.allowedMethods.join(', '));

    // Access-Control-Allow-Headers
    res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

    // Access-Control-Max-Age (preflight cache duration)
    res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
  }

  // Access-Control-Expose-Headers (for actual requests)
  if (!isPreflight && config.exposedHeaders.length > 0) {
    res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Default logger (no-op in production, logger.warn in development).
 */
const defaultLogger = (message: string, meta?: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'development') {
    logger.warn(`[CORS] ${message}`, meta);
  }
};

/**
 * Create CORS middleware with the given options.
 */
export function createCorsMiddleware(options: CorsOptions = {}) {
  const { logger = defaultLogger, rejectDisallowed = false } = options;

  return function corsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Get configuration (merge custom config with defaults)
    const baseConfig = getSecurityConfig().cors;
    const config: CorsConfig = options.config
      ? { ...baseConfig, ...options.config }
      : baseConfig;

    const origin = req.headers.origin;
    const isPreflight = req.method === 'OPTIONS';

    // Validate origin
    const result = validateOrigin(origin, config.allowedOrigins);

    if (!result.allowed) {
      // Log blocked request
      logger('CORS request blocked', {
        origin,
        method: req.method,
        path: req.path,
        reason: result.reason,
        ip: req.ip,
      });

      if (rejectDisallowed) {
        // Explicitly reject with 403
        res.status(403).json({
          error: {
            code: 'CORS_ORIGIN_NOT_ALLOWED',
            message: 'Origin not allowed',
            requestId: req.requestId,
          },
        });
        return;
      }

      // Don't set CORS headers - browser will block
      if (isPreflight) {
        res.status(204).end();
        return;
      }

      next();
      return;
    }

    // Set CORS headers
    setCorsHeaders(res, result.origin, config, isPreflight);

    // Handle preflight
    if (isPreflight) {
      // Check if requested method is allowed
      const requestedMethod = req.headers['access-control-request-method'];
      if (requestedMethod && !config.allowedMethods.includes(requestedMethod.toUpperCase())) {
        logger('CORS preflight: method not allowed', {
          origin,
          requestedMethod,
          allowedMethods: config.allowedMethods,
        });

        if (rejectDisallowed) {
          res.status(403).json({
            error: {
              code: 'CORS_METHOD_NOT_ALLOWED',
              message: `Method ${requestedMethod} not allowed`,
              requestId: req.requestId,
            },
          });
          return;
        }
      }

      // Check if requested headers are allowed
      const requestedHeaders = req.headers['access-control-request-headers'];
      if (requestedHeaders) {
        const requested = requestedHeaders.split(',').map((h) => h.trim().toLowerCase());
        const allowed = config.allowedHeaders.map((h) => h.toLowerCase());

        const disallowed = requested.filter((h) => !allowed.includes(h));
        if (disallowed.length > 0) {
          logger('CORS preflight: headers not allowed', {
            origin,
            requestedHeaders: requested,
            disallowedHeaders: disallowed,
          });

          // Note: We still allow the preflight to succeed
          // The browser will handle header restrictions
        }
      }

      // Successful preflight
      res.status(204).end();
      return;
    }

    // Continue to next middleware for actual requests
    next();
  };
}

/**
 * Pre-configured CORS middleware using environment configuration.
 */
export const corsMiddleware = createCorsMiddleware();

/**
 * Strict CORS middleware that rejects disallowed origins with 403.
 */
export const strictCorsMiddleware = createCorsMiddleware({
  rejectDisallowed: true,
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an origin is allowed (for use outside middleware).
 */
export function isOriginAllowed(origin: string): boolean {
  const config = getSecurityConfig().cors;
  return validateOrigin(origin, config.allowedOrigins).allowed;
}

/**
 * Get the list of allowed origins.
 */
export function getAllowedOrigins(): string[] {
  return getSecurityConfig().cors.allowedOrigins;
}

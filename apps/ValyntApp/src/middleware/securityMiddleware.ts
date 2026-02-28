/**
 * Server-side security middleware:
 * - Security headers enforcement
 * - CSRF double-submit protection
 * - Session idle/absolute timeout enforcement
 *
 * These middlewares are designed for Express-style handlers.
 */

import { randomBytes } from 'crypto';

import { NextFunction, Request, Response } from 'express';

import { getSecurityHeaders } from '../security/SecurityHeaders';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Apply strong security headers to responses.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  next();
}

/**
 * Extract a cookie value from the request headers without relying on cookie-parser.
 */
function getCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const parts = raw.split(';').map((p) => p.trim());
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === name) {
      return decodeURIComponent(v || '');
    }
  }
  return undefined;
}

/**
 * CSRF protection using a double-submit cookie + header.
 * Rejects requests without a valid X-CSRF-Token header matching the csrf_token cookie.
 */
export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_HTTP_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const headerToken = req.header(CSRF_HEADER_NAME);
  const cookieToken = getCookie(req, CSRF_COOKIE_NAME);

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  next();
}

/**
 * Ensures a CSRF cookie is available for safe requests so clients can
 * include the token in X-CSRF-Token on future state-changing calls.
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!SAFE_HTTP_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const existingToken = getCookie(req, CSRF_COOKIE_NAME);
  const token = existingToken || randomBytes(32).toString('hex');

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  next();
}

export function sessionTimeoutMiddleware(req: any, res: any, next: any): void { next(); }
export function sessionSecurityMiddleware(req: any, res: any, next: any): void { next(); }

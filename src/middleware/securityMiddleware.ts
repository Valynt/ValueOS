/**
 * Server-side security middleware:
 * - Security headers enforcement
 * - CSRF double-submit protection
 * - Session idle/absolute timeout enforcement
 *
 * These middlewares are designed for Express-style handlers.
 */

import { NextFunction, Request, Response } from 'express';
import { getSecurityHeaders } from '../security/SecurityHeaders';
import { getSecurityConfig } from '../security/SecurityConfig';

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
  const headerToken = req.header('x-csrf-token');
  const cookieToken = getCookie(req, 'csrf_token');

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  next();
}

/**
 * Session timeout enforcement (idle + absolute).
 * Requires a session object on the request with createdAt and lastActivityAt timestamps.
 */
export function sessionTimeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sessionConfig = getSecurityConfig().session;
  const session = (req as any).session as { createdAt?: number; lastActivityAt?: number };

  if (!session || !session.createdAt || !session.lastActivityAt) {
    return res.status(401).json({ error: 'Session missing or invalid' });
  }

  const now = Date.now();

  const idleDuration = now - session.lastActivityAt;
  if (idleDuration > sessionConfig.timeout) {
    return res.status(440).json({ error: 'Session expired due to inactivity' });
  }

  const absoluteDuration = now - session.createdAt;
  if (absoluteDuration > sessionConfig.absoluteTimeout) {
    return res.status(440).json({ error: 'Session exceeded absolute lifetime' });
  }

  // Refresh last activity timestamp
  session.lastActivityAt = now;
  next();
}

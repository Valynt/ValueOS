/**
 * Server-side security middleware:
 * - Security headers enforcement
 * - CSRF double-submit protection
 * - Session idle/absolute timeout enforcement
 *
 * These middlewares are designed for Express-style handlers.
 */

import { NextFunction, Request, Response } from "express";
import { getSecurityHeaders } from "../security/SecurityHeaders.js";
import { getSecurityConfig } from "../security/SecurityConfig.js";
export { sessionTimeoutMiddleware } from "./sessionTimeoutMiddleware.js";

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
  const parts = raw.split(";").map((p) => p.trim());
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === name) {
      return decodeURIComponent(v || "");
    }
  }
  return undefined;
}

/**
 * CSRF protection using a double-submit cookie + header with SameSite protection.
 * Rejects requests without a valid X-CSRF-Token header matching the csrf_token cookie.
 * Also sets secure cookie attributes for session protection.
 */
export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerToken = req.header("x-csrf-token");
  const cookieToken = getCookie(req, "csrf_token");

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }

  next();
}

/**
 * Enhanced session security middleware - sets secure cookie attributes
 */
export function sessionSecurityMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Set secure session cookie attributes
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const sameSite = isProduction ? "; SameSite=Strict" : "; SameSite=Lax";
  const httpOnly = "; HttpOnly";
  const maxAge = "; Max-Age=86400"; // 24 hours

  // Note: This assumes you're using express-session or similar
  // If using custom session handling, adjust accordingly
  res.setHeader("Set-Cookie", [
    `session_id=; Path=/; ${httpOnly}${secure}${sameSite}${maxAge}`,
    `csrf_token=; Path=/; ${httpOnly}${secure}${sameSite}${maxAge}`,
  ]);

  next();
}

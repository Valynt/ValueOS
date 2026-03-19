/**
 * Server-side security middleware:
 * - Security headers enforcement
 * - CSRF double-submit cookie generation + validation
 * - Session idle/absolute timeout enforcement
 *
 * These middlewares are designed for Express-style handlers.
 */

import crypto from "node:crypto";

import { NextFunction, Request, Response } from "express";

import { getSecurityHeaders } from "../security/SecurityHeaders.js";
export { sessionTimeoutMiddleware } from "./sessionTimeoutMiddleware.js";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_BYTES = 32;
const CSP_NONCE_BYTES = 16;

/**
 * Generate a CSP nonce for routes that render HTML/script responses.
 */
export function cspNonceMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.locals.cspNonce = crypto.randomBytes(CSP_NONCE_BYTES).toString("base64");
  next();
}

/**
 * Apply strong security headers to responses.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const headers = getSecurityHeaders();
  const nonce = typeof res.locals.cspNonce === "string" ? res.locals.cspNonce : undefined;

  for (const [key, value] of Object.entries(headers)) {
    if (key === "Content-Security-Policy" && nonce) {
      const cspWithNonce = value.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`);
      res.setHeader(key, cspWithNonce);
      continue;
    }

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

function buildCookieAttributes(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    "Path=/",
    "SameSite=" + (isProduction ? "Strict" : "Lax"),
    "Max-Age=86400",
  ];
  if (isProduction) {
    parts.push("Secure");
  }
  // The CSRF cookie must be readable by JavaScript so the client can send
  // it back in the X-CSRF-Token header. Do NOT set HttpOnly.
  return parts.join("; ");
}

/**
 * Generate and set a CSRF double-submit cookie if one is not already present.
 * Must be applied before csrfProtectionMiddleware in the middleware chain.
 *
 * The cookie is NOT HttpOnly so the client-side JS can read it and attach
 * it as the X-CSRF-Token header on state-changing requests.
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = getCookie(req, CSRF_COOKIE_NAME);
  if (!existing) {
    const token = crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");
    res.setHeader("Set-Cookie", `${CSRF_COOKIE_NAME}=${token}; ${buildCookieAttributes()}`);
  }
  next();
}

/**
 * CSRF protection using a double-submit cookie + header with SameSite protection.
 * Rejects state-changing requests without a valid X-CSRF-Token header matching
 * the csrf_token cookie.
 *
 * Requires csrfTokenMiddleware to have set the cookie on a prior response.
 */
export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) {
    next();
    return;
  }

  const headerToken = req.header(CSRF_HEADER_NAME);
  const cookieToken = getCookie(req, CSRF_COOKIE_NAME);

  if (!headerToken || !cookieToken || headerToken.length !== cookieToken.length) {
    return void res.status(403).json({ error: "CSRF validation failed" });
  }

  const headerBuf = Buffer.from(headerToken);
  const cookieBuf = Buffer.from(cookieToken);
  if (!crypto.timingSafeEqual(headerBuf, cookieBuf)) {
    return void res.status(403).json({ error: "CSRF validation failed" });
  }

  next();
}

/**
 * Enhanced session security middleware - sets secure cookie attributes
 */
export function sessionSecurityMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  const sameSite = isProduction ? "; SameSite=Strict" : "; SameSite=Lax";
  const httpOnly = "; HttpOnly";
  const maxAge = "; Max-Age=86400";

  res.setHeader("Set-Cookie", [
    `session_id=; Path=/${httpOnly}${secure}${sameSite}${maxAge}`,
  ]);

  next();
}

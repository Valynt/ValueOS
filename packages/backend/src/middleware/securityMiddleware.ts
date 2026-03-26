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

export {
  cspNonceMiddleware,
  securityHeadersMiddleware,
} from "./securityHeaders.js";
export { sessionTimeoutMiddleware } from "./sessionTimeoutMiddleware.js";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_BYTES = 32;
const CSRF_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const CSRF_CLOCK_SKEW_SECONDS = 60;

type CsrfTokenPayload = {
  v: 1;
  iat: number;
  nonce: string;
  sid?: string;
  uid?: string;
};

type CsrfBinding = {
  sessionId?: string;
  userId?: string;
};

function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.TCT_SECRET;
  if (!secret) {
    throw new Error("CSRF signing secret is not configured");
  }
  return secret;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPayload(payloadBase64Url: string): string {
  return crypto.createHmac("sha256", getCsrfSecret()).update(payloadBase64Url).digest("base64url");
}

function createSignedToken(binding?: CsrfBinding): string {
  const payload: CsrfTokenPayload = {
    v: 1,
    iat: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(CSRF_TOKEN_BYTES).toString("base64url"),
  };

  if (binding?.sessionId) {
    payload.sid = binding.sessionId;
  }

  if (binding?.userId) {
    payload.uid = binding.userId;
  }

  const payloadBase64Url = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadBase64Url);
  return `${payloadBase64Url}.${signature}`;
}

function parseSignedToken(token: string): CsrfTokenPayload | null {
  const [payloadBase64Url, signature] = token.split(".");
  if (!payloadBase64Url || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payloadBase64Url);
  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return null;
  }

  try {
    const decoded = Buffer.from(payloadBase64Url, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as Partial<CsrfTokenPayload>;

    if (payload.v !== 1 || typeof payload.iat !== "number" || typeof payload.nonce !== "string") {
      return null;
    }

    if (payload.sid !== undefined && typeof payload.sid !== "string") {
      return null;
    }

    if (payload.uid !== undefined && typeof payload.uid !== "string") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.iat > now + CSRF_CLOCK_SKEW_SECONDS) {
      return null;
    }

    if (now - payload.iat > CSRF_TOKEN_TTL_SECONDS) {
      return null;
    }

    return payload as CsrfTokenPayload;
  } catch {
    return null;
  }
}

function resolveRequestBinding(req: Request): CsrfBinding {
  return {
    sessionId: typeof req.sessionId === "string" ? req.sessionId : undefined,
    userId: typeof req.user?.id === "string" ? req.user.id : undefined,
  };
}

function appendSetCookie(res: Response, cookieValue: string): void {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
    return;
  }

  res.setHeader("Set-Cookie", [String(existing), cookieValue]);
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

export function issueCsrfTokenForBinding(res: Response, binding?: CsrfBinding): string {
  const token = createSignedToken(binding);
  appendSetCookie(res, `${CSRF_COOKIE_NAME}=${token}; ${buildCookieAttributes()}`);
  return token;
}

export function clearCsrfToken(res: Response): void {
  appendSetCookie(res, `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`);
}

/**
 * Generate and set a signed CSRF cookie if one is not already present.
 * Must be applied before csrfProtectionMiddleware in the middleware chain.
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = getCookie(req, CSRF_COOKIE_NAME);
  if (!existing) {
    issueCsrfTokenForBinding(res, resolveRequestBinding(req));
  }
  next();
}

/**
 * CSRF protection using a signed double-submit cookie + header with SameSite protection.
 * Rejects state-changing requests without a valid X-CSRF-Token header matching
 * the csrf_token cookie and a fresh HMAC signature.
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

  const payload = parseSignedToken(headerToken);
  if (!payload) {
    return void res.status(403).json({ error: "CSRF validation failed" });
  }

  const expectedBinding = resolveRequestBinding(req);
  if (expectedBinding.sessionId && payload.sid !== expectedBinding.sessionId) {
    return void res.status(403).json({ error: "CSRF validation failed" });
  }

  if (expectedBinding.userId && payload.uid !== expectedBinding.userId) {
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

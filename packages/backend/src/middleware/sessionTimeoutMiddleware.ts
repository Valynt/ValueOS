/**
 * Phase 1: Session Timeout Middleware
 *
 * Enforces:
 * - Absolute timeout: 1 hour (3600s)
 * - Idle timeout: 30 minutes (1800s)
 * - Forced re-authentication and logout invalidation via the shared session store
 */

import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';

import { logger } from '../lib/logger.js';
import { verifyAccessToken } from './auth.js';
import { getSessionStore } from '../security/RedisSessionStore.js';
import type { SessionMetadata } from '../security/RedisSessionStore.js';

const sessionStore = getSessionStore();

// Session configuration
const SESSION_CONFIG = {
  ABSOLUTE_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour
  IDLE_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  STRICT_IDLE_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes for sensitive routes
  CLOCK_SKEW_MS: 5 * 1000, // 5 seconds tolerance
};

/**
 * Extract JWT from Authorization header.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

interface UserWithMetadata {
  user_metadata?: { tenant_id?: string };
  app_metadata?: { tenant_id?: string };
  tenant_id?: string;
}

interface SessionIdentity {
  sessionId: string;
  userId: string;
  tenantId?: string;
  issuedAt: number;
  expiresAt: number;
}

function extractTenantId(claims: JwtPayload | null, user?: UserWithMetadata): string | undefined {
  const appMeta = claims?.app_metadata as Record<string, unknown> | undefined;
  return (
    (claims?.tenant_id as string | undefined) ??
    (claims?.organization_id as string | undefined) ??
    (appMeta?.tenant_id as string | undefined) ??
    user?.user_metadata?.tenant_id ??
    user?.app_metadata?.tenant_id ??
    user?.tenant_id
  );
}

function getNumericClaim(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getStringClaim(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function decodeTokenClaims(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    const claims = JSON.parse(payload) as JwtPayload;
    return claims;
  } catch {
    return null;
  }
}

function resolveSessionIdentity(claims: JwtPayload, user?: UserWithMetadata): SessionIdentity | null {
  const userId = getStringClaim(claims.sub);
  const issuedAt = getNumericClaim(claims.iat);
  const expiresAt = getNumericClaim(claims.exp);
  const sessionId =
    getStringClaim(claims.session_id) ??
    getStringClaim(claims.sid) ??
    getStringClaim(claims.jti) ??
    (userId && issuedAt ? `${userId}:${issuedAt}` : undefined);

  if (!userId || !issuedAt || !expiresAt || !sessionId) {
    return null;
  }

  return {
    sessionId,
    userId,
    tenantId: extractTenantId(claims, user),
    issuedAt,
    expiresAt,
  };
}

function buildSessionMetadata(identity: SessionIdentity, nowMs: number): SessionMetadata {
  const issuedAtMs = identity.issuedAt * 1000;
  const jwtAbsoluteExpiryMs = identity.expiresAt * 1000;
  const configuredAbsoluteExpiryMs = issuedAtMs + SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS;

  return {
    sessionId: identity.sessionId,
    userId: identity.userId,
    tenantId: identity.tenantId,
    createdAt: issuedAtMs,
    lastActivityAt: nowMs,
    absoluteExpiresAt: Math.min(jwtAbsoluteExpiryMs, configuredAbsoluteExpiryMs),
    idleExpiresAt: nowMs + SESSION_CONFIG.IDLE_TIMEOUT_MS,
  };
}

async function loadOrCreateSession(identity: SessionIdentity, nowMs: number): Promise<SessionMetadata> {
  const existingSession = await sessionStore.get(identity.sessionId, identity.tenantId);
  if (existingSession) {
    return existingSession;
  }

  const newSession = buildSessionMetadata(identity, nowMs);
  await sessionStore.set(identity.sessionId, newSession);
  return newSession;
}

function setSessionHeaders(res: Response, absoluteRemainingSeconds: number, idleRemainingSeconds: number): void {
  res.setHeader('X-Session-Expires-In', String(Math.max(0, absoluteRemainingSeconds)));
  res.setHeader('X-Session-Idle-Timeout', String(Math.max(0, idleRemainingSeconds)));
}

async function validateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  options: { requireAuthentication: boolean; idleTimeoutMs: number }
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    if (!options.requireAuthentication) {
      return next();
    }

    return void res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const verified = await verifyAccessToken(token, { route: req.path, method: req.method });
    if (!verified) {
      return void res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    const claims = verified.claims as JwtPayload;
    const identity = resolveSessionIdentity(claims, verified.user);
    const nowMs = Date.now();
    const nowSeconds = Math.floor(nowMs / 1000);

    if (!identity) {
      return void res.status(401).json({
        error: 'Token missing required claims',
        code: 'INVALID_TOKEN_CLAIMS',
      });
    }

    if (identity.expiresAt + SESSION_CONFIG.CLOCK_SKEW_MS / 1000 < nowSeconds) {
      await sessionStore.invalidateSession(identity.sessionId, identity.tenantId, identity.expiresAt * 1000);
      return void res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        expiresAt: identity.expiresAt,
        currentTime: nowSeconds,
      });
    }

    if (await sessionStore.isSessionRevoked(identity.sessionId, identity.tenantId)) {
      return void res.status(401).json({
        error: 'Session has been invalidated',
        code: 'SESSION_REVOKED',
      });
    }

    const sessionMetadata = await loadOrCreateSession(identity, nowMs);
    const absoluteRemainingMs = sessionMetadata.absoluteExpiresAt - nowMs;

    if (absoluteRemainingMs + SESSION_CONFIG.CLOCK_SKEW_MS <= 0) {
      await sessionStore.invalidateSession(identity.sessionId, identity.tenantId, sessionMetadata.absoluteExpiresAt);
      return void res.status(401).json({
        error: 'Session expired due to absolute timeout (1 hour)',
        code: 'SESSION_ABSOLUTE_TIMEOUT',
        maxAge: SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS / 1000,
      });
    }

    if (sessionMetadata.securityFlags?.forceReauth) {
      return void res.status(401).json({
        error: 'Session requires re-authentication',
        code: 'SESSION_REAUTH_REQUIRED',
      });
    }

    const idleRemainingMs = sessionMetadata.lastActivityAt + options.idleTimeoutMs - nowMs;
    if (idleRemainingMs + SESSION_CONFIG.CLOCK_SKEW_MS <= 0) {
      await sessionStore.invalidateSession(identity.sessionId, identity.tenantId, sessionMetadata.absoluteExpiresAt);
      return void res.status(440).json({
        error:
          options.idleTimeoutMs === SESSION_CONFIG.STRICT_IDLE_TIMEOUT_MS
            ? 'Sensitive operation timeout (10 minutes idle)'
            : 'Session expired due to inactivity (30 minutes idle)',
        code:
          options.idleTimeoutMs === SESSION_CONFIG.STRICT_IDLE_TIMEOUT_MS
            ? 'STRICT_SESSION_TIMEOUT'
            : 'SESSION_IDLE_TIMEOUT',
        idleTime: Math.floor((nowMs - sessionMetadata.lastActivityAt) / 1000),
        maxIdle: Math.floor(options.idleTimeoutMs / 1000),
      });
    }

    await sessionStore.updateActivity(identity.sessionId, identity.tenantId);

    const tenantId = identity.tenantId;
    const userWithTenant = verified.user
      ? { ...verified.user, tenant_id: tenantId ?? verified.user.tenant_id }
      : {
          id: identity.userId,
          sessionId: identity.sessionId,
          tokenIssuedAt: identity.issuedAt,
          tokenExpiresAt: identity.expiresAt,
          tenant_id: tenantId,
        };

    req.user = userWithTenant;
    req.tenantId = tenantId;
    req.sessionId = identity.sessionId;

    setSessionHeaders(
      res,
      Math.min(identity.expiresAt - nowSeconds, Math.floor(absoluteRemainingMs / 1000)),
      Math.floor(options.idleTimeoutMs / 1000)
    );

    next();
  } catch (error) {
    logger.error('Session timeout middleware error', { error });
    return void res.status(500).json({
      error: 'Session validation failed',
      code: 'SESSION_VALIDATION_ERROR',
    });
  }
}

/**
 * Session timeout middleware
 */
export async function sessionTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return validateSession(req, res, next, {
    requireAuthentication: false,
    idleTimeoutMs: SESSION_CONFIG.IDLE_TIMEOUT_MS,
  });
}

/**
 * Strict session timeout middleware (for sensitive routes)
 */
export async function strictSessionTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return validateSession(req, res, next, {
    requireAuthentication: true,
    idleTimeoutMs: SESSION_CONFIG.STRICT_IDLE_TIMEOUT_MS,
  });
}

/**
 * Helper: Invalidate session (logout)
 */
export async function invalidateSession(req: Request): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    return;
  }

  const claims = decodeTokenClaims(token);
  if (!claims) {
    return;
  }

  const identity = resolveSessionIdentity(claims);
  if (!identity) {
    return;
  }

  await sessionStore.invalidateSession(identity.sessionId, identity.tenantId, identity.expiresAt * 1000);
}

/**
 * Helper: Get remaining session time
 */
export async function getSessionTimeRemaining(
  req: Request
): Promise<{
  absoluteRemaining: number;
  idleRemaining: number;
} | null> {
  const token = extractToken(req);
  if (!token) {
    return null;
  }

  const claims = decodeTokenClaims(token);
  if (!claims) {
    return null;
  }

  const identity = resolveSessionIdentity(claims);
  if (!identity) {
    return null;
  }

  const sessionMetadata = await sessionStore.get(identity.sessionId, identity.tenantId);
  if (!sessionMetadata) {
    return null;
  }

  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);

  return {
    absoluteRemaining: Math.max(0, Math.min(identity.expiresAt - nowSeconds, Math.floor((sessionMetadata.absoluteExpiresAt - nowMs) / 1000))),
    idleRemaining: Math.max(0, Math.floor((sessionMetadata.idleExpiresAt - nowMs) / 1000)),
  };
}

export default sessionTimeoutMiddleware;

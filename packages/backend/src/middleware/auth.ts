/**
 * Authentication middleware for Express routes
 * Verifies user sessions using Supabase auth
 */

import { createHash } from 'node:crypto';

import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

// Re-export requireRole from rbac for convenience
export { requireRole } from './rbac.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    roles?: string[];
    tenant_id?: string;
    [key: string]: unknown;
  };
  tenantId?: string;
  correlationId?: string;
  organizationId?: string;
}
import { auditLogService } from '../services/AuditLogService.js';
import { authService } from '../services/auth/AuthService.js'
import { AuthenticationError } from '../services/errors.js'

import { createLogger, LogContext } from '@shared/lib/logger';
import { sanitizeForLogging } from '@shared/lib/piiFilter';
import { createRequestSupabaseClient, getSupabaseClient } from '@shared/lib/supabase';
import { getEnvVar } from '@shared/lib/env';
import { getRedisClient } from '@shared/lib/redisClient';

const logger = createLogger({ component: 'AuthMiddleware' });

const SUPABASE_TOKEN_PREFIX = 'Bearer ';
const ALLOW_LOCAL_JWT_FALLBACK_FLAG = 'ALLOW_LOCAL_JWT_FALLBACK';
const AUTH_FALLBACK_EMERGENCY_MODE_FLAG = 'AUTH_FALLBACK_EMERGENCY_MODE';
const AUTH_FALLBACK_EMERGENCY_TTL_UNTIL = 'AUTH_FALLBACK_EMERGENCY_TTL_UNTIL';
const AUTH_FALLBACK_ALERT_THRESHOLD = 'AUTH_FALLBACK_ALERT_THRESHOLD';
const AUTH_FALLBACK_ALERT_WINDOW_SECONDS = 'AUTH_FALLBACK_ALERT_WINDOW_SECONDS';

// In-process fallback: used only when Redis is unavailable.
// Accurate only within a single process instance — do not rely on this for
// multi-instance deployments. Redis-backed counting is the primary path.
const fallbackActivations: number[] = [];
const FALLBACK_COUNTER_REDIS_KEY = 'auth:fallback:activations';

type VerificationContext = {
  route?: string;
  method?: string;
};

type AuthUser = {
  id?: string;
  email?: string;
  role?: string | string[];
  tenant_id?: string;
  app_metadata?: {
    tenant_id?: string;
    roles?: unknown;
    tier?: string;
  };
  user_metadata?: Record<string, unknown>;
};

type AuthSession = {
  access_token?: string;
  token_type?: string;
  expires_at?: number;
  expires_in?: number;
  user?: AuthUser;
};

/** Result of verifyAccessToken / verifyTokenWithSupabase / verifyTokenLocally */
type VerifiedAuth = {
  user: AuthUser;
  session: AuthSession;
  claims: JwtPayload;
};

function allowLocalJwtFallback(): boolean {
  return getEnvVar(ALLOW_LOCAL_JWT_FALLBACK_FLAG) === 'true';
}

function isDevelopmentEnvironment(): boolean {
  return getEnvVar('NODE_ENV', { defaultValue: 'development' }) === 'development';
}

function isFallbackEmergencyModeEnabled(): boolean {
  if (getEnvVar(AUTH_FALLBACK_EMERGENCY_MODE_FLAG) !== 'true') {
    return false;
  }

  const ttlUntil = getEnvVar(AUTH_FALLBACK_EMERGENCY_TTL_UNTIL);
  if (!ttlUntil) {
    if (!isDevelopmentEnvironment()) {
      logger.error('Fallback emergency mode requires explicit TTL in non-dev environments', undefined, {
        flag: AUTH_FALLBACK_EMERGENCY_TTL_UNTIL,
      });
      return false;
    }

    return true;
  }

  const ttlDate = new Date(ttlUntil);
  if (Number.isNaN(ttlDate.getTime())) {
    logger.error('Invalid fallback TTL timestamp; refusing local JWT fallback', undefined, {
      flag: AUTH_FALLBACK_EMERGENCY_TTL_UNTIL,
      value: sanitizeForLogging(ttlUntil),
    });
    return false;
  }

  return ttlDate.getTime() > Date.now();
}

function parseBearerToken(header?: string): string | null {
  if (!header) return null;
  if (!header.startsWith(SUPABASE_TOKEN_PREFIX)) return null;
  const token = header.slice(SUPABASE_TOKEN_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

function decodeClaims(token: string): JwtPayload | null {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === 'string') {
    return null;
  }
  return decoded as JwtPayload;
}

function parseStringListEnv(varName: string): string[] {
  const rawValue = getEnvVar(varName);
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function validateFallbackClaims(claims: JwtPayload): { ok: boolean; reason?: string } {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const maxTokenAgeSeconds = Number(getEnvVar('AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS') || '86400');
  const allowedClockSkewSeconds = Number(getEnvVar('AUTH_FALLBACK_CLOCK_SKEW_SECONDS') || '60');

  const allowedIssuers = parseStringListEnv('SUPABASE_JWT_ISSUER');
  const allowedAudiences = parseStringListEnv('SUPABASE_JWT_AUDIENCE');

  if (allowedIssuers.length === 0 || allowedAudiences.length === 0) {
    return { ok: false, reason: 'issuer_or_audience_not_configured' };
  }

  if (!claims.iss || !allowedIssuers.includes(claims.iss)) {
    return { ok: false, reason: 'issuer_mismatch' };
  }

  {
    const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    const matchesAudience = audiences.some((audience) => allowedAudiences.includes(audience));
    if (!matchesAudience) {
      return { ok: false, reason: 'audience_mismatch' };
    }
  }

  if (!claims.exp || claims.exp <= nowInSeconds - allowedClockSkewSeconds) {
    return { ok: false, reason: 'expired_or_missing_exp' };
  }

  if (claims.nbf && claims.nbf > nowInSeconds + allowedClockSkewSeconds) {
    return { ok: false, reason: 'token_not_yet_valid' };
  }

  if (!claims.iat || claims.iat > nowInSeconds + allowedClockSkewSeconds) {
    return { ok: false, reason: 'invalid_iat' };
  }

  if (claims.exp <= claims.iat || nowInSeconds - claims.iat > maxTokenAgeSeconds) {
    return { ok: false, reason: 'token_age_invalid' };
  }

  if (!extractTenantId(claims)) {
    return { ok: false, reason: 'tenant_claim_missing' };
  }

  return { ok: true };
}

async function isTokenRevoked(token: string, claims: JwtPayload): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    logger.warn('Redis unavailable for token revocation checks in fallback mode');
    return false;
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const revocationKeys = [
    claims.jti ? `auth:revoked:jti:${claims.jti}` : null,
    typeof claims.sid === 'string' ? `auth:revoked:sid:${claims.sid}` : null,
    typeof claims.session_id === 'string' ? `auth:revoked:session:${claims.session_id}` : null,
    `auth:revoked:token:${tokenHash}`,
  ].filter((key): key is string => Boolean(key));

  try {
    const revokedCount = await redis.exists(revocationKeys);
    return revokedCount > 0;
  } catch (error) {
    logger.warn('Revocation check failed during fallback validation', sanitizeForLogging(error) as LogContext);
    return false;
  }
}

async function recordFallbackActivation(alertContext: Record<string, unknown>): Promise<void> {
  const now = Date.now();
  const threshold = Number(getEnvVar(AUTH_FALLBACK_ALERT_THRESHOLD) || '5');
  const windowSeconds = Number(getEnvVar(AUTH_FALLBACK_ALERT_WINDOW_SECONDS) || '300');
  const windowMs = windowSeconds * 1000;

  let activationsInWindow: number;

  try {
    const redis = await getRedisClient();
    if (redis) {
      // Use a sorted set keyed by timestamp. Each activation is a member scored
      // by its epoch-ms timestamp. ZREMRANGEBYSCORE prunes entries outside the
      // window, then ZADD adds the new one, then ZCARD counts the survivors.
      // The key expires automatically after the window so it self-cleans.
      // ioredis API: zadd(key, score, member), zremrangebyscore, zcard, expireat.
      const member = `${now}:${Math.random().toString(36).slice(2)}`;
      const expireAtSeconds = Math.floor(now / 1000) + windowSeconds + 1;

      await redis.zremrangebyscore(FALLBACK_COUNTER_REDIS_KEY, '-inf', now - windowMs);
      await redis.zadd(FALLBACK_COUNTER_REDIS_KEY, now, member);
      await redis.expireat(FALLBACK_COUNTER_REDIS_KEY, expireAtSeconds);
      activationsInWindow = await redis.zcard(FALLBACK_COUNTER_REDIS_KEY);
    } else {
      // Redis unavailable — fall back to in-process array (single-instance only).
      fallbackActivations.push(now);
      while (fallbackActivations.length > 0 && (fallbackActivations[0] ?? 0) < now - windowMs) {
        fallbackActivations.shift();
      }
      activationsInWindow = fallbackActivations.length;
    }
  } catch (err) {
    // Redis error — degrade to in-process counter rather than dropping the alert.
    logger.warn('recordFallbackActivation: Redis error, using in-process counter', {
      error: err instanceof Error ? err.message : String(err),
    });
    fallbackActivations.push(now);
    while (fallbackActivations.length > 0 && (fallbackActivations[0] ?? 0) < now - windowMs) {
      fallbackActivations.shift();
    }
    activationsInWindow = fallbackActivations.length;
  }

  if (activationsInWindow >= threshold) {
    logger.error('High-severity alert: JWT fallback usage spike detected', undefined, {
      severity: 'critical',
      threshold,
      activationsInWindow,
      windowMs,
      ...alertContext,
    });
  }
}

async function emitFallbackAuditEvent(context: {
  route?: string;
  method?: string;
  tenantId?: string;
  reason: string;
}) {
  const details = {
    severity: 'critical',
    route: sanitizeForLogging(context.route || 'unknown'),
    method: context.method || 'UNKNOWN',
    tenantId: sanitizeForLogging(context.tenantId || 'unknown'),
    reason: context.reason,
    fallbackMode: true,
  };

  logger.error('Emergency JWT fallback activated', undefined, details);
  await recordFallbackActivation(details);

  try {
    await auditLogService.logAudit({
      userId: 'system',
      userName: 'System',
      userEmail: 'system@valueos.local',
      action: 'auth.jwt_fallback_activated',
      resourceType: 'authentication',
      resourceId: context.route || 'unknown_route',
      status: 'success',
      details: {
        reason: context.reason,
        tenantId: context.tenantId,
        route: context.route,
        method: context.method,
      },
    });
  } catch (error) {
    logger.error('Failed to persist fallback activation audit event', error instanceof Error ? error : undefined, sanitizeForLogging(error) as LogContext);
  }
}

function buildSessionFromClaims(token: string, claims: JwtPayload) {
  const user = {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    tenant_id: claims.tenant_id ?? claims.organization_id,
    app_metadata: claims.app_metadata,
    user_metadata: claims.user_metadata,
  };

  return {
    access_token: token,
    token_type: 'bearer',
    expires_at: claims.exp,
    expires_in: claims.exp ? claims.exp - Math.floor(Date.now() / 1000) : undefined,
    user,
  };
}

export function extractTenantId(claims: JwtPayload | null, user?: AuthUser): string | undefined {
  return (
    (claims?.tenant_id as string | undefined) ??
    (claims?.organization_id as string | undefined) ??
    (claims?.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ??
    (user?.app_metadata?.tenant_id as string | undefined) ??
    (user?.tenant_id as string | undefined)
  );
}

function readStringRecordValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function extractRequestedTenantId(req: Request): string | undefined {
  const params = req.params as Record<string, string | undefined>;
  const query = req.query as Record<string, string | string[] | undefined>;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const queryValue = (key: string): string | undefined => {
    const value = query[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === 'string' && first.length > 0 ? first : undefined;
    }
    return undefined;
  };

  const context = body.context;
  const contextRecord = context && typeof context === 'object' ? (context as Record<string, unknown>) : undefined;

  return (
    params.tenantId ??
    params.tenant_id ??
    params.organizationId ??
    params.organization_id ??
    req.header('x-tenant-id') ??
    req.header('x-organization-id') ??
    queryValue('tenantId') ??
    queryValue('tenant_id') ??
    queryValue('organizationId') ??
    queryValue('organization_id') ??
    readStringRecordValue(body, 'tenantId') ??
    readStringRecordValue(body, 'tenant_id') ??
    readStringRecordValue(body, 'organizationId') ??
    readStringRecordValue(body, 'organization_id') ??
    (contextRecord ? readStringRecordValue(contextRecord, 'tenantId') : undefined) ??
    (contextRecord ? readStringRecordValue(contextRecord, 'tenant_id') : undefined) ??
    (contextRecord ? readStringRecordValue(contextRecord, 'organizationId') : undefined) ??
    (contextRecord ? readStringRecordValue(contextRecord, 'organization_id') : undefined)
  );
}

type TenantGuardRejectionReason = 'token_tenant_missing' | 'requested_tenant_missing' | 'tenant_mismatch';

async function logTenantGuardRejection(
  req: AuthenticatedRequest,
  reason: TenantGuardRejectionReason,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await auditLogService.logAudit({
      userId: req.user?.id ?? 'unknown',
      userName: req.user?.email ?? 'Unknown User',
      userEmail: req.user?.email ?? 'unknown@valueos.local',
      action: 'auth.tenant_guard_rejected',
      resourceType: 'tenant_access',
      resourceId: req.path || 'unknown_path',
      status: 'failed',
      details: {
        reason,
        method: req.method,
        path: req.path,
        requestId: (req as Record<string, unknown>).requestId,
        ...details,
      },
    });
  } catch (error) {
    logger.error('Failed to write tenant guard rejection audit log', error instanceof Error ? error : undefined, {
      reason,
      path: sanitizeForLogging(req.path),
    });
  }
}

export function requireTenantRequestAlignment() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const tokenTenantId =
      authReq.tenantId ||
      authReq.user?.tenant_id ||
      (authReq.user?.organization_id as string | undefined) ||
      authReq.organizationId;
    const requestedTenantId = extractRequestedTenantId(req);

    if (!tokenTenantId) {
      await logTenantGuardRejection(authReq, 'token_tenant_missing', {
        requestedTenantId,
      });
      res.status(403).json({
        error: 'tenant_forbidden',
        message: 'Authenticated token must include tenant context.',
      });
      return;
    }

    if (!requestedTenantId) {
      await logTenantGuardRejection(authReq, 'requested_tenant_missing', {
        tokenTenantId,
      });
      res.status(403).json({
        error: 'tenant_required',
        message: 'Requested tenant context is required.',
      });
      return;
    }

    if (tokenTenantId !== requestedTenantId) {
      await logTenantGuardRejection(authReq, 'tenant_mismatch', {
        tokenTenantId,
        requestedTenantId,
      });
      res.status(403).json({
        error: 'tenant_mismatch',
        message: 'Requested tenant does not match authenticated tenant.',
      });
      return;
    }

    next();
  };
}

function applyAuthContext(req: Request, user: AuthUser | undefined, session: AuthSession | undefined, claims: JwtPayload | null) {
  const tenantId = extractTenantId(claims, user);
  const userWithTenant = user ? { ...user, tenant_id: tenantId ?? user.tenant_id } : user;

  const authReq = req as AuthenticatedRequest;
  authReq.user = userWithTenant as AuthenticatedRequest["user"];
  (req as Record<string, unknown>).session = session;
  authReq.tenantId = tenantId;
}

function ensureAuthHeader(req: Request, token?: string | null) {
  if (!token) return;
  if (req.headers.authorization) return;
  (req.headers as Record<string, string>).authorization = `Bearer ${token}`;
}

async function verifyTokenWithSupabase(token: string): Promise<VerifiedAuth | null> {
  try {
    const supabaseClient = getSupabaseClient();
    const { data, error } = await supabaseClient.auth.getUser(token);

    if (error || !data?.user) {
      return null;
    }

    let claims = decodeClaims(token) ?? {};
    if (!claims.sub && data.user.id) {
      claims = { ...claims, sub: data.user.id };
    }

    const session = buildSessionFromClaims(token, claims as JwtPayload);
    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
      tenant_id: data.user.app_metadata?.tenant_id as string | undefined,
      app_metadata: data.user.app_metadata as AuthUser['app_metadata'],
      user_metadata: data.user.user_metadata,
    };

    return {
      user,
      session,
      claims: claims as JwtPayload,
    };
  } catch (error) {
    logger.debug('Supabase token verification unavailable', sanitizeForLogging(error) as LogContext);
    return null;
  }
}

async function verifyTokenLocally(token: string, context: VerificationContext = {}): Promise<VerifiedAuth | null> {
  const emergencyModeEnabled = isFallbackEmergencyModeEnabled();
  const devExplicitFallback = isDevelopmentEnvironment() && allowLocalJwtFallback();

  if (!emergencyModeEnabled && !devExplicitFallback) {
    logger.warn(
      `Local JWT verification fallback disabled; set ${AUTH_FALLBACK_EMERGENCY_MODE_FLAG}=true with TTL for break-glass usage`
    );
    return null;
  }

  const secret = getEnvVar('SUPABASE_JWT_SECRET') || getEnvVar('JWT_SECRET');
  if (!secret) {
    logger.warn('JWT secret missing; local token verification disabled');
    return null;
  }

  try {
    const claims = jwt.verify(token, secret, { algorithms: ["HS256"] }) as JwtPayload;
    if (!claims?.sub) {
      return null;
    }

    const fallbackValidation = validateFallbackClaims(claims);
    if (!fallbackValidation.ok) {
      logger.warn('Local fallback token validation rejected token', {
        reason: fallbackValidation.reason,
        route: sanitizeForLogging(context.route),
      });
      return null;
    }

    const revoked = await isTokenRevoked(token, claims);
    if (revoked) {
      logger.warn('Local fallback rejected revoked token', {
        route: sanitizeForLogging(context.route),
        tokenSubject: sanitizeForLogging(claims.sub),
      });
      return null;
    }

    await emitFallbackAuditEvent({
      route: context.route,
      method: context.method,
      tenantId: extractTenantId(claims),
      reason: emergencyModeEnabled ? 'idp_unavailable_emergency_mode' : 'dev_explicit_fallback',
    });

    const session = buildSessionFromClaims(token, claims);
    return { user: session.user, session, claims };
  } catch (error) {
    logger.debug('Local token verification failed', sanitizeForLogging(error) as LogContext);
    return null;
  }
}

export async function verifyAccessToken(token: string, context: VerificationContext = {}): Promise<VerifiedAuth | null> {
  const supabaseSession = await verifyTokenWithSupabase(token);
  if (supabaseSession) {
    return supabaseSession;
  }

  return verifyTokenLocally(token, context);
}

/**
 * Middleware to require authentication for protected routes
 * Adds user and session to request object if authenticated
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = parseBearerToken(authHeader);

    let session: AuthSession | null = null;
    let user: AuthUser | null = null;
    let claims: JwtPayload | null = null;

    // Try to get session from various sources
    if (bearerToken) {
      const verified = await verifyAccessToken(bearerToken, { route: req.path, method: req.method });
      if (!verified) {
        throw new AuthenticationError('Invalid or expired token');
      }

      session = verified.session;
      user = verified.user;
      claims = verified.claims ?? null;
    } else {
      // Try to get current session from Supabase (may be from cookies)
      const supabaseSession = await authService.getSession();
      if (supabaseSession?.access_token) {
        const verified = await verifyAccessToken(supabaseSession.access_token, { route: req.path, method: req.method });
        if (!verified) {
          throw new AuthenticationError('Invalid or expired token');
        }

        session = verified.session;
        user = verified.user;
        claims = verified.claims ?? null;
      } else {
        throw new AuthenticationError('Authentication required');
      }
    }

    if (!session || !user) {
      logger.warn('Authentication required but no valid session found', {
        path: sanitizeForLogging(req.path),
        method: req.method,
        ip: sanitizeForLogging(req.ip)
      });

      throw new AuthenticationError('Authentication required');
    }

    // Add user and session to request for use in handlers
    applyAuthContext(req, user, session, claims);
    ensureAuthHeader(req, session.access_token);
    createRequestSupabaseClient(req);

    logger.debug('Authentication successful', {
      userId: sanitizeForLogging(user.id) as string | undefined,
      path: sanitizeForLogging(req.path) as string | undefined,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', error instanceof Error ? error : undefined, sanitizeForLogging(error) as LogContext);

    if (error instanceof AuthenticationError) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Authentication service error' });
  }
}

/**
 * Optional authentication middleware
 * Adds user/session to request if authenticated, but doesn't fail if not
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const bearerToken = parseBearerToken(req.headers.authorization);
    let session: AuthSession | null = null;
    let user: AuthUser | null = null;
    let claims: JwtPayload | null = null;

    if (bearerToken) {
      const verified = await verifyAccessToken(bearerToken, { route: req.path, method: req.method });
      session = verified?.session ?? null;
      user = verified?.user ?? null;
      claims = verified?.claims ?? null;
    } else {
      const supabaseSession = await authService.getSession();
      if (supabaseSession?.access_token) {
        const verified = await verifyAccessToken(supabaseSession.access_token, { route: req.path, method: req.method });
        session = verified?.session ?? null;
        user = verified?.user ?? null;
        claims = verified?.claims ?? null;
      }
    }

    if (user && session) {
      applyAuthContext(req, user, session, claims);
      ensureAuthHeader(req, session.access_token);
      createRequestSupabaseClient(req);

      logger.debug('Optional authentication successful', {
        userId: sanitizeForLogging(user.id) as string | undefined,
        path: sanitizeForLogging(req.path) as string | undefined
      });
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on errors - just continue without auth
    logger.debug('Optional authentication failed, continuing without auth', {
      error: sanitizeForLogging(error),
      path: sanitizeForLogging(req.path)
    });

    next();
  }
}

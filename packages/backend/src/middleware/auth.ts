/**
 * Authentication middleware for Express routes
 * Verifies user sessions using Supabase auth
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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
import { authService } from '../services/auth/AuthService.js'
import { auditLogService } from '../services/AuditLogService.js';
import { AuthenticationError } from '../services/errors.js'

import { createLogger, LogContext } from '@shared/lib/logger';
import { sanitizeForLogging } from '@shared/lib/piiFilter';
import { createRequestRlsSupabaseClient, createServiceRoleSupabaseClient } from '../lib/supabase.js';
import { getEnvVar } from '@shared/lib/env';
import { getRedisClient } from '@shared/lib/redisClient';
import { authFallbackActivationsTotal } from '../metrics/authMetrics.js';

const logger = createLogger({ component: 'AuthMiddleware' });

const SUPABASE_TOKEN_PREFIX = 'Bearer ';
const AUTH_FALLBACK_EMERGENCY_MODE_FLAG = 'AUTH_FALLBACK_EMERGENCY_MODE';
const LEGACY_LOCAL_JWT_FALLBACK_FLAG = 'ALLOW_LOCAL_JWT_FALLBACK';
const AUTH_FALLBACK_EMERGENCY_TTL_UNTIL = 'AUTH_FALLBACK_EMERGENCY_TTL_UNTIL';
const AUTH_FALLBACK_INCIDENT_ID = 'AUTH_FALLBACK_INCIDENT_ID';
const AUTH_FALLBACK_INCIDENT_SEVERITY = 'AUTH_FALLBACK_INCIDENT_SEVERITY';
const AUTH_FALLBACK_INCIDENT_STARTED_AT = 'AUTH_FALLBACK_INCIDENT_STARTED_AT';
const AUTH_FALLBACK_INCIDENT_CORRELATION_ID = 'AUTH_FALLBACK_INCIDENT_CORRELATION_ID';
const AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE = 'AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE';
const AUTH_FALLBACK_INCIDENT_SIGNING_SECRET = 'AUTH_FALLBACK_INCIDENT_SIGNING_SECRET';
const AUTH_FALLBACK_APPROVAL_TOKEN = 'AUTH_FALLBACK_APPROVAL_TOKEN';
const AUTH_FALLBACK_APPROVAL_SIGNING_SECRET = 'AUTH_FALLBACK_APPROVAL_SIGNING_SECRET';
const AUTH_FALLBACK_MAINTENANCE_WINDOW_START = 'AUTH_FALLBACK_MAINTENANCE_WINDOW_START';
const AUTH_FALLBACK_MAINTENANCE_WINDOW_END = 'AUTH_FALLBACK_MAINTENANCE_WINDOW_END';
const AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS = 'AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS';
const AUTH_FALLBACK_ALERT_THRESHOLD = 'AUTH_FALLBACK_ALERT_THRESHOLD';
const AUTH_FALLBACK_ALERT_WINDOW_SECONDS = 'AUTH_FALLBACK_ALERT_WINDOW_SECONDS';
const AUTH_FALLBACK_ALLOWED_ROUTES = 'AUTH_FALLBACK_ALLOWED_ROUTES';
const AUTH_FALLBACK_ALLOWED_METHODS = 'AUTH_FALLBACK_ALLOWED_METHODS';
const AUTH_FALLBACK_HARD_MAX_TTL_SECONDS = 30 * 60;
const AUTH_FALLBACK_INCIDENT_ID_PATTERN = /^INC-\d{4,}$/;
const FALLBACK_APPROVAL_ACTOR_PATTERN = /^[a-z0-9._:-]{3,128}$/i;
const FALLBACK_READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// In-process fallback: used only when Redis is unavailable.
// Accurate only within a single process instance — do not rely on this for
// multi-instance deployments. Redis-backed counting is the primary path.
const fallbackActivations: number[] = [];
const FALLBACK_COUNTER_REDIS_KEY = 'auth:fallback:activations';
const FALLBACK_SINGLE_USE_REDIS_KEY_PREFIX = 'auth:fallback:single-use';

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

type FallbackEmergencyConfig = {
  incidentId: string;
  incidentSeverity: string;
  incidentStartedAt: string;
  incidentCorrelationId: string;
  allowedRoutes: string[];
  allowedMethods: string[];
  requireAuthoritativeRevocation: boolean;
  maintenanceWindowEnd: string;
};

type RevocationCheckResult = {
  revoked: boolean;
  authoritative: boolean;
};

function matchesAllowedValue(candidate: string | undefined, allowlist: string[]): boolean {
  if (!candidate || allowlist.length === 0) {
    return false;
  }

  return allowlist.some((allowedValue) => {
    if (allowedValue.endsWith('*')) {
      return candidate.startsWith(allowedValue.slice(0, -1));
    }
    return candidate === allowedValue;
  });
}

function isStrictFallbackRoutePattern(routePattern: string, nodeEnv: string): boolean {
  const trimmedPattern = routePattern.trim();
  if (!trimmedPattern.startsWith('/')) {
    return false;
  }
  if (trimmedPattern.includes('?') || trimmedPattern.includes('#') || /\s/.test(trimmedPattern)) {
    return false;
  }

  const wildcardCount = (trimmedPattern.match(/\*/g) || []).length;
  if (wildcardCount === 0) {
    return true;
  }

  if (nodeEnv === 'production') {
    return false;
  }

  return wildcardCount === 1 && trimmedPattern.endsWith('*') && trimmedPattern.length > 2;
}

function extractRolesFromClaims(claims: JwtPayload): string[] {
  const roleValues = new Set<string>();

  if (typeof claims.role === 'string' && claims.role.length > 0) {
    roleValues.add(claims.role);
  }

  if (Array.isArray(claims.role)) {
    for (const role of claims.role) {
      if (typeof role === 'string' && role.length > 0) {
        roleValues.add(role);
      }
    }
  }

  const appMetadataRoles = claims.app_metadata && typeof claims.app_metadata === 'object'
    ? (claims.app_metadata as { roles?: unknown }).roles
    : undefined;

  if (typeof appMetadataRoles === 'string' && appMetadataRoles.length > 0) {
    roleValues.add(appMetadataRoles);
  }

  if (Array.isArray(appMetadataRoles)) {
    for (const role of appMetadataRoles) {
      if (typeof role === 'string' && role.length > 0) {
        roleValues.add(role);
      }
    }
  }

  return [...roleValues];
}

function getFallbackEmergencyConfig(): FallbackEmergencyConfig | null {
  const legacyFallbackEnabled = getEnvVar(LEGACY_LOCAL_JWT_FALLBACK_FLAG) === 'true';
  const nodeEnv = getEnvVar('NODE_ENV');

  if (nodeEnv === 'production' && legacyFallbackEnabled) {
    logger.error('Refusing legacy local JWT fallback flag in production', undefined, {
      flag: LEGACY_LOCAL_JWT_FALLBACK_FLAG,
    });
    return null;
  }

  if (getEnvVar(AUTH_FALLBACK_EMERGENCY_MODE_FLAG) !== 'true') {
    if (legacyFallbackEnabled && nodeEnv !== 'production') {
      logger.warn('Using legacy local JWT fallback flag outside production', {
        flag: LEGACY_LOCAL_JWT_FALLBACK_FLAG,
      });
      return {
        incidentId: 'legacy-local-jwt-fallback',
        incidentSeverity: 'development',
        incidentStartedAt: new Date(Date.now()).toISOString(),
        incidentCorrelationId: 'legacy-local-jwt-fallback',
        allowedRoutes: ['*'],
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        requireAuthoritativeRevocation: false,
      };
    }
    return null;
  }

  const ttlUntil = getEnvVar(AUTH_FALLBACK_EMERGENCY_TTL_UNTIL);
  if (!ttlUntil) {
    logger.error('Fallback emergency mode requires explicit TTL', undefined, {
      flag: AUTH_FALLBACK_EMERGENCY_TTL_UNTIL,
    });
    return null;
  }

  const ttlDate = new Date(ttlUntil);
  if (Number.isNaN(ttlDate.getTime())) {
    logger.error('Invalid fallback TTL timestamp; refusing local JWT fallback', undefined, {
      flag: AUTH_FALLBACK_EMERGENCY_TTL_UNTIL,
      value: sanitizeForLogging(ttlUntil),
    });
    return null;
  }

  const maxEmergencyDurationSeconds = Number(getEnvVar(AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS) || '14400');
  if (!Number.isFinite(maxEmergencyDurationSeconds) || maxEmergencyDurationSeconds <= 0) {
    logger.error('Invalid max emergency duration; refusing local JWT fallback', undefined, {
      flag: AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS,
      value: sanitizeForLogging(getEnvVar(AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS)),
    });
    return null;
  }

  const ttlRemainingSeconds = Math.floor((ttlDate.getTime() - Date.now()) / 1000);
  if (ttlRemainingSeconds <= 0) {
    logger.error('Fallback emergency mode TTL has expired; refusing local JWT fallback', undefined, {
      flag: AUTH_FALLBACK_EMERGENCY_TTL_UNTIL,
      value: sanitizeForLogging(ttlUntil),
    });
    return null;
  }

  if (ttlRemainingSeconds > maxEmergencyDurationSeconds) {
    logger.error('Fallback emergency TTL exceeds maximum allowed emergency duration', undefined, {
      ttlRemainingSeconds,
      maxEmergencyDurationSeconds,
      flag: AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS,
    });
    return null;
  }

  if (ttlRemainingSeconds > AUTH_FALLBACK_HARD_MAX_TTL_SECONDS) {
    logger.error('Fallback emergency TTL exceeds hard safety limit', undefined, {
      ttlRemainingSeconds,
      hardLimitSeconds: AUTH_FALLBACK_HARD_MAX_TTL_SECONDS,
    });
    return null;
  }

  const incidentId = getEnvVar(AUTH_FALLBACK_INCIDENT_ID);
  if (!incidentId) {
    logger.error('Fallback emergency mode requires incident reference', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_ID,
    });
    return null;
  }
  if (!AUTH_FALLBACK_INCIDENT_ID_PATTERN.test(incidentId)) {
    logger.error('Fallback emergency mode requires incident ID in INC-<digits> format', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_ID,
      value: sanitizeForLogging(incidentId),
    });
    return null;
  }

  const incidentSeverity = getEnvVar(AUTH_FALLBACK_INCIDENT_SEVERITY);
  if (!incidentSeverity) {
    logger.error('Fallback emergency mode requires incident severity metadata', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_SEVERITY,
    });
    return null;
  }

  const incidentStartedAt = getEnvVar(AUTH_FALLBACK_INCIDENT_STARTED_AT);
  if (!incidentStartedAt) {
    logger.error('Fallback emergency mode requires incident start timestamp metadata', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_STARTED_AT,
    });
    return null;
  }

  const incidentStartedAtDate = new Date(incidentStartedAt);
  if (Number.isNaN(incidentStartedAtDate.getTime())) {
    logger.error('Invalid incident start timestamp; refusing local JWT fallback', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_STARTED_AT,
      value: sanitizeForLogging(incidentStartedAt),
    });
    return null;
  }

  if (incidentStartedAtDate.getTime() > Date.now()) {
    logger.error('Incident start timestamp cannot be in the future', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_STARTED_AT,
      value: sanitizeForLogging(incidentStartedAt),
    });
    return null;
  }

  if (incidentStartedAtDate.getTime() > ttlDate.getTime()) {
    logger.error('Incident start timestamp must be before emergency TTL expiry', undefined, {
      startedAt: sanitizeForLogging(incidentStartedAt),
      ttlUntil: sanitizeForLogging(ttlUntil),
    });
    return null;
  }

  const incidentCorrelationId = getEnvVar(AUTH_FALLBACK_INCIDENT_CORRELATION_ID);
  if (!incidentCorrelationId) {
    logger.error('Fallback emergency mode requires incident correlation identifier', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_CORRELATION_ID,
    });
    return null;
  }

  const allowedRoutes = parseStringListEnv(AUTH_FALLBACK_ALLOWED_ROUTES);
  if (allowedRoutes.length === 0) {
    logger.error('Fallback emergency mode requires explicit route allowlist metadata', undefined, {
      routeFlag: AUTH_FALLBACK_ALLOWED_ROUTES,
    });
    return null;
  }
  if (!allowedRoutes.every((routePattern) => isStrictFallbackRoutePattern(routePattern, nodeEnv))) {
    logger.error('Fallback emergency mode route allowlist contains invalid or broad wildcard patterns', undefined, {
      routeFlag: AUTH_FALLBACK_ALLOWED_ROUTES,
      nodeEnv,
      allowedRoutes,
    });
    return null;
  }
  const configuredMethods = parseStringListEnv(AUTH_FALLBACK_ALLOWED_METHODS).map((method) => method.toUpperCase());
  const allowedMethods = configuredMethods.length > 0 ? configuredMethods : ['GET', 'HEAD', 'OPTIONS'];
  const writeMethodConfigured = allowedMethods.some((method) => !FALLBACK_READ_ONLY_METHODS.has(method));
  if (writeMethodConfigured) {
    logger.error('Fallback emergency mode cannot allow write methods', undefined, {
      flag: AUTH_FALLBACK_ALLOWED_METHODS,
      allowedMethods,
    });
    return null;
  }

  const incidentContextSignature = getEnvVar(AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE);
  if (!incidentContextSignature) {
    logger.error('Fallback emergency mode requires signed incident context', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE,
    });
    return null;
  }

  const incidentSigningSecret = getEnvVar(AUTH_FALLBACK_INCIDENT_SIGNING_SECRET);
  if (!incidentSigningSecret) {
    logger.error('Fallback emergency mode requires incident signing secret', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_SIGNING_SECRET,
    });
    return null;
  }

  const signaturePayload = [
    incidentId,
    incidentSeverity,
    incidentStartedAt,
    incidentCorrelationId,
    ttlUntil,
    allowedRoutes.join(','),
    allowedMethods.join(','),
  ].join('|');
  const expectedSignature = createHmac('sha256', incidentSigningSecret).update(signaturePayload).digest('hex');

  const providedSignature = incidentContextSignature.trim();
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))
  ) {
    logger.error('Fallback emergency incident signature verification failed', undefined, {
      flag: AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE,
      incidentId: sanitizeForLogging(incidentId),
    });
    return null;
  }

  const approvalArtifactToken = getEnvVar(AUTH_FALLBACK_APPROVAL_TOKEN);
  const approvalSigningSecret = getEnvVar(AUTH_FALLBACK_APPROVAL_SIGNING_SECRET);
  if (!approvalArtifactToken || !approvalSigningSecret) {
    logger.error('Fallback emergency mode requires signed approval artifact token', undefined, {
      tokenFlag: AUTH_FALLBACK_APPROVAL_TOKEN,
      secretFlag: AUTH_FALLBACK_APPROVAL_SIGNING_SECRET,
    });
    return null;
  }

  const [approvalVersion, payloadSegment, signatureSegment] = approvalArtifactToken.split('.');
  if (!approvalVersion || !payloadSegment || !signatureSegment || approvalVersion !== 'v1') {
    logger.error('Fallback approval artifact token format is invalid', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
    });
    return null;
  }

  const expectedArtifactSignature = createHmac('sha256', approvalSigningSecret).update(payloadSegment).digest('hex');
  if (
    signatureSegment.length !== expectedArtifactSignature.length ||
    !timingSafeEqual(Buffer.from(signatureSegment), Buffer.from(expectedArtifactSignature))
  ) {
    logger.error('Fallback approval artifact token signature verification failed', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
    });
    return null;
  }

  let parsedArtifactPayload: {
    incidentId?: string;
    incidentCorrelationId?: string;
    approvedAt?: string;
    expiresAt?: string;
    scope?: string;
    ticketId?: string;
    approvedByPrimary?: string;
    approvedBySecondary?: string;
    approvalJustification?: string;
  } | null = null;
  try {
    parsedArtifactPayload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as typeof parsedArtifactPayload;
  } catch {
    logger.error('Fallback approval artifact token payload is invalid JSON', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
    });
    return null;
  }

  if (
    !parsedArtifactPayload ||
    parsedArtifactPayload.scope !== 'auth-fallback' ||
    parsedArtifactPayload.incidentId !== incidentId ||
    parsedArtifactPayload.incidentCorrelationId !== incidentCorrelationId
  ) {
    logger.error('Fallback approval artifact token claims do not match incident context', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
      incidentId: sanitizeForLogging(incidentId),
      incidentCorrelationId: sanitizeForLogging(incidentCorrelationId),
    });
    return null;
  }
  if (
    parsedArtifactPayload.ticketId !== incidentId ||
    !parsedArtifactPayload.approvedByPrimary ||
    !parsedArtifactPayload.approvedBySecondary ||
    parsedArtifactPayload.approvedByPrimary === parsedArtifactPayload.approvedBySecondary ||
    !FALLBACK_APPROVAL_ACTOR_PATTERN.test(parsedArtifactPayload.approvedByPrimary) ||
    !FALLBACK_APPROVAL_ACTOR_PATTERN.test(parsedArtifactPayload.approvedBySecondary) ||
    !parsedArtifactPayload.approvalJustification ||
    parsedArtifactPayload.approvalJustification.trim().length < 12
  ) {
    logger.error('Fallback approval artifact token requires dual-approval metadata and incident ticket linkage', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
      incidentId: sanitizeForLogging(incidentId),
    });
    return null;
  }

  const approvedAtDate = parsedArtifactPayload.approvedAt ? new Date(parsedArtifactPayload.approvedAt) : null;
  const artifactExpiryDate = parsedArtifactPayload.expiresAt ? new Date(parsedArtifactPayload.expiresAt) : null;
  if (!approvedAtDate || Number.isNaN(approvedAtDate.getTime()) || !artifactExpiryDate || Number.isNaN(artifactExpiryDate.getTime())) {
    logger.error('Fallback approval artifact token timestamps are invalid', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
    });
    return null;
  }

  if (approvedAtDate.getTime() > Date.now() || artifactExpiryDate.getTime() <= Date.now()) {
    logger.error('Fallback approval artifact token is not currently valid', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
    });
    return null;
  }

  if (artifactExpiryDate.getTime() > ttlDate.getTime()) {
    logger.error('Fallback approval artifact token expiry cannot exceed emergency TTL', undefined, {
      flag: AUTH_FALLBACK_APPROVAL_TOKEN,
    });
    return null;
  }

  const maintenanceWindowStart = getEnvVar(AUTH_FALLBACK_MAINTENANCE_WINDOW_START);
  const maintenanceWindowEnd = getEnvVar(AUTH_FALLBACK_MAINTENANCE_WINDOW_END);
  if (!maintenanceWindowStart || !maintenanceWindowEnd) {
    logger.error('Fallback emergency mode requires an explicit approved maintenance window', undefined, {
      startFlag: AUTH_FALLBACK_MAINTENANCE_WINDOW_START,
      endFlag: AUTH_FALLBACK_MAINTENANCE_WINDOW_END,
    });
    return null;
  }

  const maintenanceStartDate = new Date(maintenanceWindowStart);
  const maintenanceEndDate = new Date(maintenanceWindowEnd);
  if (Number.isNaN(maintenanceStartDate.getTime()) || Number.isNaN(maintenanceEndDate.getTime())) {
    logger.error('Fallback maintenance window timestamps are invalid', undefined, {
      startFlag: AUTH_FALLBACK_MAINTENANCE_WINDOW_START,
      endFlag: AUTH_FALLBACK_MAINTENANCE_WINDOW_END,
    });
    return null;
  }

  const now = Date.now();
  if (maintenanceStartDate.getTime() >= maintenanceEndDate.getTime() || now < maintenanceStartDate.getTime() || now > maintenanceEndDate.getTime()) {
    logger.error('Fallback emergency mode can only run within approved maintenance window', undefined, {
      now: new Date(now).toISOString(),
      maintenanceWindowStart,
      maintenanceWindowEnd,
    });
    return null;
  }

  return {
    incidentId,
    incidentSeverity,
    incidentStartedAt,
    incidentCorrelationId,
    allowedRoutes,
    allowedMethods,
    requireAuthoritativeRevocation: true,
    maintenanceWindowEnd,
  };
}

async function consumeSingleUseFallbackWindow(emergencyConfig: FallbackEmergencyConfig): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    logger.error('Redis is required to enforce single-use auth fallback window', undefined, {
      incidentId: sanitizeForLogging(emergencyConfig.incidentId),
    });
    return false;
  }

  const key = `${FALLBACK_SINGLE_USE_REDIS_KEY_PREFIX}:${emergencyConfig.incidentId}:${emergencyConfig.maintenanceWindowEnd}`;
  const ttlSeconds = Math.max(1, Math.ceil((new Date(emergencyConfig.maintenanceWindowEnd).getTime() - Date.now()) / 1000));
  const setResult = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return setResult === 'OK';
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
  const maxTokenAgeSeconds = Number(getEnvVar('AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS') || '300');
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

function isFallbackAccessAllowed(
  _claims: JwtPayload,
  context: VerificationContext,
  emergencyConfig: FallbackEmergencyConfig,
): boolean {
  const method = context.method?.toUpperCase();
  if (!method || !FALLBACK_READ_ONLY_METHODS.has(method) || !emergencyConfig.allowedMethods.includes(method)) {
    return false;
  }

  const routeAllowed = matchesAllowedValue(context.route, emergencyConfig.allowedRoutes);

  return routeAllowed;
}

async function isTokenRevoked(token: string, claims: JwtPayload): Promise<RevocationCheckResult> {
  const redis = await getRedisClient();
  if (!redis) {
    logger.warn('Redis unavailable for token revocation checks in fallback mode');
    return { revoked: false, authoritative: false };
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
    return {
      revoked: revokedCount > 0,
      authoritative: true,
    };
  } catch (error) {
    logger.warn('Revocation check failed during fallback validation', sanitizeForLogging(error) as LogContext);
    return { revoked: false, authoritative: false };
  }
}

async function recordFallbackActivation(alertContext: Record<string, unknown>): Promise<void> {
  const now = Date.now();
  const threshold = Number(getEnvVar(AUTH_FALLBACK_ALERT_THRESHOLD) || '1');
  const windowSeconds = Number(getEnvVar(AUTH_FALLBACK_ALERT_WINDOW_SECONDS) || '300');
  if (!Number.isFinite(threshold) || threshold <= 0) {
    logger.error('Invalid fallback alert threshold; forcing immediate alert behavior', undefined, {
      flag: AUTH_FALLBACK_ALERT_THRESHOLD,
      value: sanitizeForLogging(getEnvVar(AUTH_FALLBACK_ALERT_THRESHOLD)),
      ...alertContext,
    });
  }
  const windowMs = windowSeconds * 1000;
  const allowProcessLocalCounter = getEnvVar("NODE_ENV") !== "production";

  let activationsInWindow: number;

  try {
    const redis = await getRedisClient();
    if (redis) {
      // Use a sorted set keyed by timestamp. Each activation is a member scored
      // by its epoch-ms timestamp. ZREMRANGEBYSCORE prunes entries outside the
      // window, then ZADD adds the new one, then ZCARD counts the survivors.
      // The key expires automatically after the window so it self-cleans.
      // ioredis API: zadd(key, score, member), zremrangebyscore, zcard, expireat.
      const member = `${now}:${String(alertContext.incidentId ?? 'unknown')}:${String(alertContext.route ?? 'unknown')}`;
      const expireAtSeconds = Math.floor(now / 1000) + windowSeconds + 1;

      await redis.zremrangebyscore(FALLBACK_COUNTER_REDIS_KEY, '-inf', now - windowMs);
      await redis.zadd(FALLBACK_COUNTER_REDIS_KEY, now, member);
      await redis.expireat(FALLBACK_COUNTER_REDIS_KEY, expireAtSeconds);
      activationsInWindow = await redis.zcard(FALLBACK_COUNTER_REDIS_KEY);
    } else if (allowProcessLocalCounter) {
      // Redis unavailable — use the process-local counter only outside production.
      fallbackActivations.push(now);
      while (fallbackActivations.length > 0 && (fallbackActivations[0] ?? 0) < now - windowMs) {
        fallbackActivations.shift();
      }
      activationsInWindow = fallbackActivations.length;
    } else {
      logger.error('recordFallbackActivation: Redis unavailable in production; skipping process-local counter', undefined, {
        ...alertContext,
      });
      activationsInWindow = threshold;
    }
  } catch (err) {
    if (!allowProcessLocalCounter) {
      logger.error('recordFallbackActivation: Redis error in production; skipping process-local counter', undefined, {
        error: err instanceof Error ? err.message : String(err),
        ...alertContext,
      });
      activationsInWindow = threshold;
    } else {
      logger.warn('recordFallbackActivation: Redis error, using in-process counter', {
        error: err instanceof Error ? err.message : String(err),
      });
      fallbackActivations.push(now);
      while (fallbackActivations.length > 0 && (fallbackActivations[0] ?? 0) < now - windowMs) {
        fallbackActivations.shift();
      }
      activationsInWindow = fallbackActivations.length;
    }
  }

  if (activationsInWindow >= Math.max(1, threshold)) {
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
  actorId?: string;
  actorEmail?: string;
  actorRoles?: string[];
  incidentId: string;
  incidentCorrelationId: string;
  incidentSeverity: string;
  incidentStartedAt: string;
}) {
  const details = {
    severity: 'critical',
    route: sanitizeForLogging(context.route || 'unknown'),
    method: context.method || 'UNKNOWN',
    tenantId: sanitizeForLogging(context.tenantId || 'unknown'),
    reason: context.reason,
    actorId: sanitizeForLogging(context.actorId || 'unknown'),
    actorEmail: sanitizeForLogging(context.actorEmail || 'unknown'),
    actorRoles: (context.actorRoles || []).map((role) => sanitizeForLogging(role)),
    incidentId: sanitizeForLogging(context.incidentId),
    incidentCorrelationId: sanitizeForLogging(context.incidentCorrelationId),
    incidentSeverity: sanitizeForLogging(context.incidentSeverity),
    incidentStartedAt: sanitizeForLogging(context.incidentStartedAt),
    fallbackMode: true,
  };

  logger.error('Emergency JWT fallback activated', undefined, details);
  authFallbackActivationsTotal.inc();
  await recordFallbackActivation(details);

  try {
    await auditLogService.logAudit({
      userId: 'system',
      userName: 'System',
      userEmail: 'system@valueos.local',
      action: 'auth.jwt_fallback_request_authenticated_immutable',
      resourceType: 'authentication',
      resourceId: context.route || 'unknown_route',
      status: 'success',
      details: {
        immutable: true,
        severity: 'critical',
        reason: context.reason,
        actorId: context.actorId,
        actorEmail: context.actorEmail,
        actorRoles: context.actorRoles ?? [],
        incidentId: context.incidentId,
        incidentCorrelationId: context.incidentCorrelationId,
        incidentSeverity: context.incidentSeverity,
        incidentStartedAt: context.incidentStartedAt,
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
  const organizationId =
    (claims?.organization_id as string | undefined) ??
    (user?.organization_id as string | undefined) ??
    tenantId;
  const userWithTenant = user
    ? { ...user, tenant_id: tenantId ?? user.tenant_id, organization_id: organizationId ?? user.organization_id }
    : user;

  const authReq = req as AuthenticatedRequest;
  authReq.user = userWithTenant as AuthenticatedRequest["user"];
  (req as Record<string, unknown>).session = session;
  authReq.tenantId = tenantId;
  authReq.organizationId = organizationId;
}

function ensureAuthHeader(req: Request, token?: string | null) {
  if (!token) return;
  if (req.headers.authorization) return;
  (req.headers as Record<string, string>).authorization = `Bearer ${token}`;
}

async function verifyTokenWithSupabase(token: string): Promise<VerifiedAuth | null> {
  try {
    const supabaseClient = createServiceRoleSupabaseClient();
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
  const emergencyConfig = getFallbackEmergencyConfig();
  const emergencyModeEnabled = Boolean(emergencyConfig);

  if (!emergencyModeEnabled) {
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

    if (!isFallbackAccessAllowed(claims, context, emergencyConfig)) {
      logger.warn('Local fallback rejected token outside configured emergency allowlist', {
        route: sanitizeForLogging(context.route),
        roles: extractRolesFromClaims(claims).map((role) => sanitizeForLogging(role)),
      });
      return null;
    }

    const revocationStatus = await isTokenRevoked(token, claims);
    if (emergencyConfig.requireAuthoritativeRevocation && !revocationStatus.authoritative) {
      logger.warn('Local fallback rejected token because revocation state is not authoritative', {
        route: sanitizeForLogging(context.route),
        incidentId: sanitizeForLogging(emergencyConfig.incidentId),
      });
      return null;
    }

    if (revocationStatus.revoked) {
      logger.warn('Local fallback rejected revoked token', {
        route: sanitizeForLogging(context.route),
        tokenSubject: sanitizeForLogging(claims.sub),
      });
      return null;
    }

    const singleUseAcquired = await consumeSingleUseFallbackWindow(emergencyConfig);
    if (!singleUseAcquired) {
      logger.warn('Local fallback rejected because approved maintenance window has already been consumed', {
        route: sanitizeForLogging(context.route),
        incidentId: sanitizeForLogging(emergencyConfig.incidentId),
      });
      return null;
    }

    await emitFallbackAuditEvent({
      route: context.route,
      method: context.method,
      tenantId: extractTenantId(claims),
      reason: 'idp_unavailable_emergency_mode',
      actorId: claims.sub,
      actorEmail: typeof claims.email === 'string' ? claims.email : undefined,
      actorRoles: extractRolesFromClaims(claims),
      incidentId: emergencyConfig.incidentId,
      incidentCorrelationId: emergencyConfig.incidentCorrelationId,
      incidentSeverity: emergencyConfig.incidentSeverity,
      incidentStartedAt: emergencyConfig.incidentStartedAt,
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
export { requireAuth as authenticate };
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
    createRequestRlsSupabaseClient(req);

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
      createRequestRlsSupabaseClient(req);

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

export async function requireMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }

  try {
    // Lazy import to avoid circular dependency at module load time
    const { mfaService } = await import('../services/auth/MFAService.js');
    const mfaEnabled = await mfaService.isMFAEnabled(userId);

    if (!mfaEnabled) {
      // MFA not enrolled — treat as not satisfied
      res.status(403).json({
        error: 'MFA required',
        message: 'Multi-factor authentication must be enabled to access this resource',
      });
      return;
    }

    // MFA is enrolled; the session token already carries proof of MFA completion
    // (Supabase sets amr claim when MFA was used during sign-in). Check it.
    // amr lives in the JWT payload, not on the AuthSession object, so decode
    // the access token directly rather than reading from req.session.
    const accessToken = (req.session as Record<string, unknown> | undefined)?.access_token;
    const tokenClaims = typeof accessToken === 'string' ? decodeClaims(accessToken) : null;
    const amr = tokenClaims?.amr;
    const mfaVerified =
      Array.isArray(amr) &&
      (amr as Array<{ method: string }>).some(
        (entry) => entry.method === 'totp' || entry.method === 'webauthn'
      );

    if (!mfaVerified) {
      res.status(403).json({
        error: 'MFA required',
        message: 'This resource requires a session authenticated with MFA',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('requireMFA: failed to verify MFA status', error instanceof Error ? error : undefined, { userId });
    res.status(500).json({ error: 'Internal server error' });
  }
}

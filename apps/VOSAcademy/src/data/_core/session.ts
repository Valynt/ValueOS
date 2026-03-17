import { COOKIE_NAME } from "@shared/const";
import jwt, { JwtPayload } from "jsonwebtoken";

import type { User } from "../../drizzle/schema";
import { type AuditRequestContext, logAuditEvent } from "../../lib/auditLogger";
import { getUserByOpenId } from "../db";

import { ENV } from "./env";


interface SessionClaims extends JwtPayload {
  sub: string;
  tenant?: string;
  org?: string;
}

interface SessionKey {
  kid: string;
  secret: string;
}

const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_CLOCK_TOLERANCE_SECONDS = 5;

interface SessionTokenContext {
  tenant?: string;
  organizationId?: string;
}

interface SessionVerificationConfig {
  issuer: string;
  audience: string;
  ttlSeconds: number;
  tenant?: string;
}

function getSessionKeys(): SessionKey[] {
  const rawKeys = process.env.SESSION_JWT_KEYS;
  if (!rawKeys) {
    throw new Error("[Session] SESSION_JWT_KEYS is not configured");
  }

  const parsed = rawKeys
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [kidPart, ...secretParts] = entry.split(":");
      if (secretParts.length === 0) {
        return { kid: `key-${index + 1}`, secret: kidPart };
      }
      return { kid: kidPart, secret: secretParts.join(":") };
    })
    .filter((key) => key.secret.length > 0);

  if (parsed.length === 0) {
    throw new Error("[Session] SESSION_JWT_KEYS is empty after parsing");
  }

  return parsed;
}

function getPrimarySigningKid(): string | null {
  return process.env.SESSION_JWT_ACTIVE_KID || null;
}

function getSessionIssuer(): string {
  const issuer = process.env.SESSION_JWT_ISSUER;
  if (!issuer) {
    throw new Error("[Session] SESSION_JWT_ISSUER is not configured");
  }
  return issuer;
}

function getSessionAudience(): string {
  const audience = process.env.SESSION_JWT_AUDIENCE;
  if (!audience) {
    throw new Error("[Session] SESSION_JWT_AUDIENCE is not configured");
  }
  return audience;
}

function getSessionTtlSeconds(): number {
  const raw = process.env.SESSION_JWT_TTL_SECONDS;
  if (!raw) return DEFAULT_SESSION_TTL_SECONDS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("[Session] SESSION_JWT_TTL_SECONDS must be a positive number");
  }
  return Math.floor(parsed);
}

function getSessionTenant(): string | undefined {
  return process.env.SESSION_JWT_TENANT || undefined;
}

function getSessionVerificationConfig(): SessionVerificationConfig {
  return {
    issuer: getSessionIssuer(),
    audience: getSessionAudience(),
    ttlSeconds: getSessionTtlSeconds(),
    tenant: getSessionTenant(),
  };
}

function getPrimarySigningKey(keys: SessionKey[]): SessionKey {
  const configuredKid = getPrimarySigningKid();
  if (!configuredKid) {
    return keys[0];
  }

  const selectedKey = keys.find((key) => key.kid === configuredKid);
  if (!selectedKey) {
    throw new Error(`[Session] SESSION_JWT_ACTIVE_KID (${configuredKid}) not found in SESSION_JWT_KEYS`);
  }

  return selectedKey;
}

/**
 * Parse session token and validate
 * In production, this should use JWT or encrypted session tokens
 */
export async function validateSessionToken(token: string, requestContext?: AuditRequestContext): Promise<User | null> {
  try {
    const keys = getSessionKeys();
    const { issuer, audience, tenant } = getSessionVerificationConfig();

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded !== "object") {
      await logAuditEvent({
        actor: "anonymous",
        tenantId: tenant || ENV.appId || undefined,
        action: "session.validate",
        result: "failure",
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        details: { reason: "token_decode_failed" },
      });
      return null;
    }

    const headerKid = decoded.header?.kid;
    const keyCandidates = headerKid
      ? keys.filter((key) => key.kid === headerKid)
      : keys;

    if (keyCandidates.length === 0) {
      console.warn("[Session] No matching keys found for token");
      await logAuditEvent({
        actor: "anonymous",
        tenantId: tenant || ENV.appId || undefined,
        action: "session.validate",
        result: "failure",
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        details: { reason: "missing_signing_key", kid: headerKid },
      });
      return null;
    }

    let payload: SessionClaims | null = null;
    for (const key of keyCandidates) {
      try {
        payload = jwt.verify(token, key.secret, {
          algorithms: ["HS256"],
          issuer,
          audience,
          clockTolerance: SESSION_CLOCK_TOLERANCE_SECONDS,
        }) as SessionClaims;
        break;
      } catch (error) {
        console.debug(`[Session] Verification failed with key ${key.kid}:`, error);
        payload = null;
      }
    }

    if (!payload) {
      await logAuditEvent({
        actor: "anonymous",
        tenantId: tenant || ENV.appId || undefined,
        action: "session.validate",
        result: "failure",
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        details: { reason: "signature_verification_failed", kid: headerKid },
      });
      return null;
    }

    if (!payload?.sub || !payload.exp || !payload.iat) {
      await logAuditEvent({
        actor: payload?.sub || "anonymous",
        tenantId: payload?.tenant || tenant || ENV.appId || undefined,
        organizationId: payload?.org,
        action: "session.validate",
        result: "failure",
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        details: { reason: "missing_required_claims" },
      });
      return null;
    }

    if (tenant && payload.tenant !== tenant) {
      console.warn("[Session] Token tenant mismatch");
      await logAuditEvent({
        actor: payload.sub,
        tenantId: payload.tenant || tenant || ENV.appId || undefined,
        organizationId: payload.org,
        action: "session.validate",
        result: "failure",
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        details: {
          reason: "tenant_mismatch",
          expectedTenant: tenant,
          tokenTenant: payload.tenant,
        },
      });
      return null;
    }

    if (payload.tenant && ENV.appId && payload.tenant !== ENV.appId) {
      console.warn("[Session] Token app mismatch");
      await logAuditEvent({
        actor: payload.sub,
        tenantId: payload.tenant,
        organizationId: payload.org,
        action: "session.validate",
        result: "failure",
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        details: {
          reason: "app_mismatch",
          expectedAppId: ENV.appId,
          tokenTenant: payload.tenant,
        },
      });
      return null;
    }

    const user = await getUserByOpenId(payload.sub);
    await logAuditEvent({
      actor: payload.sub,
      tenantId: payload.tenant || tenant || ENV.appId || undefined,
      organizationId: payload.org,
      action: "session.validate",
      result: user ? "success" : "failure",
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
      details: { reason: user ? "validated" : "user_not_found" },
    });
    return user || null;
  } catch (error) {
    console.error("[Session] Failed to validate token:", error);
    await logAuditEvent({
      actor: "anonymous",
      tenantId: ENV.appId || undefined,
      action: "session.validate",
      result: "failure",
      ipAddress: requestContext?.ipAddress,
      userAgent: requestContext?.userAgent,
      details: {
        reason: "validation_exception",
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    return null;
  }
}

/**
 * Create session token for user
 */
export function createSessionToken(openId: string): string {
  const keys = getSessionKeys();
  const { issuer, audience, ttlSeconds, tenant } = getSessionVerificationConfig();

  const primaryKey = getPrimarySigningKey(keys);
  const payload: SessionClaims = {
    sub: openId,
    tenant: tenant || undefined,
  };

  return jwt.sign(payload, primaryKey.secret, {
    algorithm: "HS256",
    expiresIn: ttlSeconds,
    issuer,
    audience,
    keyid: primaryKey.kid,
  });
}

export function createSessionTokenWithContext(openId: string, context: SessionTokenContext): string {
  const keys = getSessionKeys();
  const { issuer, audience, ttlSeconds, tenant } = getSessionVerificationConfig();
  const primaryKey = getPrimarySigningKey(keys);

  const payload: SessionClaims = {
    sub: openId,
    tenant: context.tenant || tenant || undefined,
    org: context.organizationId || undefined,
  };

  return jwt.sign(payload, primaryKey.secret, {
    algorithm: "HS256",
    expiresIn: ttlSeconds,
    issuer,
    audience,
    keyid: primaryKey.kid,
  });
}

/**
 * Parse cookies from request header
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Get session token from request
 */
export function getSessionFromRequest(req: { headers?: { cookie?: string } }): string | null {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[COOKIE_NAME] || null;
}

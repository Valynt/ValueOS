import jwt, { JwtPayload } from "jsonwebtoken";
import { COOKIE_NAME } from "@shared/const";
import { getUserByOpenId } from "../db";
import { ENV } from "./env";
import type { User } from "../../drizzle/schema";

interface SessionClaims extends JwtPayload {
  sub: string;
  tenant?: string;
}

interface SessionKey {
  kid: string;
  secret: string;
}

const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

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

/**
 * Parse session token and validate
 * In production, this should use JWT or encrypted session tokens
 */
export async function validateSessionToken(token: string): Promise<User | null> {
  try {
    const keys = getSessionKeys();
    const issuer = getSessionIssuer();
    const audience = getSessionAudience();

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded !== "object") {
      return null;
    }

    const headerKid = decoded.header?.kid;
    const keyCandidates = headerKid
      ? keys.filter((key) => key.kid === headerKid)
      : keys;

    if (keyCandidates.length === 0) {
      console.warn("[Session] No matching keys found for token");
      return null;
    }

    let payload: SessionClaims | null = null;
    for (const key of keyCandidates) {
      try {
        payload = jwt.verify(token, key.secret, {
          algorithms: ["HS256"],
          issuer,
          audience,
        }) as SessionClaims;
        break;
      } catch (error) {
        console.debug(`[Session] Verification failed with key ${key.kid}:`, error);
        payload = null;
      }
    }

    if (!payload?.sub) {
      return null;
    }

    if (payload.tenant && ENV.appId && payload.tenant !== ENV.appId) {
      console.warn("[Session] Token tenant mismatch");
      return null;
    }

    const user = await getUserByOpenId(payload.sub);
    return user || null;
  } catch (error) {
    console.error("[Session] Failed to validate token:", error);
    return null;
  }
}

/**
 * Create session token for user
 */
export function createSessionToken(openId: string): string {
  const keys = getSessionKeys();
  const issuer = getSessionIssuer();
  const audience = getSessionAudience();
  const ttlSeconds = getSessionTtlSeconds();
  const tenant = getSessionTenant();

  const primaryKey = keys[0];
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
export function getSessionFromRequest(req: any): string | null {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[COOKIE_NAME] || null;
}

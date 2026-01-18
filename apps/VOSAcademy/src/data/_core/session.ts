import { COOKIE_NAME } from "@shared/const";
import { getUserByOpenId } from "../db";
import type { User } from "../../drizzle/schema";
import { getAuditContextFromRequest, logAuditEvent } from "../../lib/auditLogger";

interface SessionData {
  openId: string;
  createdAt: number;
}

/**
 * Parse session token and validate
 * In production, this should use JWT or encrypted session tokens
 */
export async function validateSessionToken(token: string, req?: any): Promise<User | null> {
  const { ipAddress, userAgent, tenant } = getAuditContextFromRequest(req);
  let sessionData: SessionData | null = null;

  try {
    // Decode base64 session token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    sessionData = JSON.parse(decoded);
  } catch (error) {
    await logAuditEvent({
      actor: "unknown",
      action: "session.validate",
      result: "failure",
      tenant,
      ipAddress,
      userAgent,
      metadata: { reason: "invalid_token" },
    });
    console.error('[Session] Failed to decode token:', error);
    return null;
  }

  try {
    // Check if session is expired (7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const now = Date.now();
    if (now - sessionData.createdAt > maxAge) {
      await logAuditEvent({
        actor: sessionData.openId ?? "unknown",
        action: "session.validate",
        result: "failure",
        tenant,
        ipAddress,
        userAgent,
        metadata: { reason: "expired" },
      });
      return null;
    }

    // Fetch user from database
    const user = await getUserByOpenId(sessionData.openId);
    if (!user) {
      await logAuditEvent({
        actor: sessionData.openId ?? "unknown",
        action: "session.validate",
        result: "failure",
        tenant,
        ipAddress,
        userAgent,
        metadata: { reason: "user_not_found" },
      });
      return null;
    }

    await logAuditEvent({
      actor: user.id ?? sessionData.openId ?? "unknown",
      action: "session.validate",
      result: "success",
      tenant,
      ipAddress,
      userAgent,
      metadata: { openId: sessionData.openId, userId: user.id },
    });

    return user;
  } catch (error) {
    console.error('[Session] Failed to validate token:', error);
    await logAuditEvent({
      actor: sessionData?.openId ?? "unknown",
      action: "session.validate",
      result: "failure",
      tenant,
      ipAddress,
      userAgent,
      metadata: { reason: "validation_error" },
    });
    return null;
  }
}

/**
 * Create session token for user
 */
export function createSessionToken(openId: string): string {
  const sessionData: SessionData = {
    openId,
    createdAt: Date.now(),
  };
  
  return Buffer.from(JSON.stringify(sessionData)).toString('base64');
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

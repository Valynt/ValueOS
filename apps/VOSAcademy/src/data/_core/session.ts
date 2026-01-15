import { COOKIE_NAME } from "@shared/const";
import { getUserByOpenId } from "../db";
import type { User } from "../../drizzle/schema";

interface SessionData {
  openId: string;
  createdAt: number;
}

/**
 * Parse session token and validate
 * In production, this should use JWT or encrypted session tokens
 */
export async function validateSessionToken(token: string): Promise<User | null> {
  try {
    // Decode base64 session token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const sessionData: SessionData = JSON.parse(decoded);

    // Check if session is expired (7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const now = Date.now();
    if (now - sessionData.createdAt > maxAge) {
      return null;
    }

    // Fetch user from database
    const user = await getUserByOpenId(sessionData.openId);
    return user || null;
  } catch (error) {
    console.error('[Session] Failed to validate token:', error);
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

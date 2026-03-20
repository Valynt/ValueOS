import { randomUUID } from "node:crypto";

import { createLogger } from "@shared/lib/logger";
import { getRedisClient } from "@shared/lib/redisClient";
import { createServerSupabaseClient } from "@shared/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { Request, Response } from "express";

import { AuthenticationError } from "./errors.js";

const logger = createLogger({ component: "BrowserSessionService" });

export interface BrowserSessionRecord {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
  lastRotatedAt: number;
}

export interface BrowserSessionResolution {
  record: BrowserSessionRecord;
  rotated: boolean;
  previousSessionId?: string;
}

const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-valueos_session" : "valueos_session";
const FALLBACK_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_COOKIE_SAME_SITE = process.env.NODE_ENV === "production" ? "Strict" : "Lax";
const KEY_PREFIX = "auth:browser-session:";

class BrowserSessionService {
  private readonly fallbackStore = new Map<string, BrowserSessionRecord>();

  private buildSessionKey(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
  }

  private getRefreshTokenExpiry(session: Session, now: number): number {
    const sessionExpirySeconds = typeof session.expires_at === "number" ? session.expires_at : undefined;
    const sessionExpiryMs = sessionExpirySeconds ? sessionExpirySeconds * 1000 : undefined;
    const fallbackExpiryMs = now + FALLBACK_REFRESH_TTL_MS;
    return Math.max(sessionExpiryMs ?? 0, fallbackExpiryMs);
  }

  private serialize(sessionId: string, session: Session): BrowserSessionRecord {
    if (!session.access_token || !session.refresh_token || !session.user?.id) {
      throw new AuthenticationError("Session is missing required tokens");
    }

    const now = Date.now();
    const accessTokenExpiresAt = typeof session.expires_at === "number"
      ? session.expires_at * 1000
      : now + ((session.expires_in ?? 3600) * 1000);

    return {
      sessionId,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt: this.getRefreshTokenExpiry(session, now),
      userId: session.user.id,
      createdAt: now,
      lastActivityAt: now,
      lastRotatedAt: now,
    };
  }

  private async read(sessionId: string): Promise<BrowserSessionRecord | null> {
    const key = this.buildSessionKey(sessionId);

    try {
      const redis = await getRedisClient();
      const data = await redis.get(key);
      if (data) {
        const record = JSON.parse(data) as BrowserSessionRecord;
        this.fallbackStore.set(key, record);
        return record;
      }
    } catch (error) {
      logger.warn("Redis read failed for browser session", { error: String(error) });
    }

    return this.fallbackStore.get(key) ?? null;
  }

  private async write(record: BrowserSessionRecord): Promise<void> {
    const key = this.buildSessionKey(record.sessionId);
    const ttlMs = record.refreshTokenExpiresAt - Date.now();
    this.fallbackStore.set(key, record);

    if (ttlMs <= 0) {
      return;
    }

    try {
      const redis = await getRedisClient();
      await redis.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(record));
    } catch (error) {
      logger.warn("Redis write failed for browser session", { error: String(error) });
    }
  }

  private async remove(sessionId: string): Promise<void> {
    const key = this.buildSessionKey(sessionId);
    this.fallbackStore.delete(key);

    try {
      const redis = await getRedisClient();
      await redis.del(key);
    } catch (error) {
      logger.warn("Redis delete failed for browser session", { error: String(error) });
    }
  }

  private buildCookieValue(sessionId: string, expiresAt: number): string {
    const attributes = [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
      "Path=/",
      "HttpOnly",
      `SameSite=${DEFAULT_COOKIE_SAME_SITE}`,
      `Expires=${new Date(expiresAt).toUTCString()}`,
      `Max-Age=${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}`,
    ];

    if (process.env.NODE_ENV === "production") {
      attributes.push("Secure");
    }

    return attributes.join("; ");
  }

  getSessionIdFromRequest(req: Request): string | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    for (const segment of cookieHeader.split(";")) {
      const [rawName, ...rawValue] = segment.trim().split("=");
      if (rawName === SESSION_COOKIE_NAME) {
        const value = rawValue.join("=").trim();
        return value ? decodeURIComponent(value) : null;
      }
    }

    return null;
  }

  applySessionCookie(res: Response, sessionId: string, expiresAt: number): void {
    res.append("Set-Cookie", this.buildCookieValue(sessionId, expiresAt));
  }

  clearSessionCookie(res: Response): void {
    const attributes = [
      `${SESSION_COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      `SameSite=${DEFAULT_COOKIE_SAME_SITE}`,
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "Max-Age=0",
    ];

    if (process.env.NODE_ENV === "production") {
      attributes.push("Secure");
    }

    res.append("Set-Cookie", attributes.join("; "));
  }

  async create(session: Session): Promise<BrowserSessionRecord> {
    const sessionId = randomUUID();
    const record = this.serialize(sessionId, session);
    await this.write(record);
    return record;
  }

  async invalidate(sessionId: string): Promise<void> {
    await this.remove(sessionId);
  }

  async resolve(req: Request, res?: Response): Promise<BrowserSessionResolution | null> {
    const sessionId = this.getSessionIdFromRequest(req);
    if (!sessionId) {
      return null;
    }

    const record = await this.read(sessionId);
    if (!record) {
      return null;
    }

    const now = Date.now();
    if (record.refreshTokenExpiresAt <= now) {
      await this.remove(sessionId);
      if (res) {
        this.clearSessionCookie(res);
      }
      return null;
    }

    if (record.accessTokenExpiresAt > now) {
      const updatedRecord = {
        ...record,
        lastActivityAt: now,
      };
      await this.write(updatedRecord);
      return { record: updatedRecord, rotated: false };
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: record.refreshToken });

    if (error || !data.session) {
      await this.remove(sessionId);
      if (res) {
        this.clearSessionCookie(res);
      }
      throw new AuthenticationError("Session refresh failed");
    }

    const rotatedRecord = this.serialize(randomUUID(), data.session);
    rotatedRecord.createdAt = record.createdAt;
    rotatedRecord.lastActivityAt = now;
    rotatedRecord.lastRotatedAt = now;

    await this.write(rotatedRecord);
    await this.remove(sessionId);

    if (res) {
      this.applySessionCookie(res, rotatedRecord.sessionId, rotatedRecord.refreshTokenExpiresAt);
    }

    return {
      record: rotatedRecord,
      rotated: true,
      previousSessionId: sessionId,
    };
  }
}

export const browserSessionService = new BrowserSessionService();

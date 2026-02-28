/**
 * Redis-backed Session Store for High Availability
 *
 * Provides distributed session management with:
 * - Automatic failover to in-memory when Redis unavailable
 * - Tenant-scoped session isolation
 * - Session invalidation on security events
 * - Device fingerprinting support
 */

import { createLogger } from '@shared/lib/logger';
import { getRedisClient } from '@shared/lib/redisClient';
import { ns } from '@shared/lib/redisKeys';

const logger = createLogger({ component: 'RedisSessionStore' });

export interface SessionMetadata {
  userId: string;
  tenantId?: string;
  deviceId?: string;
  deviceFingerprint?: DeviceFingerprint;
  createdAt: number;
  lastActivityAt: number;
  absoluteExpiresAt: number;
  idleExpiresAt: number;
  ipAddress?: string;
  userAgent?: string;
  securityFlags?: SessionSecurityFlags;
}

export interface DeviceFingerprint {
  userAgent: string;
  platform?: string;
  language?: string;
  screenResolution?: string;
  timezone?: string;
  colorDepth?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface SessionSecurityFlags {
  mfaVerified?: boolean;
  passwordLastVerified?: number;
  suspiciousActivity?: boolean;
  forceReauth?: boolean;
}

export interface SessionStoreConfig {
  absoluteTimeoutMs: number;
  idleTimeoutMs: number;
  keyPrefix: string;
  enableFallback: boolean;
}

const DEFAULT_CONFIG: SessionStoreConfig = {
  absoluteTimeoutMs: 60 * 60 * 1000, // 1 hour
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  keyPrefix: 'session:',
  enableFallback: true,
};

/**
 * Redis-backed session store with automatic in-memory fallback
 */
export class RedisSessionStore {
  private config: SessionStoreConfig;
  private memoryFallback: Map<string, SessionMetadata> = new Map();
  private redisAvailable = true;
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(config: Partial<SessionStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHealthCheck();
  }

  /**
   * Set session metadata
   */
  async set(sessionId: string, metadata: SessionMetadata): Promise<void> {
    const key = this.getKey(sessionId, metadata.tenantId);

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const ttl = metadata.absoluteExpiresAt - Date.now();

        if (ttl > 0) {
          await redis.setEx(
            key,
            Math.ceil(ttl / 1000),
            JSON.stringify(metadata)
          );
          logger.debug('Session stored in Redis', { sessionId, ttl });
        }
      }
    } catch (error) {
      logger.warn('Redis set failed, using memory fallback', { error: String(error) });
      this.redisAvailable = false;
    }

    // Always store in memory as backup
    this.memoryFallback.set(key, metadata);
  }

  /**
   * Get session metadata
   */
  async get(sessionId: string, tenantId?: string): Promise<SessionMetadata | undefined> {
    const key = this.getKey(sessionId, tenantId);

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const data = await redis.get(key);

        if (data) {
          const metadata = JSON.parse(data) as SessionMetadata;
          // Sync to memory fallback
          this.memoryFallback.set(key, metadata);
          return metadata;
        }
      }
    } catch (error) {
      logger.warn('Redis get failed, using memory fallback', { error: String(error) });
      this.redisAvailable = false;
    }

    // Fallback to memory
    return this.memoryFallback.get(key);
  }

  /**
   * Delete session
   */
  async delete(sessionId: string, tenantId?: string): Promise<void> {
    const key = this.getKey(sessionId, tenantId);

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        await redis.del(key);
      }
    } catch (error) {
      logger.warn('Redis delete failed', { error: String(error) });
      this.redisAvailable = false;
    }

    this.memoryFallback.delete(key);
  }

  /**
   * Update last activity timestamp
   */
  async updateActivity(sessionId: string, tenantId?: string): Promise<void> {
    const metadata = await this.get(sessionId, tenantId);
    if (!metadata) return;

    const now = Date.now();
    metadata.lastActivityAt = now;
    metadata.idleExpiresAt = now + this.config.idleTimeoutMs;

    await this.set(sessionId, metadata);
  }

  /**
   * Invalidate all sessions for a user (e.g., on password change, security event)
   */
  async invalidateUserSessions(userId: string, tenantId?: string): Promise<number> {
    let count = 0;
    const pattern = this.getUserPattern(userId, tenantId);

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const keys = await this.scanKeys(pattern);

        if (keys.length > 0) {
          await redis.del(keys);
          count = keys.length;
          logger.info('Invalidated user sessions in Redis', { userId, count });
        }
      }
    } catch (error) {
      logger.warn('Redis invalidate failed', { error: String(error) });
      this.redisAvailable = false;
    }

    // Also clear from memory fallback
    for (const key of this.memoryFallback.keys()) {
      if (key.includes(`:user:${userId}:`) || key.includes(`:${userId}:`)) {
        this.memoryFallback.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Invalidate sessions by device fingerprint (for device compromise)
   */
  async invalidateDeviceSessions(
    deviceId: string,
    tenantId?: string
  ): Promise<number> {
    let count = 0;

    // Scan memory for device matches
    for (const [key, metadata] of this.memoryFallback.entries()) {
      if (metadata.deviceId === deviceId) {
        this.memoryFallback.delete(key);
        count++;

        try {
          if (this.redisAvailable) {
            const redis = await this.getRedis();
            await redis.del(key);
          }
        } catch (error) {
          logger.warn('Redis delete failed during device invalidation', { error: String(error) });
        }
      }
    }

    logger.info('Invalidated device sessions', { deviceId, count });
    return count;
  }

  /**
   * Mark session as suspicious
   */
  async markSuspicious(
    sessionId: string,
    tenantId?: string,
    reason?: string
  ): Promise<void> {
    const metadata = await this.get(sessionId, tenantId);
    if (!metadata) return;

    metadata.securityFlags = {
      ...metadata.securityFlags,
      suspiciousActivity: true,
    };

    await this.set(sessionId, metadata);

    logger.warn('Session marked as suspicious', {
      sessionId,
      userId: metadata.userId,
      reason,
    });
  }

  /**
   * Force re-authentication for session
   */
  async forceReauth(
    sessionId: string,
    tenantId?: string,
    reason?: string
  ): Promise<void> {
    const metadata = await this.get(sessionId, tenantId);
    if (!metadata) return;

    metadata.securityFlags = {
      ...metadata.securityFlags,
      forceReauth: true,
    };

    await this.set(sessionId, metadata);

    logger.info('Session flagged for re-auth', {
      sessionId,
      userId: metadata.userId,
      reason,
    });
  }

  /**
   * Check if session requires re-authentication
   */
  async requiresReauth(sessionId: string, tenantId?: string): Promise<boolean> {
    const metadata = await this.get(sessionId, tenantId);
    return metadata?.securityFlags?.forceReauth ?? false;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string, tenantId?: string): Promise<SessionMetadata[]> {
    const sessions: SessionMetadata[] = [];

    // Check memory fallback
    for (const metadata of this.memoryFallback.values()) {
      if (metadata.userId === userId) {
        if (!tenantId || metadata.tenantId === tenantId) {
          sessions.push(metadata);
        }
      }
    }

    return sessions;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, metadata] of this.memoryFallback.entries()) {
      if (metadata.absoluteExpiresAt < now || metadata.idleExpiresAt < now) {
        this.memoryFallback.delete(key);
        cleaned++;
      }
    }

    logger.debug('Session cleanup completed', { cleaned });
    return cleaned;
  }

  /**
   * Get store health status
   */
  getHealth(): { redis: boolean; memorySize: number } {
    return {
      redis: this.redisAvailable,
      memorySize: this.memoryFallback.size,
    };
  }

  // Private methods

  private getKey(sessionId: string, tenantId?: string): string {
    return ns(tenantId, `${this.config.keyPrefix}${sessionId}`);
  }

  private getUserPattern(userId: string, tenantId?: string): string {
    return ns(tenantId, `${this.config.keyPrefix}*:${userId}:*`);
  }

  private async getRedis() {
    const redis = await getRedisClient();
    return redis;
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const redis = await this.getRedis();
    const keys: string[] = [];
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = Number(result.cursor);
      keys.push(...result.keys);
    } while (cursor !== 0);

    return keys;
  }

  private startHealthCheck(): void {
    // Check Redis health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const redis = await getRedisClient();
        await redis.ping();
        if (!this.redisAvailable) {
          logger.info('Redis connection restored');
          this.redisAvailable = true;
        }
      } catch (error) {
        if (this.redisAvailable) {
          logger.warn('Redis connection lost, using memory fallback');
          this.redisAvailable = false;
        }
      }
    }, 30000);
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Singleton instance
let sessionStoreInstance: RedisSessionStore | null = null;

export function getSessionStore(config?: Partial<SessionStoreConfig>): RedisSessionStore {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new RedisSessionStore(config);
  }
  return sessionStoreInstance;
}

export function resetSessionStore(): void {
  if (sessionStoreInstance) {
    sessionStoreInstance.destroy();
    sessionStoreInstance = null;
  }
}

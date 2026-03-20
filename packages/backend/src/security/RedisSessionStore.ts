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
  sessionId: string;
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
    const normalizedMetadata: SessionMetadata = {
      ...metadata,
      sessionId,
    };
    const key = this.getKey(sessionId, normalizedMetadata.tenantId);

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const ttl = normalizedMetadata.absoluteExpiresAt - Date.now();

        if (ttl > 0) {
          await redis.setex(
            key,
            Math.ceil(ttl / 1000),
            JSON.stringify(normalizedMetadata)
          );
          await this.indexSession(redis, normalizedMetadata, ttl);
          logger.debug('Session stored in Redis', { sessionId, ttl });
        }
      }
    } catch (error) {
      logger.warn('Redis set failed, using memory fallback', { error: String(error) });
      this.redisAvailable = false;
    }

    // Always store in memory as backup
    this.memoryFallback.set(key, normalizedMetadata);
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
    const metadata = await this.get(sessionId, tenantId);

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        await redis.del(key);
        if (metadata) {
          await this.removeSessionIndexes(redis, sessionId, metadata);
        }
      }
    } catch (error) {
      logger.warn('Redis delete failed', { error: String(error) });
      this.redisAvailable = false;
    }

    this.memoryFallback.delete(key);
  }

  /**
   * Invalidate a session and keep a revocation marker until the original expiry.
   */
  async invalidateSession(
    sessionId: string,
    tenantId?: string,
    absoluteExpiresAt?: number
  ): Promise<void> {
    const metadata = await this.get(sessionId, tenantId);
    const expiresAt = absoluteExpiresAt ?? metadata?.absoluteExpiresAt;

    if (expiresAt && expiresAt > Date.now()) {
      const revocationKey = this.getRevocationKey(sessionId, tenantId);

      try {
        if (this.redisAvailable) {
          const redis = await this.getRedis();
          const ttlSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
          if (ttlSeconds > 0) {
            await redis.setex(revocationKey, ttlSeconds, '1');
          }
        }
      } catch (error) {
        logger.warn('Redis session revocation failed, using memory fallback', { error: String(error) });
        this.redisAvailable = false;
      }

      this.memoryFallback.set(revocationKey, {
        sessionId,
        userId: metadata?.userId ?? 'revoked',
        tenantId,
        createdAt: expiresAt,
        lastActivityAt: expiresAt,
        absoluteExpiresAt: expiresAt,
        idleExpiresAt: expiresAt,
        securityFlags: {
          ...metadata?.securityFlags,
          forceReauth: true,
        },
      });
    }

    await this.delete(sessionId, tenantId);
  }

  /**
   * Check whether the session was explicitly revoked.
   */
  async isSessionRevoked(sessionId: string, tenantId?: string): Promise<boolean> {
    const revocationKey = this.getRevocationKey(sessionId, tenantId);

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const revoked = await redis.exists(revocationKey);
        if (revoked > 0) {
          return true;
        }
      }
    } catch (error) {
      logger.warn('Redis session revocation lookup failed, using memory fallback', { error: String(error) });
      this.redisAvailable = false;
    }

    const fallbackMarker = this.memoryFallback.get(revocationKey);
    return Boolean(fallbackMarker && fallbackMarker.absoluteExpiresAt > Date.now());
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
    const invalidatedSessionIds = new Set<string>();

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const sessionIds = await redis.smembers(this.getUserIndexKey(userId, tenantId));

        await Promise.all(
          sessionIds.map(async (sessionId) => {
            const metadata = await this.get(sessionId, tenantId);
            await this.invalidateSession(sessionId, tenantId, metadata?.absoluteExpiresAt);
            invalidatedSessionIds.add(sessionId);
          })
        );

        if (sessionIds.length > 0) {
          logger.info('Invalidated user sessions in Redis', { userId, count: invalidatedSessionIds.size });
        }
      }
    } catch (error) {
      logger.warn('Redis invalidate failed', { error: String(error) });
      this.redisAvailable = false;
    }

    // Also clear from memory fallback
    const memoryPromises = [...this.memoryFallback.values()]
      .filter((metadata) => metadata.userId === userId && (!tenantId || metadata.tenantId === tenantId))
      .map(async (metadata) => {
        await this.invalidateSession(metadata.sessionId, tenantId, metadata.absoluteExpiresAt);
        invalidatedSessionIds.add(metadata.sessionId);
      });

    await Promise.all(memoryPromises);

    return invalidatedSessionIds.size;
  }

  /**
   * Invalidate sessions by device fingerprint (for device compromise)
   */
  async invalidateDeviceSessions(
    deviceId: string,
    tenantId?: string
  ): Promise<number> {
    const invalidatedSessionIds = new Set<string>();

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const sessionIds = await redis.smembers(this.getDeviceIndexKey(deviceId, tenantId));

        await Promise.all(
          sessionIds.map(async (sessionId) => {
            const metadata = await this.get(sessionId, tenantId);
            await this.invalidateSession(sessionId, tenantId, metadata?.absoluteExpiresAt);
            invalidatedSessionIds.add(sessionId);
          })
        );
      }
    } catch (error) {
      logger.warn('Redis device invalidation failed', { error: String(error) });
      this.redisAvailable = false;
    }

    // Scan memory for device matches
    const memoryPromises = [...this.memoryFallback.values()]
      .filter((metadata) => metadata.deviceId === deviceId && (!tenantId || metadata.tenantId === tenantId))
      .map(async (metadata) => {
        await this.invalidateSession(metadata.sessionId, tenantId, metadata.absoluteExpiresAt);
        invalidatedSessionIds.add(metadata.sessionId);
      });

    await Promise.all(memoryPromises);

    logger.info('Invalidated device sessions', { deviceId, count: invalidatedSessionIds.size });
    return invalidatedSessionIds.size;
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

    try {
      if (this.redisAvailable) {
        const redis = await this.getRedis();
        const sessionIds = await redis.smembers(this.getUserIndexKey(userId, tenantId));

        for (const sessionId of sessionIds) {
          const metadata = await this.get(sessionId, tenantId);
          if (metadata) {
            sessions.push(metadata);
          }
        }

        if (sessions.length > 0) {
          return sessions;
        }
      }
    } catch (error) {
      logger.warn('Redis user session lookup failed, using memory fallback', { error: String(error) });
      this.redisAvailable = false;
    }

    // Check memory fallback
    for (const [key, metadata] of this.memoryFallback.entries()) {
      if (key === this.getRevocationKey(metadata.sessionId, metadata.tenantId)) {
        continue;
      }

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

  private getUserIndexKey(userId: string, tenantId?: string): string {
    return ns(tenantId, `${this.config.keyPrefix}user:${userId}`);
  }

  private getDeviceIndexKey(deviceId: string, tenantId?: string): string {
    return ns(tenantId, `${this.config.keyPrefix}device:${deviceId}`);
  }

  private getRevocationKey(sessionId: string, tenantId?: string): string {
    return ns(tenantId, `${this.config.keyPrefix}revoked:${sessionId}`);
  }

  private async getRedis() {
    const redis = await getRedisClient();
    return redis;
  }

  private async indexSession(redis: Awaited<ReturnType<RedisSessionStore['getRedis']>>, metadata: SessionMetadata, ttl: number): Promise<void> {
    await redis.sadd(this.getUserIndexKey(metadata.userId, metadata.tenantId), metadata.sessionId);
    await redis.expire(this.getUserIndexKey(metadata.userId, metadata.tenantId), Math.ceil(ttl / 1000));

    if (metadata.deviceId) {
      await redis.sadd(this.getDeviceIndexKey(metadata.deviceId, metadata.tenantId), metadata.sessionId);
      await redis.expire(this.getDeviceIndexKey(metadata.deviceId, metadata.tenantId), Math.ceil(ttl / 1000));
    }
  }

  private async removeSessionIndexes(
    redis: Awaited<ReturnType<RedisSessionStore['getRedis']>>,
    sessionId: string,
    metadata: SessionMetadata
  ): Promise<void> {
    await redis.srem(this.getUserIndexKey(metadata.userId, metadata.tenantId), sessionId);

    if (metadata.deviceId) {
      await redis.srem(this.getDeviceIndexKey(metadata.deviceId, metadata.tenantId), sessionId);
    }
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

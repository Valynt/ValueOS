/**
 * Redis Cache Client
 * 
 * Provides caching with graceful degradation.
 * Application continues to work if Redis is unavailable.
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;
let isConnected = false;

export interface CacheConfig {
  enabled: boolean;
  url?: string;
  ttl: number;
}

export interface CacheHealthCheck {
  connected: boolean;
  latency: number;
  error?: string;
}

/**
 * Initialize Redis cache with graceful degradation
 * 
 * @param config - Cache configuration
 * @returns Health check result
 */
export async function initializeRedisCache(
  config: CacheConfig
): Promise<CacheHealthCheck> {
  if (!config.enabled) {
    logger.info('Redis cache disabled');
    return { connected: false, latency: 0 };
  }

  if (!config.url) {
    logger.warn('Redis URL not configured');
    return { connected: false, latency: 0, error: 'URL not configured' };
  }

  try {
    const startTime = Date.now();
    
    // Create Redis client
    redisClient = createClient({
      url: config.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 100ms, 200ms, 400ms, ..., max 3s
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 5000,
      },
    });

    // Error handling
    redisClient.on('error', (error) => {
      logger.error('Redis client error', error);
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      isConnected = true;
    });

    // Connect with timeout
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      ),
    ]);

    // Test connection
    await redisClient.ping();

    const latency = Date.now() - startTime;
    isConnected = true;

    logger.info('Redis cache initialized', {
      url: maskRedisUrl(config.url),
      latency,
    });

    return { connected: true, latency };
  } catch (error) {
    logger.warn('Redis cache initialization failed - continuing without cache', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Clean up failed client
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (e) {
        // Ignore cleanup errors
      }
      redisClient = null;
    }

    isConnected = false;

    return {
      connected: false,
      latency: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Mask password in Redis URL for logging
 */
function maskRedisUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.password) {
      urlObj.password = '***';
    }
    return urlObj.toString();
  } catch {
    return 'redis://***';
  }
}

/**
 * Get Redis client (may be null if not connected)
 */
export function getRedisClient(): RedisClientType | null {
  return isConnected ? redisClient : null;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Set cache value with optional TTL
 * 
 * @param key - Cache key
 * @param value - Value to cache (will be JSON stringified if object)
 * @param ttl - Time to live in seconds (optional)
 * @returns Success status
 */
export async function setCache(
  key: string,
  value: any,
  ttl?: number
): Promise<boolean> {
  if (!isConnected || !redisClient) {
    return false;
  }

  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await redisClient.setEx(key, ttl, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
    
    return true;
  } catch (error) {
    logger.warn('Cache set failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get cache value
 * 
 * @param key - Cache key
 * @param parseJson - Whether to parse as JSON (default: true)
 * @returns Cached value or null
 */
export async function getCache<T = any>(
  key: string,
  parseJson: boolean = true
): Promise<T | null> {
  if (!isConnected || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    
    if (value === null) {
      return null;
    }
    
    if (parseJson) {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }
    
    return value as T;
  } catch (error) {
    logger.warn('Cache get failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Delete cache value
 * 
 * @param key - Cache key
 * @returns Success status
 */
export async function deleteCache(key: string): Promise<boolean> {
  if (!isConnected || !redisClient) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.warn('Cache delete failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Delete multiple cache keys matching pattern
 * 
 * @param pattern - Key pattern (e.g., "user:*")
 * @returns Number of keys deleted
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  if (!isConnected || !redisClient) {
    return 0;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    
    await redisClient.del(keys);
    return keys.length;
  } catch (error) {
    logger.warn('Cache pattern delete failed', {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Check if key exists in cache
 * 
 * @param key - Cache key
 * @returns Whether key exists
 */
export async function hasCache(key: string): Promise<boolean> {
  if (!isConnected || !redisClient) {
    return false;
  }

  try {
    const exists = await redisClient.exists(key);
    return exists === 1;
  } catch (error) {
    logger.warn('Cache exists check failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get cache TTL (time to live)
 * 
 * @param key - Cache key
 * @returns TTL in seconds, or -1 if no expiry, or -2 if key doesn't exist
 */
export async function getCacheTTL(key: string): Promise<number> {
  if (!isConnected || !redisClient) {
    return -2;
  }

  try {
    return await redisClient.ttl(key);
  } catch (error) {
    logger.warn('Cache TTL check failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return -2;
  }
}

/**
 * Increment cache value (atomic operation)
 * 
 * @param key - Cache key
 * @param amount - Amount to increment (default: 1)
 * @returns New value after increment
 */
export async function incrementCache(
  key: string,
  amount: number = 1
): Promise<number | null> {
  if (!isConnected || !redisClient) {
    return null;
  }

  try {
    return await redisClient.incrBy(key, amount);
  } catch (error) {
    logger.warn('Cache increment failed', {
      key,
      amount,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      isConnected = false;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Failed to close Redis connection', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Get Redis connection statistics
 */
export async function getRedisStats(): Promise<{
  connected: boolean;
  latency: number;
  info?: any;
}> {
  if (!isConnected || !redisClient) {
    return { connected: false, latency: 0 };
  }

  const startTime = Date.now();
  
  try {
    await redisClient.ping();
    const latency = Date.now() - startTime;
    
    // Get server info
    const info = await redisClient.info();
    
    return {
      connected: true,
      latency,
      info,
    };
  } catch (error) {
    return {
      connected: false,
      latency: Date.now() - startTime,
    };
  }
}

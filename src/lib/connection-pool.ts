/**
 * Connection Pool Utility
 *
 * Provides connection pooling and management for external API calls.
 * Supports connection reuse, health checking, and automatic cleanup.
 */

import { logger } from "./logger";

export interface ConnectionConfig {
  /** Maximum number of connections in pool */
  maxConnections?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  /** Maximum idle time before cleanup */
  maxIdleTime?: number;
}

export interface Connection<T> {
  /** Connection instance */
  instance: T;
  /** Timestamp when connection was created */
  createdAt: number;
  /** Timestamp of last activity */
  lastUsed: number;
  /** Whether connection is currently in use */
  inUse: boolean;
  /** Connection health status */
  healthy: boolean;
}

/**
 * Generic connection pool for managing external API connections
 */
export class ConnectionPool<T> {
  private connections: Map<string, Connection<T>> = new Map();
  private config: Required<ConnectionConfig>;
  private cleanupInterval?: NodeJS.Timeout;
  private connectionIdCounter = 0;

  constructor(config: ConnectionConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      timeout: config.timeout || 30000,
      healthCheckInterval: config.healthCheckInterval || 60000,
      maxIdleTime: config.maxIdleTime || 300000, // 5 minutes
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.config.healthCheckInterval);

    logger.info("Connection pool initialized", { config: this.config });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(
    key: string,
    factory: () => Promise<T>,
    healthCheck?: (connection: T) => Promise<boolean>
  ): Promise<T> {
    // Try to find existing healthy connection
    const existing = this.connections.get(key);

    if (existing && !existing.inUse && existing.healthy) {
      // Update last used time
      existing.lastUsed = Date.now();
      existing.inUse = true;

      logger.debug("Reusing existing connection", { key });
      return existing.instance;
    }

    // Check if we need to cleanup to make room
    if (this.connections.size >= this.config.maxConnections) {
      await this.cleanupOldestConnection();
    }

    // Create new connection
    try {
      const instance = await factory();
      const connection: Connection<T> = {
        instance,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: true,
        healthy: true,
      };

      this.connections.set(key, connection);

      logger.info("Created new connection", { key, poolSize: this.connections.size });
      return instance;
    } catch (error) {
      logger.error("Failed to create connection", error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  release(key: string): void {
    const connection = this.connections.get(key);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      logger.debug("Connection released", { key });
    }
  }

  /**
   * Remove a connection from the pool
   */
  remove(key: string): void {
    const connection = this.connections.get(key);
    if (connection) {
      this.connections.delete(key);
      logger.info("Connection removed", { key, poolSize: this.connections.size });
    }
  }

  /**
   * Check connection health
   */
  async checkHealth(key: string, healthCheck: (connection: T) => Promise<boolean>): Promise<void> {
    const connection = this.connections.get(key);
    if (connection) {
      try {
        connection.healthy = await healthCheck(connection.instance);
        if (!connection.healthy) {
          logger.warn("Connection marked as unhealthy", { key });
          this.remove(key);
        }
      } catch (error) {
        logger.error("Health check failed", error instanceof Error ? error : undefined);
        connection.healthy = false;
        this.remove(key);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    active: number;
    idle: number;
    unhealthy: number;
  } {
    let active = 0;
    let idle = 0;
    let unhealthy = 0;

    for (const connection of this.connections.values()) {
      if (connection.inUse) {
        active++;
      } else {
        idle++;
      }
      if (!connection.healthy) {
        unhealthy++;
      }
    }

    return {
      total: this.connections.size,
      active,
      idle,
      unhealthy,
    };
  }

  /**
   * Cleanup idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, connection] of this.connections.entries()) {
      if (!connection.inUse && now - connection.lastUsed > this.config.maxIdleTime) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.remove(key);
    }

    if (toRemove.length > 0) {
      logger.info("Cleaned up idle connections", {
        count: toRemove.length,
        poolSize: this.connections.size,
      });
    }
  }

  /**
   * Cleanup oldest connection when pool is full
   */
  private async cleanupOldestConnection(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, connection] of this.connections.entries()) {
      if (!connection.inUse && connection.lastUsed < oldestTime) {
        oldestTime = connection.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.remove(oldestKey);
      logger.info("Removed oldest connection to make room", { key: oldestKey });
    }
  }

  /**
   * Destroy all connections and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.connections.clear();
    logger.info("Connection pool destroyed");
  }
}

/**
 * HTTP Connection Pool for API calls
 */
export class HTTPConnectionPool extends ConnectionPool<RequestInit> {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(
    baseUrl: string,
    defaultHeaders: Record<string, string> = {},
    config?: ConnectionConfig
  ) {
    super(config);
    this.baseUrl = baseUrl;
    this.defaultHeaders = defaultHeaders;
  }

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const key = `GET:${endpoint}`;
    const requestInit: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    // For HTTP, we don't actually pool connections, just track requests
    // In a real implementation, you might use keep-alive agents
    const response = await fetch(`${this.baseUrl}${endpoint}`, requestInit);

    return response;
  }
}

/**
 * Singleton connection pool manager
 */
class ConnectionPoolManager {
  private pools = new Map<string, ConnectionPool<any>>();

  getPool<T>(name: string): ConnectionPool<T> | undefined {
    return this.pools.get(name);
  }

  createPool<T>(name: string, config?: ConnectionConfig): ConnectionPool<T> {
    const pool = new ConnectionPool<T>(config);
    this.pools.set(name, pool);
    return pool;
  }

  destroyPool(name: string): void {
    const pool = this.pools.get(name);
    if (pool) {
      pool.destroy();
      this.pools.delete(name);
    }
  }

  destroyAll(): void {
    for (const pool of this.pools.values()) {
      pool.destroy();
    }
    this.pools.clear();
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, pool] of this.pools.entries()) {
      stats[name] = pool.getStats();
    }
    return stats;
  }
}

export const connectionPoolManager = new ConnectionPoolManager();

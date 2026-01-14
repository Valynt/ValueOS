/**
 * Resource Manager for Singleton Cleanup
 *
 * Provides centralized resource management for singleton instances
 * with automatic cleanup, memory monitoring, and resource limits.
 */

import { logger } from "./logger";

export interface ResourceConfig {
  /** Maximum age of resource in milliseconds */
  maxAge?: number;
  /** Maximum idle time before cleanup */
  maxIdleTime?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Maximum memory usage in MB */
  maxMemoryMB?: number;
}

export interface ResourceEntry<T> {
  /** Resource instance */
  instance: T;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Access count */
  accessCount: number;
  /** Resource key */
  key: string;
  /** Dispose function */
  dispose?: () => Promise<void> | void;
}

/**
 * Generic resource manager for singleton instances
 */
export class ResourceManager<T> {
  private resources = new Map<string, ResourceEntry<T>>();
  private config: Required<ResourceConfig>;
  private cleanupInterval?: NodeJS.Timeout;
  private memoryMonitorInterval?: NodeJS.Timeout;

  constructor(config: ResourceConfig = {}) {
    this.config = {
      maxAge: config.maxAge || 3600000, // 1 hour
      maxIdleTime: config.maxIdleTime || 300000, // 5 minutes
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      maxMemoryMB: config.maxMemoryMB || 512, // 512MB
    };

    this.startCleanup();
    this.startMemoryMonitoring();
  }

  /**
   * Get or create a resource
   */
  async getOrCreate(
    key: string,
    factory: () => Promise<T> | T,
    dispose?: () => Promise<void> | void
  ): Promise<T> {
    const existing = this.resources.get(key);

    if (existing) {
      existing.lastAccessed = Date.now();
      existing.accessCount++;
      return existing.instance;
    }

    // Create new resource
    const instance = await factory();
    const entry: ResourceEntry<T> = {
      instance,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      key,
      dispose,
    };

    this.resources.set(key, entry);

    logger.info("Resource created", {
      key,
      resourceCount: this.resources.size,
      memoryUsage: this.getMemoryUsage(),
    });

    return instance;
  }

  /**
   * Remove a specific resource
   */
  async remove(key: string): Promise<void> {
    const entry = this.resources.get(key);
    if (entry) {
      await this.disposeEntry(entry);
      this.resources.delete(key);
      logger.info("Resource removed", { key, resourceCount: this.resources.size });
    }
  }

  /**
   * Check if resource exists
   */
  has(key: string): boolean {
    return this.resources.has(key);
  }

  /**
   * Get resource statistics
   */
  getStats(): {
    total: number;
    memoryUsage: number;
    oldestResource: number;
    mostAccessed: { key: string; count: number } | null;
  } {
    const now = Date.now();
    let oldestResource = now;
    let mostAccessed: { key: string; count: number } | null = null;

    for (const entry of this.resources.values()) {
      if (entry.createdAt < oldestResource) {
        oldestResource = entry.createdAt;
      }
      if (!mostAccessed || entry.accessCount > mostAccessed.count) {
        mostAccessed = { key: entry.key, count: entry.accessCount };
      }
    }

    return {
      total: this.resources.size,
      memoryUsage: this.getMemoryUsage(),
      oldestResource: now - oldestResource,
      mostAccessed,
    };
  }

  /**
   * Get all resource keys
   */
  getKeys(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Force cleanup of all resources
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, entry] of this.resources.entries()) {
      const age = now - entry.createdAt;
      const idleTime = now - entry.lastAccessed;

      if (age > this.config.maxAge || idleTime > this.config.maxIdleTime) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      await this.remove(key);
    }

    if (toRemove.length > 0) {
      logger.info("Cleanup completed", {
        removed: toRemove.length,
        remaining: this.resources.size,
      });
    }
  }

  /**
   * Destroy all resources and stop monitoring
   */
  async destroy(): Promise<void> {
    // Stop intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = undefined;
    }

    // Dispose all resources
    const disposePromises = Array.from(this.resources.values()).map((entry) =>
      this.disposeEntry(entry)
    );

    await Promise.allSettled(disposePromises);
    this.resources.clear();

    logger.info("Resource manager destroyed");
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error("Cleanup failed", error instanceof Error ? error : undefined);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitorInterval = setInterval(() => {
      const memoryUsage = this.getMemoryUsage();
      if (memoryUsage > this.config.maxMemoryMB) {
        logger.warn("Memory usage exceeds limit", {
          usage: memoryUsage,
          limit: this.config.maxMemoryMB,
        });

        // Force cleanup of least recently used resources
        this.forceMemoryCleanup().catch((error) => {
          logger.error("Memory cleanup failed", error instanceof Error ? error : undefined);
        });
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Force cleanup based on memory pressure
   */
  private async forceMemoryCleanup(): Promise<void> {
    const entries = Array.from(this.resources.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed
    );

    const toRemove = entries.slice(0, Math.ceil(entries.length / 2)); // Remove oldest 50%

    for (const [key] of toRemove) {
      await this.remove(key);
    }

    logger.info("Force memory cleanup completed", {
      removed: toRemove.length,
      remaining: this.resources.size,
    });
  }

  /**
   * Dispose a single resource entry
   */
  private async disposeEntry(entry: ResourceEntry<T>): Promise<void> {
    try {
      if (entry.dispose) {
        await entry.dispose();
      }
    } catch (error) {
      logger.error("Failed to dispose resource", {
        key: entry.key,
        error: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Get estimated memory usage (simplified)
   */
  private getMemoryUsage(): number {
    // Simplified estimation - in production you'd use more sophisticated tracking
    const baseMemory = this.resources.size * 1024; // ~1KB per resource
    return Math.round(baseMemory / 1024 / 1024); // Convert to MB
  }
}

/**
 * Global resource manager instances
 */
class GlobalResourceManager {
  private managers = new Map<string, ResourceManager<any>>();

  getManager<T>(name: string): ResourceManager<T> {
    let manager = this.managers.get(name);
    if (!manager) {
      manager = new ResourceManager<T>();
      this.managers.set(name, manager);
    }
    return manager;
  }

  async destroyManager(name: string): Promise<void> {
    const manager = this.managers.get(name);
    if (manager) {
      await manager.destroy();
      this.managers.delete(name);
    }
  }

  async destroyAll(): Promise<void> {
    const destroyPromises = Array.from(this.managers.entries()).map(async ([name, manager]) => {
      await manager.destroy();
      this.managers.delete(name);
    });

    await Promise.allSettled(destroyPromises);
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, manager] of this.managers.entries()) {
      stats[name] = manager.getStats();
    }
    return stats;
  }
}

export const globalResourceManager = new GlobalResourceManager();

/**
 * Decorator for automatic resource management
 */
export function managedResource<T>(managerName: string = "default", config?: ResourceConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const manager = globalResourceManager.getManager<T>(managerName);
      const key = `${target.constructor.name}:${propertyKey}`;

      return manager.getOrCreate(
        key,
        () => originalMethod.apply(this, args),
        () => {
          // Optional dispose logic
          if (this.dispose) {
            return this.dispose();
          }
        }
      );
    };

    return descriptor;
  };
}

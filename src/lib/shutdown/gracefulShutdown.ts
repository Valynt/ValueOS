/**
 * Graceful Shutdown Manager
 *
 * Registers and manages shutdown hooks for singleton services.
 * Ensures proper cleanup of resources on process termination.
 */

import { logger } from "../logger";

type ShutdownHandler = () => Promise<void>;

interface ShutdownRegistration {
  name: string;
  handler: ShutdownHandler;
  priority: number; // Lower numbers run first
}

class GracefulShutdownManager {
  private handlers: ShutdownRegistration[] = [];
  private isShuttingDown = false;
  private shutdownTimeout = 30000; // 30 seconds default

  constructor() {
    this.setupSignalHandlers();
  }

  /**
   * Register a shutdown handler
   */
  register(
    name: string,
    handler: ShutdownHandler,
    priority: number = 10
  ): void {
    this.handlers.push({ name, handler, priority });
    logger.debug("Shutdown handler registered", { name, priority });
  }

  /**
   * Unregister a shutdown handler
   */
  unregister(name: string): void {
    this.handlers = this.handlers.filter((h) => h.name !== name);
    logger.debug("Shutdown handler unregistered", { name });
  }

  /**
   * Set shutdown timeout
   */
  setShutdownTimeout(timeoutMs: number): void {
    this.shutdownTimeout = timeoutMs;
  }

  /**
   * Execute all shutdown handlers
   */
  async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    logger.info("Graceful shutdown initiated", { signal });

    // Sort handlers by priority (lower first)
    const sortedHandlers = [...this.handlers].sort(
      (a, b) => a.priority - b.priority
    );

    // Create timeout promise
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${this.shutdownTimeout}ms`));
      }, this.shutdownTimeout);
    });

    try {
      // Execute handlers with timeout
      await Promise.race([
        this.executeHandlers(sortedHandlers),
        timeoutPromise,
      ]);

      logger.info("Graceful shutdown completed successfully");
    } catch (error) {
      logger.error("Graceful shutdown failed or timed out", error as Error);
    }
  }

  /**
   * Execute handlers sequentially
   */
  private async executeHandlers(
    handlers: ShutdownRegistration[]
  ): Promise<void> {
    for (const { name, handler } of handlers) {
      try {
        logger.debug("Executing shutdown handler", { name });
        await handler();
        logger.debug("Shutdown handler completed", { name });
      } catch (error) {
        logger.error(`Shutdown handler failed: ${name}`, error as Error);
        // Continue with other handlers even if one fails
      }
    }
  }

  /**
   * Setup process signal handlers
   */
  private setupSignalHandlers(): void {
    // Only setup in Node.js environment
    if (typeof process === "undefined" || !process.on) {
      return;
    }

    const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT", "SIGHUP"];

    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, initiating graceful shutdown`);
        await this.shutdown(signal);
        process.exit(0);
      });
    }

    // Handle uncaught exceptions
    process.on("uncaughtException", async (error) => {
      logger.error("Uncaught exception, initiating shutdown", error);
      await this.shutdown("uncaughtException");
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", async (reason) => {
      logger.error(
        "Unhandled rejection, initiating shutdown",
        reason instanceof Error ? reason : new Error(String(reason))
      );
      await this.shutdown("unhandledRejection");
      process.exit(1);
    });

    logger.debug("Signal handlers registered for graceful shutdown");
  }

  /**
   * Check if shutdown is in progress
   */
  isInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get registered handler count
   */
  getHandlerCount(): number {
    return this.handlers.length;
  }
}

// Singleton instance
let shutdownManager: GracefulShutdownManager | null = null;

export function getShutdownManager(): GracefulShutdownManager {
  if (!shutdownManager) {
    shutdownManager = new GracefulShutdownManager();
  }
  return shutdownManager;
}

/**
 * Convenience function to register a shutdown handler
 */
export function registerShutdownHandler(
  name: string,
  handler: ShutdownHandler,
  priority: number = 10
): void {
  getShutdownManager().register(name, handler, priority);
}

/**
 * Convenience function to unregister a shutdown handler
 */
export function unregisterShutdownHandler(name: string): void {
  getShutdownManager().unregister(name);
}

export { GracefulShutdownManager };

/**
 * Parallel Initializer
 *
 * Provides parallel initialization capabilities for MCP servers with
 * connection pooling, batch processing, and resource optimization.
 */

import { EventEmitter } from "events";

import { logger } from "../../lib/logger";

// ============================================================================
// Parallel Initialization Types
// ============================================================================

export interface InitializationTask {
  id: string;
  name: string;
  priority: "high" | "medium" | "low";
  dependencies?: string[];
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  executor: () => Promise<unknown>;
}

export interface InitializationResult {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: Error;
  duration: number;
  retryCount: number;
}

export interface ParallelInitConfig {
  maxConcurrency: number;
  defaultTimeout: number;
  defaultRetryAttempts: number;
  defaultRetryDelay: number;
  enableBatching: boolean;
  batchSize: number;
  enableConnectionPooling: boolean;
  poolSize: number;
}

// ============================================================================
// Connection Pool
// ============================================================================

export class ConnectionPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private waiting: Array<{
    resolve: (connection: T) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private factory: () => Promise<T>;
  private destroyer?: (connection: T) => Promise<void>;
  private maxSize: number;

  constructor(
    factory: () => Promise<T>,
    maxSize: number,
    destroyer?: (connection: T) => Promise<void>
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.destroyer = destroyer;
  }

  async acquire(): Promise<T> {
    // Return available connection if exists
    if (this.available.length > 0) {
      const connection = this.available.pop()!;
      this.inUse.add(connection);
      return connection;
    }

    // Create new connection if under max size
    if (this.inUse.size < this.maxSize) {
      try {
        const connection = await this.factory();
        this.inUse.add(connection);
        return connection;
      } catch (error) {
        throw new Error(
          `Failed to create connection: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // Wait for a connection to become available
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.findIndex((w) => w.resolve === resolve);
        if (index !== -1) {
          this.waiting.splice(index, 1);
        }
        reject(new Error("Connection pool timeout"));
      }, 30000); // 30 second timeout

      this.waiting.push({ resolve, reject, timeout });
    });
  }

  async release(connection: T): Promise<void> {
    if (!this.inUse.has(connection)) {
      return; // Connection not in use
    }

    this.inUse.delete(connection);

    // Check if someone is waiting
    const waiting = this.waiting.shift();
    if (waiting) {
      clearTimeout(waiting.timeout);
      this.inUse.add(connection);
      waiting.resolve(connection);
    } else if (this.available.length < this.maxSize) {
      this.available.push(connection);
    } else {
      // Pool is full, destroy the connection
      if (this.destroyer) {
        await this.destroyer(connection).catch((error) => {
          logger.error("Error destroying connection", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });
      }
    }
  }

  async destroy(): Promise<void> {
    // Clear waiting queue
    for (const waiting of this.waiting) {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error("Connection pool destroyed"));
    }
    this.waiting = [];

    // Destroy all connections
    const allConnections = [...this.available, ...this.inUse];
    if (this.destroyer) {
      await Promise.all(
        allConnections.map((connection) =>
          this.destroyer!(connection).catch((error) => {
            logger.error("Error destroying connection during cleanup", {
              error: error instanceof Error ? error.message : "Unknown error",
            });
          })
        )
      );
    }

    this.available = [];
    this.inUse.clear();
  }

  getStats(): { available: number; inUse: number; waiting: number; maxSize: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      maxSize: this.maxSize,
    };
  }
}

// ============================================================================
// Task Queue
// ============================================================================

class TaskQueue {
  private tasks: Map<string, InitializationTask> = new Map();
  private running: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private failed: Set<string> = new Set();
  private dependencies: Map<string, Set<string>> = new Map();

  addTask(task: InitializationTask): void {
    this.tasks.set(task.id, task);

    // Build dependency graph
    if (task.dependencies) {
      for (const dep of task.dependencies) {
        if (!this.dependencies.has(dep)) {
          this.dependencies.set(dep, new Set());
        }
        this.dependencies.get(dep)!.add(task.id);
      }
    }
  }

  getReadyTasks(): InitializationTask[] {
    const ready: InitializationTask[] = [];

    for (const [id, task] of this.tasks) {
      if (this.running.has(id) || this.completed.has(id) || this.failed.has(id)) {
        continue; // Skip already processed tasks
      }

      // Check if all dependencies are completed
      const deps = task.dependencies || [];
      const allDepsCompleted = deps.every((dep) => this.completed.has(dep));

      if (allDepsCompleted) {
        ready.push(task);
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    ready.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return ready;
  }

  markRunning(taskId: string): void {
    this.running.add(taskId);
  }

  markCompleted(taskId: string): void {
    this.running.delete(taskId);
    this.completed.add(taskId);
  }

  markFailed(taskId: string): void {
    this.running.delete(taskId);
    this.failed.add(taskId);
  }

  getStats(): { total: number; running: number; completed: number; failed: number } {
    return {
      total: this.tasks.size,
      running: this.running.size,
      completed: this.completed.size,
      failed: this.failed.size,
    };
  }

  isComplete(): boolean {
    return this.tasks.size === this.completed.size + this.failed.size;
  }
}

// ============================================================================
// Parallel Initializer
// ============================================================================

export class ParallelInitializer extends EventEmitter {
  private config: ParallelInitConfig;
  private taskQueue: TaskQueue;
  private connectionPools: Map<string, ConnectionPool<unknown>> = new Map();
  private results: Map<string, InitializationResult> = new Map();

  constructor(config: Partial<ParallelInitConfig> = {}) {
    super();

    this.config = {
      maxConcurrency: 10,
      defaultTimeout: 30000,
      defaultRetryAttempts: 3,
      defaultRetryDelay: 1000,
      enableBatching: true,
      batchSize: 5,
      enableConnectionPooling: true,
      poolSize: 5,
      ...config,
    };

    this.taskQueue = new TaskQueue();
  }

  /**
   * Add initialization task
   */
  addTask(task: InitializationTask): void {
    this.taskQueue.addTask(task);
    logger.debug(`Initialization task added: ${task.name}`, {
      taskId: task.id,
      priority: task.priority,
      dependencies: task.dependencies,
    });
  }

  /**
   * Create connection pool
   */
  createConnectionPool<T>(
    name: string,
    factory: () => Promise<T>,
    destroyer?: (connection: T) => Promise<void>
  ): ConnectionPool<T> {
    const pool = new ConnectionPool(factory, this.config.poolSize, destroyer);
    this.connectionPools.set(name, pool as ConnectionPool<unknown>);
    return pool;
  }

  /**
   * Execute all tasks in parallel
   */
  async execute(): Promise<Map<string, InitializationResult>> {
    const startTime = Date.now();
    logger.info("Starting parallel initialization", {
      totalTasks: this.taskQueue.getStats().total,
      maxConcurrency: this.config.maxConcurrency,
    });

    // Execute tasks until all are complete
    while (!this.taskQueue.isComplete()) {
      const readyTasks = this.taskQueue.getReadyTasks();
      const tasksToRun = readyTasks.slice(
        0,
        this.config.maxConcurrency - this.taskQueue.getStats().running
      );

      if (tasksToRun.length === 0) {
        // No tasks ready to run, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      // Run tasks in parallel
      const taskPromises = tasksToRun.map((task) => this.executeTask(task));
      await Promise.allSettled(taskPromises);
    }

    const duration = Date.now() - startTime;
    const stats = this.taskQueue.getStats();

    logger.info("Parallel initialization completed", {
      duration,
      totalTasks: stats.total,
      completedTasks: stats.completed,
      failedTasks: stats.failed,
    });

    this.emit("completed", { results: this.results, duration });
    return this.results;
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(task: InitializationTask): Promise<void> {
    const startTime = Date.now();
    this.taskQueue.markRunning(task.id);

    logger.debug(`Executing task: ${task.name}`, { taskId: task.id });

    let retryCount = 0;
    let lastError: Error | undefined;

    while (retryCount <= task.retryAttempts) {
      try {
        // Execute with timeout
        const result = await this.withTimeout(
          task.executor(),
          task.timeout || this.config.defaultTimeout
        );

        const duration = Date.now() - startTime;
        const initResult: InitializationResult = {
          taskId: task.id,
          success: true,
          result,
          duration,
          retryCount,
        };

        this.results.set(task.id, initResult);
        this.taskQueue.markCompleted(task.id);

        this.emit("taskCompleted", initResult);
        logger.debug(`Task completed: ${task.name}`, {
          taskId: task.id,
          duration,
          retryCount,
        });

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        retryCount++;

        logger.warn(`Task failed: ${task.name}`, {
          taskId: task.id,
          error: lastError.message,
          retryCount,
          maxRetries: task.retryAttempts,
        });

        if (retryCount <= task.retryAttempts) {
          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, task.retryDelay * Math.pow(2, retryCount - 1))
          );
        }
      }
    }

    // Task failed after all retries
    const duration = Date.now() - startTime;
    const initResult: InitializationResult = {
      taskId: task.id,
      success: false,
      error: lastError,
      duration,
      retryCount,
    };

    this.results.set(task.id, initResult);
    this.taskQueue.markFailed(task.id);

    this.emit("taskFailed", initResult);
    logger.error(`Task failed permanently: ${task.name}`, {
      taskId: task.id,
      error: lastError?.message,
      duration,
      retryCount,
    });
  }

  /**
   * Execute function with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get connection pool
   */
  getConnectionPool<T>(name: string): ConnectionPool<T> | undefined {
    return this.connectionPools.get(name) as ConnectionPool<T> | undefined;
  }

  /**
   * Get initialization results
   */
  getResults(): Map<string, InitializationResult> {
    return new Map(this.results);
  }

  /**
   * Get task queue statistics
   */
  getStats(): {
    tasks: { total: number; running: number; completed: number; failed: number };
    pools: Array<{ name: string; stats: { available: number; inUse: number; waiting: number; maxSize: number } }>;
  } {
    const poolStats = Array.from(this.connectionPools.entries()).map(([name, pool]) => ({
      name,
      stats: pool.getStats(),
    }));

    return {
      tasks: this.taskQueue.getStats(),
      pools: poolStats,
    };
  }

  /**
   * Clean up all resources
   */
  async destroy(): Promise<void> {
    // Destroy all connection pools
    const destroyPromises = Array.from(this.connectionPools.values()).map((pool) =>
      pool.destroy().catch((error) => {
        logger.error("Error destroying connection pool", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      })
    );

    await Promise.all(destroyPromises);
    this.connectionPools.clear();

    // Clear results
    this.results.clear();

    // Remove all listeners
    this.removeAllListeners();

    logger.info("Parallel initializer destroyed");
  }
}

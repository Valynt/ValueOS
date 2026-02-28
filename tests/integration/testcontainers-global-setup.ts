/**
 * Test Containers Global Setup with Fault Injection
 *
 * Global setup utilities for integration testing with Express app creation
 * and dynamic fault injection capabilities for Redis and PostgreSQL.
 */

import cors from "cors";
import express, { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { Client } from "pg";
import { createClient as createRedisClient, RedisClientType } from "redis";

import agentsRouter from "../../packages/backend/src/api/agents";

/**
 * Fault injection modes for infrastructure components
 */
export enum FaultMode {
  NONE = "none",
  DELAY = "delay",
  CONNECTION_REFUSED = "connection_refused",
  TIMEOUT = "timeout",
  INVALID_RESPONSE = "invalid_response",
  HIGH_LATENCY = "high_latency",
  RANDOM_FAILURE = "random_failure",
  RATE_LIMIT = "rate_limit",
  DATA_CORRUPTION = "data_corruption",
  PARTIAL_RESPONSE = "partial_response",
  CONNECTION_RESET = "connection_reset",
}

/**
 * Fault injection configuration
 */
export interface FaultInjectionConfig {
  redis?: {
    mode: FaultMode;
    delayMs?: number;
    errorMessage?: string;
    probability?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  postgresql?: {
    mode: FaultMode;
    delayMs?: number;
    errorMessage?: string;
    probability?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  global?: {
    enabled: boolean;
    seed?: number;
    maxConcurrentFaults?: number;
  };
}

/**
 * Infrastructure fault injector
 */
export class InfrastructureFaultInjector {
  private config: FaultInjectionConfig = {};

  /**
   * Configure fault injection for Redis
   */
  setRedisFault(mode: FaultMode, options?: { delayMs?: number; errorMessage?: string }): void {
    this.config.redis = { mode, ...options };
  }

  /**
   * Configure fault injection for PostgreSQL
   */
  setPostgresFault(mode: FaultMode, options?: { delayMs?: number; errorMessage?: string }): void {
    this.config.postgresql = { mode, ...options };
  }

  /**
   * Clear all fault injections
   */
  clearFaults(): void {
    this.config = {};
  }

  /**
   * Get current fault configuration
   */
  getConfig(): FaultInjectionConfig {
    return { ...this.config };
  }

  /**
   * Get current count of active faults
   */
  private getCurrentFaultCount(): number {
    let count = 0;

    if (this.config.redis && this.config.redis.mode !== FaultMode.NONE) {
      count++;
    }

    if (this.config.postgresql && this.config.postgresql.mode !== FaultMode.NONE) {
      count++;
    }

    return count;
  }

  /**
   * Reset fault injection to default state
   */
  reset(): void {
    this.config = {};
  }

  /**
   * Apply fault injection to Redis operations
   */
  async injectRedisFault<T>(operation: () => Promise<T>): Promise<T> {
    const fault = this.config.redis;
    if (!fault || fault.mode === FaultMode.NONE) {
      return operation();
    }

    // Check global fault injection settings
    if (this.config.global?.enabled) {
      // Apply probability-based fault injection
      if (fault.probability && Math.random() > fault.probability) {
        return operation();
      }

      // Check max concurrent faults
      if (
        this.config.global.maxConcurrentFaults &&
        this.getCurrentFaultCount() >= this.config.global.maxConcurrentFaults
      ) {
        return operation();
      }
    }

    switch (fault.mode) {
      case FaultMode.DELAY:
      case FaultMode.HIGH_LATENCY:
        await new Promise((resolve) => setTimeout(resolve, fault.delayMs || 1000));
        return operation();

      case FaultMode.CONNECTION_REFUSED:
        throw new Error(fault.errorMessage || "Redis connection refused");

      case FaultMode.TIMEOUT:
        throw new Error(fault.errorMessage || "Redis operation timeout");

      case FaultMode.INVALID_RESPONSE:
        // Allow operation but return invalid data
        return operation();

      case FaultMode.RANDOM_FAILURE:
        // Randomly fail with 50% probability
        if (Math.random() > 0.5) {
          throw new Error(fault.errorMessage || "Random Redis failure");
        }
        return operation();

      case FaultMode.RATE_LIMIT:
        throw new Error(fault.errorMessage || "Redis rate limit exceeded");

      case FaultMode.DATA_CORRUPTION:
        // Allow operation but corrupt data
        const result = await operation();
        if (typeof result === "string") {
          return result.split("").reverse().join("");
        }
        return result;

      case FaultMode.PARTIAL_RESPONSE:
        // Return partial response
        const partialResult = await operation();
        if (typeof partialResult === "object" && partialResult !== null) {
          const keys = Object.keys(partialResult);
          const partialKeys = keys.slice(0, Math.floor(keys.length / 2));
          return partialKeys.reduce((obj, key) => {
            obj[key] = partialResult[key];
            return obj;
          }, {} as any);
        }
        return partialResult;

      case FaultMode.CONNECTION_RESET:
        throw new Error(fault.errorMessage || "Redis connection reset");

      default:
        return operation();
    }
  }

  /**
   * Apply fault injection to PostgreSQL operations
   */
  async injectPostgresFault<T>(operation: () => Promise<T>): Promise<T> {
    const fault = this.config.postgresql;
    if (!fault || fault.mode === FaultMode.NONE) {
      return operation();
    }

    // Check global fault injection settings
    if (this.config.global?.enabled) {
      // Apply probability-based fault injection
      if (fault.probability && Math.random() > fault.probability) {
        return operation();
      }

      // Check max concurrent faults
      if (
        this.config.global.maxConcurrentFaults &&
        this.getCurrentFaultCount() >= this.config.global.maxConcurrentFaults
      ) {
        return operation();
      }
    }

    switch (fault.mode) {
      case FaultMode.DELAY:
      case FaultMode.HIGH_LATENCY:
        await new Promise((resolve) => setTimeout(resolve, fault.delayMs || 1000));
        return operation();

      case FaultMode.CONNECTION_REFUSED:
        throw new Error(fault.errorMessage || "PostgreSQL connection refused");

      case FaultMode.TIMEOUT:
        throw new Error(fault.errorMessage || "PostgreSQL operation timeout");

      case FaultMode.INVALID_RESPONSE:
        // Allow operation but return invalid data
        return operation();

      case FaultMode.RANDOM_FAILURE:
        // Randomly fail with 50% probability
        if (Math.random() > 0.5) {
          throw new Error(fault.errorMessage || "Random PostgreSQL failure");
        }
        return operation();

      case FaultMode.RATE_LIMIT:
        throw new Error(fault.errorMessage || "PostgreSQL rate limit exceeded");

      case FaultMode.DATA_CORRUPTION:
        // Allow operation but corrupt data
        const result = await operation();
        if (typeof result === "string") {
          return result.split("").reverse().join("");
        }
        return result;

      case FaultMode.PARTIAL_RESPONSE:
        // Return partial response
        const partialResult = await operation();
        if (typeof partialResult === "object" && partialResult !== null) {
          const keys = Object.keys(partialResult);
          const partialKeys = keys.slice(0, Math.floor(keys.length / 2));
          return partialKeys.reduce((obj, key) => {
            obj[key] = partialResult[key];
            return obj;
          }, {} as any);
        }
        return partialResult;

      case FaultMode.CONNECTION_RESET:
        throw new Error(fault.errorMessage || "PostgreSQL connection reset");

      default:
        return operation();
    }
  }
}

// Global fault injector instance
export const faultInjector = new InfrastructureFaultInjector();

/**
 * Fault-injected PostgreSQL client wrapper
 */
export class FaultInjectedPostgresClient {
  private client: Client;

  constructor(connectionString: string) {
    this.client = new Client({ connectionString });
  }

  async connect(): Promise<void> {
    return faultInjector.injectPostgresFault(() => this.client.connect());
  }

  async query<T = any>(
    queryText: string,
    values?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    return faultInjector.injectPostgresFault(() => this.client.query(queryText, values));
  }

  async end(): Promise<void> {
    return this.client.end();
  }
}

/**
 * Fault-injected Redis client wrapper
 */
export class FaultInjectedRedisClient {
  private client: RedisClientType;

  constructor(url: string) {
    this.client = createRedisClient({ url });
  }

  async connect(): Promise<void> {
    await faultInjector.injectRedisFault(async () => {
      await this.client.connect();
    });
  }

  async set(key: string, value: string): Promise<string | null> {
    return faultInjector.injectRedisFault(() => this.client.set(key, value));
  }

  async get(key: string): Promise<string | null> {
    return faultInjector.injectRedisFault(() => this.client.get(key));
  }

  async del(key: string): Promise<number> {
    return faultInjector.injectRedisFault(() => this.client.del(key));
  }

  async disconnect(): Promise<void> {
    return this.client.disconnect();
  }
}

/**
 * Create a test Express application with API routes
 *
 * This sets up a minimal Express app for integration testing
 * with mocked services and authentication.
 */
export async function createTestApp(): Promise<Express> {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use("/api/agents", agentsRouter);

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Test app error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  });

  return app;
}

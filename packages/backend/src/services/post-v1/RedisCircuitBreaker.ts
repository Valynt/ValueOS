/**
 * Redis Circuit Breaker Service
 *
 * Multi-circuit manager for Redis operations. Each named operation gets its
 * own CircuitBreaker instance from the canonical lib/resilience implementation.
 * Supports fallback functions and per-operation timeout.
 *
 * ADR-0012: Uses canonical CircuitBreaker from lib/resilience.
 */

import { createLogger } from "../../lib/logger.js";
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
} from "../../lib/resilience/CircuitBreaker.js";

const log = createLogger({ component: "RedisCircuitBreaker" });

export interface RedisOperation<T> {
  operation: () => Promise<T>;
  fallback?: () => Promise<T> | T;
  operationName: string;
  timeout?: number;
}

export class RedisCircuitBreaker {
  private static readonly DEFAULT_CONFIG: Partial<CircuitBreakerConfig> = {
    failureThreshold: 3,
    recoveryTimeout: 30_000,
    monitoringPeriod: 120_000,
  };

  private breakers = new Map<string, CircuitBreaker>();
  private config: Partial<CircuitBreakerConfig>;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...RedisCircuitBreaker.DEFAULT_CONFIG, ...config };
  }

  private getBreaker(operationName: string): CircuitBreaker {
    if (!this.breakers.has(operationName)) {
      this.breakers.set(operationName, new CircuitBreaker(this.config));
    }
    return this.breakers.get(operationName)!;
  }

  /**
   * Execute a Redis operation with circuit breaker protection and optional fallback.
   */
  async execute<T>(operation: RedisOperation<T>): Promise<T> {
    const { operation: redisOp, fallback, operationName, timeout = 5000 } = operation;
    const breaker = this.getBreaker(operationName);

    const withTimeout = (fn: () => Promise<T> | T): Promise<T> =>
      new Promise((resolve, reject) => {
        const id = setTimeout(
          () => reject(new Error(`Operation timeout: ${operationName} (${timeout}ms)`)),
          timeout,
        );
        Promise.resolve(fn())
          .then((r) => { clearTimeout(id); resolve(r); })
          .catch((e) => { clearTimeout(id); reject(e); });
      });

    try {
      return await breaker.execute(() => withTimeout(redisOp));
    } catch (err) {
      log.warn("Redis operation failed, trying fallback", {
        operationName,
        error: (err as Error).message,
      });
      if (fallback) {
        return withTimeout(fallback);
      }
      throw err;
    }
  }

  /**
   * Get circuit breaker statistics across all named operations.
   */
  getStats(): {
    totalCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    circuits: Array<{ name: string; state: string; failures: number }>;
  } {
    const circuits = Array.from(this.breakers.entries()).map(([name, b]) => {
      const m = b.getMetrics();
      return { name, state: m.state, failures: m.failures };
    });
    return {
      totalCircuits: circuits.length,
      openCircuits: circuits.filter((c) => c.state === "open").length,
      halfOpenCircuits: circuits.filter((c) => c.state === "half_open").length,
      closedCircuits: circuits.filter((c) => c.state === "closed").length,
      circuits,
    };
  }

  resetCircuit(operationName: string): void {
    this.breakers.get(operationName)?.reset();
    log.info("Circuit breaker reset", { operationName });
  }

  resetAllCircuits(): void {
    for (const b of this.breakers.values()) b.reset();
    log.info("All circuit breakers reset");
  }

  async isRedisHealthy(redisClient: unknown): Promise<boolean> {
    try {
      await this.execute({
        operation: () => (redisClient as { ping: () => Promise<unknown> }).ping(),
        operationName: "redis-ping",
        timeout: 2000,
      });
      return true;
    } catch (err) {
      log.error("Redis health check failed", err as Error);
      return false;
    }
  }
}

// Global singleton
export const redisCircuitBreaker = new RedisCircuitBreaker();

/**
 * Redis Circuit Breaker Service
 *
 * Provides failure handling and circuit breaking for Redis connectivity
 * Prevents cascading failures when Redis is unavailable
 */

import { log } from '../lib/logger';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  recoveryTimeout: number;       // Time to wait before attempting recovery (ms)
  monitoringPeriod: number;      // Time window for failure counting (ms)
  expectedRecoveryTime: number;  // Expected time for recovery (ms)
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

export interface RedisOperation<T> {
  operation: () => Promise<T>;
  fallback?: () => Promise<T> | T;
  operationName: string;
  timeout?: number;
}

export class RedisCircuitBreaker {
  private static readonly DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000,      // 1 minute
    monitoringPeriod: 300000,    // 5 minutes
    expectedRecoveryTime: 30000  // 30 seconds
  };

  private state: Map<string, CircuitBreakerState> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...RedisCircuitBreaker.DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute Redis operation with circuit breaker protection
   */
  async execute<T>(operation: RedisOperation<T>): Promise<T> {
    const { operation: redisOp, fallback, operationName, timeout = 5000 } = operation;
    const circuitState = this.getCircuitState(operationName);

    // Check if circuit is open
    if (circuitState.state === 'OPEN') {
      if (Date.now() < circuitState.nextAttemptTime) {
        log.warn('Circuit breaker OPEN, using fallback', {
          operationName,
          nextAttemptTime: new Date(circuitState.nextAttemptTime)
        });

        if (fallback) {
          return await this.executeWithTimeout(fallback, timeout, `${operationName}-fallback`);
        }
        throw new Error(`Circuit breaker OPEN for ${operationName}`);
      }

      // Transition to half-open
      circuitState.state = 'HALF_OPEN';
      circuitState.successCount = 0;
      log.info('Circuit breaker HALF_OPEN', { operationName });
    }

    try {
      // Execute the Redis operation with timeout
      const result = await this.executeWithTimeout(redisOp, timeout, operationName);

      // Success - reset or close circuit
      this.recordSuccess(operationName);

      return result;
    } catch (error) {
      // Failure - record and potentially open circuit
      this.recordFailure(operationName);

      log.error('Redis operation failed', error as Error, {
        operationName,
        failureCount: circuitState.failureCount,
        state: circuitState.state
      });

      if (fallback) {
        return await this.executeWithTimeout(fallback, timeout, `${operationName}-fallback`);
      }

      throw error;
    }
  }

  /**
   * Get current circuit state for operation
   */
  private getCircuitState(operationName: string): CircuitBreakerState {
    if (!this.state.has(operationName)) {
      this.state.set(operationName, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0
      });
    }
    return this.state.get(operationName)!;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operationName: string): void {
    const circuitState = this.getCircuitState(operationName);

    if (circuitState.state === 'HALF_OPEN') {
      circuitState.successCount++;

      // Close circuit after sufficient successes in half-open state
      if (circuitState.successCount >= 3) {
        circuitState.state = 'CLOSED';
        circuitState.failureCount = 0;
        circuitState.successCount = 0;

        log.info('Circuit breaker CLOSED', {
          operationName,
          successCount: circuitState.successCount
        });
      }
    } else if (circuitState.state === 'CLOSED') {
      // Reset failure count on success in closed state
      circuitState.failureCount = 0;
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(operationName: string): void {
    const circuitState = this.getCircuitState(operationName);
    const now = Date.now();

    circuitState.failureCount++;
    circuitState.lastFailureTime = now;

    // Check if we should open the circuit
    if (circuitState.state === 'CLOSED' || circuitState.state === 'HALF_OPEN') {
      if (circuitState.failureCount >= this.config.failureThreshold) {
        circuitState.state = 'OPEN';
        circuitState.nextAttemptTime = now + this.config.recoveryTimeout;

        log.warn('Circuit breaker OPENED', {
          operationName,
          failureCount: circuitState.failureCount,
          nextAttemptTime: new Date(circuitState.nextAttemptTime)
        });
      }
    } else if (circuitState.state === 'OPEN') {
      // Already open, just update next attempt time
      circuitState.nextAttemptTime = now + this.config.recoveryTimeout;

      log.warn('Circuit breaker still OPEN, updated next attempt time', {
        operationName,
        failureCount: circuitState.failureCount
      });
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T> | T,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout: ${operationName} (${timeoutMs}ms)`));
      }, timeoutMs);

      Promise.resolve(operation())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    totalCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    circuits: Array<{
      name: string;
      state: string;
      failureCount: number;
      lastFailureTime?: Date;
      nextAttemptTime?: Date;
    }>;
  } {
    const circuits = Array.from(this.state.entries()).map(([name, state]) => ({
      name,
      state: state.state,
      failureCount: state.failureCount,
      lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime) : undefined,
      nextAttemptTime: state.nextAttemptTime ? new Date(state.nextAttemptTime) : undefined
    }));

    const openCircuits = circuits.filter(c => c.state === 'OPEN').length;
    const halfOpenCircuits = circuits.filter(c => c.state === 'HALF_OPEN').length;
    const closedCircuits = circuits.filter(c => c.state === 'CLOSED').length;

    return {
      totalCircuits: circuits.length,
      openCircuits,
      halfOpenCircuits,
      closedCircuits,
      circuits
    };
  }

  /**
   * Reset specific circuit
   */
  resetCircuit(operationName: string): void {
    this.state.delete(operationName);
    log.info('Circuit breaker reset', { operationName });
  }

  /**
   * Reset all circuits
   */
  resetAllCircuits(): void {
    this.state.clear();
    log.info('All circuit breakers reset');
  }

  /**
   * Force open a circuit (for testing)
   */
  forceOpenCircuit(operationName: string): void {
    const circuitState = this.getCircuitState(operationName);
    circuitState.state = 'OPEN';
    circuitState.nextAttemptTime = Date.now() + this.config.recoveryTimeout;

    log.warn('Circuit breaker force OPENED', { operationName });
  }

  /**
   * Check if Redis is healthy (for health checks)
   */
  async isRedisHealthy(redisClient: unknown): Promise<boolean> {
    try {
      await this.execute({
        operation: () => redisClient.ping(),
        operationName: 'redis-ping',
        timeout: 2000
      });
      return true;
    } catch (error) {
      log.error('Redis health check failed', error as Error);
      return false;
    }
  }

  /**
   * Get Redis client with circuit breaker wrapper
   */
  wrapRedisClient(redisClient: unknown): unknown {
    return new Proxy(redisClient, {
      get: (target, prop) => {
        const originalMethod = target[prop];

        if (typeof originalMethod === 'function') {
          return (...args: unknown[]) => {
            return this.execute({
              operation: () => originalMethod.apply(target, args),
              operationName: `redis-${prop.toString()}`,
              timeout: 5000
            });
          };
        }

        return originalMethod;
      }
    });
  }

  /**
   * Create rate limiter store with circuit breaker
   */
  createRateLimitStore(redisClient: unknown, options: unknown = {}) {
    const wrappedClient = this.wrapRedisClient(redisClient);

    return {
      async increment(key: string): Promise<{ count: number; resetTime: number }> {
        try {
          const current = await wrappedClient.get(key);
          const count = current ? parseInt(current) + 1 : 1;
          const ttl = await wrappedClient.ttl(key);

          if (ttl === -1) { // No TTL set
            await wrappedClient.expire(key, options.windowMs / 1000 || 3600);
          }

          await wrappedClient.set(key, count.toString());

          return {
            count,
            resetTime: Date.now() + ((ttl > 0 ? ttl : options.windowMs / 1000 || 3600) * 1000)
          };
        } catch (error) {
          log.error('Rate limit store increment failed', error as Error, { key });
          throw error;
        }
      },

      async decrement(key: string): Promise<void> {
        try {
          const current = await wrappedClient.get(key);
          if (current) {
            const newCount = Math.max(0, parseInt(current) - 1);
            await wrappedClient.set(key, newCount.toString());
          }
        } catch (error) {
          log.error('Rate limit store decrement failed', error as Error, { key });
          throw error;
        }
      },

      async reset(key: string): Promise<void> {
        try {
          await wrappedClient.del(key);
        } catch (error) {
          log.error('Rate limit store reset failed', error as Error, { key });
          throw error;
        }
      },

      async get(key: string): Promise<{ count: number; resetTime: number } | undefined> {
        try {
          const current = await wrappedClient.get(key);
          const ttl = await wrappedClient.ttl(key);

          if (!current) return undefined;

          return {
            count: parseInt(current),
            resetTime: Date.now() + ((ttl > 0 ? ttl : 3600) * 1000)
          };
        } catch (error) {
          log.error('Rate limit store get failed', error as Error, { key });
          throw error;
        }
      }
    };
  }
}

// Global circuit breaker instance
export const redisCircuitBreaker = new RedisCircuitBreaker({
  failureThreshold: 3,          // More conservative for Redis
  recoveryTimeout: 30000,       // 30 seconds
  monitoringPeriod: 120000,     // 2 minutes
  expectedRecoveryTime: 10000   // 10 seconds
});

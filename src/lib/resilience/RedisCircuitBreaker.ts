/**
 * Redis-based Distributed Circuit Breaker
 *
 * Provides distributed circuit breaking across multiple instances using Redis
 * for state synchronization and atomic operations.
 */

import { getRedisClient } from "../redisClient";
import { logger } from "../logger";
import { CircuitBreakerError } from "./errors";
import { EventEmitter } from "node:events";
import { RedisClientType } from "redis";
import {
  ICircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "./CircuitBreakerInterface";

export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half-open",
}

export class RedisCircuitBreaker
  extends EventEmitter
  implements ICircuitBreaker
{
  private redis: RedisClientType | null = null;
  private readonly keyPrefix: string;
  private readonly config: Required<CircuitBreakerConfig>;
  private redisAvailable = false;

  constructor(
    private readonly name: string,
    config: CircuitBreakerConfig
  ) {
    super();

    // Validate configuration
    RedisCircuitBreaker.validateConfig(config);

    this.keyPrefix = `circuit:${name}`;
    this.config = {
      halfOpenSuccessThreshold: 2,
      rollingWindowSize: 10,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 2000,
      minimumSamples: 5,
      resetTimeoutMs: 60000, // 1 minute
      onOpen: () => {},
      onClose: () => {},
      onHalfOpen: () => {},
      ...config,
    };

    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = await getRedisClient();
      this.redisAvailable = true;
      logger.info(`Redis circuit breaker initialized: ${this.name}`);
    } catch (error) {
      this.redisAvailable = false;
      logger.error(
        `Failed to initialize Redis for circuit breaker ${this.name}`,
        error as Error
      );
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    // Check circuit state
    const state = await this.getState();
    if (state === CircuitState.OPEN) {
      const nextAttemptTime = await this.getNextAttemptTime();
      if (Date.now() < nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker ${this.name} is OPEN. Service is unavailable.`
        );
      }
      // Time to attempt recovery
      await this.setState(CircuitState.HALF_OPEN);
      await this.resetSuccessCount();
    }

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      await this.recordSuccess(duration);
      this.emit("success");
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.recordFailure(duration);
      this.emit("failure", error);
      throw error;
    }
  }

  private async recordSuccess(duration: number): Promise<void> {
    if (!this.redisAvailable) return;

    try {
      const pipeline = this.redis!.multi();

      // Increment success count
      pipeline.incr(`${this.keyPrefix}:successCount`);

      // Update timestamps
      pipeline.set(
        `${this.keyPrefix}:lastSuccessTime`,
        new Date().toISOString()
      );

      // Add to rolling window
      pipeline.lpush(`${this.keyPrefix}:results`, "1"); // 1 = success
      pipeline.ltrim(
        `${this.keyPrefix}:results`,
        0,
        this.config.rollingWindowSize - 1
      );

      // Add latency
      pipeline.lpush(`${this.keyPrefix}:latencies`, duration.toString());
      pipeline.ltrim(
        `${this.keyPrefix}:latencies`,
        0,
        this.config.rollingWindowSize - 1
      );

      // Increment total calls
      pipeline.incr(`${this.keyPrefix}:totalCalls`);

      // Check if we should close circuit (HALF_OPEN -> CLOSED)
      const state = await this.getState();
      if (state === CircuitState.HALF_OPEN) {
        const successCount = await this.getSuccessCount();
        if (successCount >= this.config.halfOpenSuccessThreshold) {
          pipeline.set(`${this.keyPrefix}:state`, CircuitState.CLOSED);
          pipeline.del(`${this.keyPrefix}:successCount`); // Reset for closed state
          pipeline.del(`${this.keyPrefix}:openedAt`);
          pipeline.del(`${this.keyPrefix}:halfOpenedAt`);
        }
      }

      await pipeline.exec();
    } catch (error) {
      logger.error(
        `Failed to record success for circuit breaker ${this.name}`,
        error as Error
      );
    }
  }

  private async recordFailure(duration: number): Promise<void> {
    if (!this.redisAvailable) return;

    try {
      const pipeline = this.redis!.multi();

      // Increment failure count
      pipeline.incr(`${this.keyPrefix}:failureCount`);

      // Update timestamps
      pipeline.set(
        `${this.keyPrefix}:lastFailureTime`,
        new Date().toISOString()
      );

      // Add to rolling window
      pipeline.lpush(`${this.keyPrefix}:results`, "0"); // 0 = failure
      pipeline.ltrim(
        `${this.keyPrefix}:results`,
        0,
        this.config.rollingWindowSize - 1
      );

      // Add latency
      pipeline.lpush(`${this.keyPrefix}:latencies`, duration.toString());
      pipeline.ltrim(
        `${this.keyPrefix}:latencies`,
        0,
        this.config.rollingWindowSize - 1
      );

      // Increment total calls
      pipeline.incr(`${this.keyPrefix}:totalCalls`);

      // Check if we should open circuit
      const state = await this.getState();
      if (state === CircuitState.CLOSED) {
        const shouldOpen = await this.shouldOpenCircuit();
        if (shouldOpen) {
          pipeline.set(`${this.keyPrefix}:state`, CircuitState.OPEN);
          pipeline.set(`${this.keyPrefix}:openedAt`, new Date().toISOString());
          pipeline.set(
            `${this.keyPrefix}:nextAttemptTime`,
            (Date.now() + this.config.resetTimeoutMs).toString()
          );
        }
      } else if (state === CircuitState.HALF_OPEN) {
        // Failed recovery attempt, go back to OPEN
        pipeline.set(`${this.keyPrefix}:state`, CircuitState.OPEN);
        pipeline.set(
          `${this.keyPrefix}:nextAttemptTime`,
          (Date.now() + this.config.resetTimeoutMs).toString()
        );
        pipeline.del(`${this.keyPrefix}:successCount`);
      }

      await pipeline.exec();
    } catch (error) {
      logger.error(
        `Failed to record failure for circuit breaker ${this.name}`,
        error as Error
      );
    }
  }

  private async shouldOpenCircuit(): Promise<boolean> {
    try {
      const results = await this.redis!.lrange(
        `${this.keyPrefix}:results`,
        0,
        -1
      );
      if (results.length < this.config.minimumSamples) {
        return false;
      }

      const failures = results.filter((r) => r === "0").length;
      const failureRate = failures / results.length;

      const latencies = await this.redis!.lrange(
        `${this.keyPrefix}:latencies`,
        0,
        -1
      );
      const avgLatency =
        latencies.length > 0
          ? latencies.reduce((sum, l) => sum + parseInt(l), 0) /
            latencies.length
          : 0;

      return (
        failureRate >= this.config.failureRateThreshold ||
        avgLatency >= this.config.latencyThresholdMs
      );
    } catch (error) {
      logger.error(
        `Failed to check circuit open condition for ${this.name}`,
        error as Error
      );
      return false;
    }
  }

  async getState(): Promise<CircuitBreakerState> {
    if (!this.redisAvailable) return CircuitState.CLOSED;

    try {
      const state = await this.redis!.get(`${this.keyPrefix}:state`);
      return (state as CircuitBreakerState) || CircuitState.CLOSED;
    } catch (error) {
      logger.error(
        `Failed to get state for circuit breaker ${this.name}`,
        error as Error
      );
      return CircuitState.CLOSED;
    }
  }

  private async setState(state: CircuitBreakerState): Promise<void> {
    if (!this.redisAvailable) return;

    try {
      await this.redis!.set(`${this.keyPrefix}:state`, state);
    } catch (error) {
      logger.error(
        `Failed to set state for circuit breaker ${this.name}`,
        error as Error
      );
    }
  }

  private async getSuccessCount(): Promise<number> {
    if (!this.redisAvailable) return 0;

    try {
      const count = await this.redis!.get(`${this.keyPrefix}:successCount`);
      return count ? parseInt(count) : 0;
    } catch (error) {
      return 0;
    }
  }

  private async resetSuccessCount(): Promise<void> {
    if (!this.redisAvailable) return;

    try {
      await this.redis!.set(`${this.keyPrefix}:successCount`, "0");
    } catch (error) {
      logger.error(
        `Failed to reset success count for circuit breaker ${this.name}`,
        error as Error
      );
    }
  }

  private async getNextAttemptTime(): Promise<number> {
    if (!this.redisAvailable) return 0;

    try {
      const time = await this.redis!.get(`${this.keyPrefix}:nextAttemptTime`);
      return time ? parseInt(time) : 0;
    } catch (error) {
      return 0;
    }
  }

  async getMetrics(): Promise<CircuitBreakerMetrics> {
    if (!this.redisAvailable) {
      return this.getDefaultMetrics();
    }

    try {
      const pipeline = this.redis!.multi();
      pipeline.get(`${this.keyPrefix}:state`);
      pipeline.get(`${this.keyPrefix}:failureCount`);
      pipeline.get(`${this.keyPrefix}:successCount`);
      pipeline.get(`${this.keyPrefix}:totalCalls`);
      pipeline.lrange(`${this.keyPrefix}:results`, 0, -1);
      pipeline.lrange(`${this.keyPrefix}:latencies`, 0, -1);
      pipeline.get(`${this.keyPrefix}:lastFailureTime`);
      pipeline.get(`${this.keyPrefix}:lastSuccessTime`);

      const results = await pipeline.exec();

      const state = (results[0] as string) || CircuitState.CLOSED;
      const failureCount = results[1] ? parseInt(results[1] as string) : 0;
      const successCount = results[2] ? parseInt(results[2] as string) : 0;
      const totalCalls = results[3] ? parseInt(results[3] as string) : 0;
      const resultList = results[4] as string[];
      const latencyList = results[5] as string[];
      const lastFailureTime = results[6]
        ? new Date(results[6] as string)
        : undefined;
      const lastSuccessTime = results[7]
        ? new Date(results[7] as string)
        : undefined;

      const failures = resultList.filter((r) => r === "0").length;
      const failureRate =
        resultList.length > 0 ? failures / resultList.length : 0;
      const avgLatency =
        latencyList.length > 0
          ? latencyList.reduce((sum, l) => sum + parseInt(l), 0) /
            latencyList.length
          : 0;

      return {
        state: state as CircuitBreakerState,
        failureCount: failures,
        successCount: resultList.length - failures,
        totalRequests: totalCalls,
        failureRate,
        averageResponseTime: avgLatency,
        lastFailureTime,
        lastSuccessTime,
        uptime: this.calculateUptime(state),
        healthScore: this.calculateHealthScore(state, failureRate),
      };
    } catch (error) {
      logger.error(
        `Failed to get metrics for circuit breaker ${this.name}`,
        error as Error
      );
      return this.getDefaultMetrics();
    }
  }

  private getDefaultMetrics(): CircuitBreakerMetrics {
    return {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      failureRate: 0,
      averageResponseTime: 0,
      uptime: 100,
      healthScore: 1.0,
    };
  }

  private calculateUptime(state: string): number {
    // Simplified uptime calculation
    if (state === CircuitState.OPEN) return 0;
    if (state === CircuitState.HALF_OPEN) return 50;
    return 100;
  }

  private calculateHealthScore(state: string, failureRate: number): number {
    if (state === CircuitState.OPEN) return 0.0;
    if (state === CircuitState.HALF_OPEN) return 0.5;
    return Math.max(0, Math.min(1, 1 - failureRate));
  }

  async reset(): Promise<void> {
    if (!this.redisAvailable) return;

    try {
      const keys = await this.redis!.keys(`${this.keyPrefix}:*`);
      if (keys.length > 0) {
        await this.redis!.del(keys);
      }
      logger.info(`Circuit breaker ${this.name} reset`);
    } catch (error) {
      logger.error(
        `Failed to reset circuit breaker ${this.name}`,
        error as Error
      );
    }
  }

  getFailureCount(): number {
    // This is a synchronous method for compatibility, but may not be accurate
    // Use getMetrics() for accurate async data
    return 0;
  }

  getLastFailureTime(): Date | null {
    // This is a synchronous method for compatibility
    // Use getMetrics() for accurate async data
    return null;
  }

  getNextAttemptTime(): number {
    // This is a synchronous method for compatibility
    // Use getMetrics() for accurate async data
    return 0;
  }

  /**
   * Validate circuit breaker configuration
   */
  private static validateConfig(config: CircuitBreakerConfig): void {
    if (config.failureThreshold !== undefined) {
      if (
        !Number.isInteger(config.failureThreshold) ||
        config.failureThreshold < 1
      ) {
        throw new Error(
          `failureThreshold must be a positive integer, got: ${config.failureThreshold}`
        );
      }
    }

    if (config.resetTimeoutMs !== undefined) {
      if (
        !Number.isInteger(config.resetTimeoutMs) ||
        config.resetTimeoutMs < 1000
      ) {
        throw new Error(
          `resetTimeoutMs must be at least 1000ms, got: ${config.resetTimeoutMs}`
        );
      }
    }

    if (config.halfOpenSuccessThreshold !== undefined) {
      if (
        !Number.isInteger(config.halfOpenSuccessThreshold) ||
        config.halfOpenSuccessThreshold < 1
      ) {
        throw new Error(
          `halfOpenSuccessThreshold must be a positive integer, got: ${config.halfOpenSuccessThreshold}`
        );
      }
    }

    if (config.rollingWindowSize !== undefined) {
      if (
        !Number.isInteger(config.rollingWindowSize) ||
        config.rollingWindowSize < 5
      ) {
        throw new Error(
          `rollingWindowSize must be at least 5, got: ${config.rollingWindowSize}`
        );
      }
    }

    if (config.failureRateThreshold !== undefined) {
      if (config.failureRateThreshold < 0 || config.failureRateThreshold > 1) {
        throw new Error(
          `failureRateThreshold must be between 0 and 1, got: ${config.failureRateThreshold}`
        );
      }
    }

    if (config.latencyThresholdMs !== undefined) {
      if (config.latencyThresholdMs < 100) {
        throw new Error(
          `latencyThresholdMs must be at least 100ms, got: ${config.latencyThresholdMs}`
        );
      }
    }
  }
}

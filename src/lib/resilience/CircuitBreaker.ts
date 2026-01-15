import { logger } from "../logger";
import { CircuitBreakerError } from "./errors";
import {
  llmCircuitBreakerState,
  resilienceEvents,
} from "../monitoring/metrics";
import {
  ICircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "./CircuitBreakerInterface";

// Re-export types for consumers
export { CircuitBreakerError } from "./errors";
export type { CircuitBreakerConfig, CircuitBreakerMetrics } from "./CircuitBreakerInterface";

// Browser-safe EventEmitter
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

class BrowserEventEmitter {
  private listeners: Map<string, Function[]> = new Map();
  
  on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }
  
  emit(event: string, ...args: any[]) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
    return true;
  }
  
  removeListener(event: string, listener: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
    return this;
  }
  
  removeAllListeners(event?: string) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

// Use browser-safe EventEmitter or Node's EventEmitter
let EventEmitter: any;
let RedisCircuitBreaker: any = null;

if (isBrowser) {
  EventEmitter = BrowserEventEmitter;
} else {
  // Server-side: use Node.js EventEmitter and Redis
  try {
    EventEmitter = require("node:events").EventEmitter;
    RedisCircuitBreaker = require("./RedisCircuitBreaker").RedisCircuitBreaker;
  } catch {
    EventEmitter = BrowserEventEmitter;
  }
}

export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half-open",
}

export class CircuitBreaker extends EventEmitter implements ICircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private lastFailureTime: string | undefined = undefined;
  private lastSuccessTime: string | undefined = undefined;
  private openedAt: string | undefined = undefined;
  private halfOpenedAt: string | undefined = undefined;
  private nextAttemptTime: number = 0;
  private recentResults: boolean[] = [];
  private latencies: number[] = [];
  private readonly config: Required<CircuitBreakerConfig>;
  private windowStartTime: number = Date.now();
  private redisBreaker: any = null;
  private redisAvailable = false;

  constructor(
    config: CircuitBreakerConfig,
    private readonly name: string = "default"
  ) {
    // Validate configuration
    CircuitBreaker.validateConfig(config);

    super();
    this.config = {
      halfOpenSuccessThreshold: 2,
      rollingWindowSize: 10,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 2000,
      minimumSamples: 5,
      onOpen: () => {},
      onClose: () => {},
      onHalfOpen: () => {},
      ...config,
    };

    // Initialize Redis circuit breaker (server-side only)
    if (!isBrowser) {
      this.initializeRedisBreaker();
    }
  }

  private async initializeRedisBreaker(): Promise<void> {
    // Skip in browser environment
    if (isBrowser || !RedisCircuitBreaker) {
      this.redisAvailable = false;
      return;
    }
    
    try {
      this.redisBreaker = new RedisCircuitBreaker(this.name, this.config);
      this.redisAvailable = true;
      logger.info(`Circuit breaker ${this.name} using Redis`);
    } catch (error) {
      this.redisAvailable = false;
      logger.warn(
        `Circuit breaker ${this.name} falling back to in-memory (Redis unavailable)`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Use Redis circuit breaker if available
    if (this.redisAvailable && this.redisBreaker) {
      try {
        const result = await this.redisBreaker.execute(operation);
        this.emit("success");
        return result;
      } catch (error) {
        this.emit("failure", error);
        throw error;
      }
    }

    // Fallback to in-memory implementation
    const startTime = Date.now();
    this.totalCalls++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          "Circuit breaker is OPEN. Service is unavailable."
        );
      }
      this.halfOpen();
    }

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.recordSuccess(duration);
      this.emit("success");
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(duration);
      this.emit("failure", error);
      throw error;
    }
  }

  private recordSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date().toISOString();
    this.recordResult(true, duration);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        this.close();
      }
    }
  }

  private recordFailure(duration: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date().toISOString();
    this.recordResult(false, duration);

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
    } else if (this.state === CircuitState.CLOSED) {
      this.evaluateThresholds();
    }
  }

  private recordResult(success: boolean, duration: number): void {
    this.recentResults.push(success);
    this.latencies.push(duration);

    if (this.recentResults.length > this.config.rollingWindowSize) {
      this.recentResults.shift();
      this.latencies.shift();
    }
  }

  private evaluateThresholds(): void {
    if (this.recentResults.length < this.config.minimumSamples) {
      return;
    }

    const failures = this.recentResults.filter((r) => !r).length;
    const failureRate = failures / this.recentResults.length;
    const avgLatency =
      this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length;

    if (
      failureRate >= this.config.failureRateThreshold ||
      avgLatency >= this.config.latencyThresholdMs
    ) {
      this.open();
    }
  }

  private open(): void {
    this.emit("state-change", this.state, CircuitState.OPEN);
    this.state = CircuitState.OPEN;
    this.openedAt = new Date().toISOString();
    this.nextAttemptTime = Date.now() + this.config.resetTimeoutMs;
    this.config.onOpen();
    logger.warn("Circuit breaker opened", {
      failureCount: this.failureCount,
      failureRate: this.getFailureRate(),
      averageLatency: this.getAverageLatency(),
    });
  }

  private close(): void {
    this.emit("state-change", this.state, CircuitState.CLOSED);
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.recentResults = [];
    this.latencies = [];
    this.openedAt = undefined;
    this.halfOpenedAt = undefined;
    this.nextAttemptTime = 0;
    this.config.onClose();
    logger.info("Circuit breaker closed");
  }

  private halfOpen(): void {
    this.emit("state-change", this.state, CircuitState.HALF_OPEN);
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenedAt = new Date().toISOString();
    this.successCount = 0;
    this.config.onHalfOpen();
    logger.info("Circuit breaker half-opened");
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    // Use Redis circuit breaker metrics if available
    if (this.redisAvailable && this.redisBreaker) {
      // For synchronous compatibility, return cached or default metrics
      // Real async metrics should be accessed via getMetricsAsync()
      return this.getDefaultMetrics();
    }

    // Fallback to in-memory metrics
    return this.getDefaultMetrics();
  }

  /**
   * Get async metrics from Redis circuit breaker
   */
  async getMetricsAsync(): Promise<CircuitBreakerMetrics> {
    if (this.redisAvailable && this.redisBreaker) {
      return await this.redisBreaker.getMetrics();
    }

    // Fallback to synchronous metrics
    return this.getMetrics();
  }

  private getDefaultMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalCalls,
      failureRate: this.getFailureRate(),
      averageResponseTime: this.getAverageLatency(),
      lastFailureTime: this.getLastFailureTime(),
      lastSuccessTime: this.lastSuccessTime
        ? new Date(this.lastSuccessTime)
        : undefined,
      uptime: this.calculateUptime(),
      healthScore: this.calculateHealthScore(),
    };
  }

  private getAverageLatency(): number {
    return this.latencies.length > 0
      ? this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length
      : 0;
  }

  private getFailureRate(): number {
    return this.recentResults.length > 0
      ? this.recentResults.filter((r) => !r).length / this.recentResults.length
      : 0;
  }

  private calculateUptime(): number {
    if (!this.openedAt) return 100; // Never opened, 100% uptime

    const now = Date.now();
    const openedTime = new Date(this.openedAt).getTime();
    const totalTime = now - this.windowStartTime;
    const downTime = now - openedTime;

    return totalTime > 0 ? ((totalTime - downTime) / totalTime) * 100 : 100;
  }

  private calculateHealthScore(): number {
    if (this.state === CircuitBreakerState.OPEN) return 0.0;
    if (this.state === CircuitBreakerState.HALF_OPEN) return 0.5;

    // In closed state, calculate based on failure rate
    const failureRate = this.getFailureRate();
    return Math.max(0, Math.min(1, 1 - failureRate));
  }

  reset(): void {
    this.close();
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): Date | null {
    return this.lastFailureTime ? new Date(this.lastFailureTime) : null;
  }

  getNextAttemptTime(): number {
    return this.nextAttemptTime;
  }

  // Legacy compatibility properties
  get failures(): number {
    return this.failureCount;
  }

  get successes(): number {
    return this.successCount;
  }

  set failures(value: number) {
    this.failureCount = value;
  }

  set successes(value: number) {
    this.successCount = value;
  }

  /**
   * Validate circuit breaker configuration
   */
  private static validateConfig(config: CircuitBreakerConfig): void {
    // Validate failureThreshold
    if (config.failureThreshold !== undefined) {
      if (
        !Number.isInteger(config.failureThreshold) ||
        config.failureThreshold < 1
      ) {
        throw new Error(
          `failureThreshold must be a positive integer, got: ${config.failureThreshold}`
        );
      }
      if (config.failureThreshold > 1000) {
        throw new Error(
          `failureThreshold too high, maximum allowed: 1000, got: ${config.failureThreshold}`
        );
      }
    }

    // Validate resetTimeoutMs
    if (config.resetTimeoutMs !== undefined) {
      if (
        !Number.isInteger(config.resetTimeoutMs) ||
        config.resetTimeoutMs < 1000
      ) {
        throw new Error(
          `resetTimeoutMs must be at least 1000ms, got: ${config.resetTimeoutMs}`
        );
      }
      if (config.resetTimeoutMs > 3600000) {
        // 1 hour
        throw new Error(
          `resetTimeoutMs too high, maximum allowed: 3600000ms (1 hour), got: ${config.resetTimeoutMs}`
        );
      }
    }

    // Validate halfOpenSuccessThreshold
    if (config.halfOpenSuccessThreshold !== undefined) {
      if (
        !Number.isInteger(config.halfOpenSuccessThreshold) ||
        config.halfOpenSuccessThreshold < 1
      ) {
        throw new Error(
          `halfOpenSuccessThreshold must be a positive integer, got: ${config.halfOpenSuccessThreshold}`
        );
      }
      if (config.halfOpenSuccessThreshold > 100) {
        throw new Error(
          `halfOpenSuccessThreshold too high, maximum allowed: 100, got: ${config.halfOpenSuccessThreshold}`
        );
      }
    }

    // Validate rollingWindowSize
    if (config.rollingWindowSize !== undefined) {
      if (
        !Number.isInteger(config.rollingWindowSize) ||
        config.rollingWindowSize < 5
      ) {
        throw new Error(
          `rollingWindowSize must be at least 5, got: ${config.rollingWindowSize}`
        );
      }
      if (config.rollingWindowSize > 1000) {
        throw new Error(
          `rollingWindowSize too high, maximum allowed: 1000, got: ${config.rollingWindowSize}`
        );
      }
    }

    // Validate failureRateThreshold
    if (config.failureRateThreshold !== undefined) {
      if (config.failureRateThreshold < 0 || config.failureRateThreshold > 1) {
        throw new Error(
          `failureRateThreshold must be between 0 and 1, got: ${config.failureRateThreshold}`
        );
      }
    }

    // Validate latencyThresholdMs
    if (config.latencyThresholdMs !== undefined) {
      if (config.latencyThresholdMs < 100) {
        throw new Error(
          `latencyThresholdMs must be at least 100ms, got: ${config.latencyThresholdMs}`
        );
      }
      if (config.latencyThresholdMs > 300000) {
        // 5 minutes
        throw new Error(
          `latencyThresholdMs too high, maximum allowed: 300000ms (5 minutes), got: ${config.latencyThresholdMs}`
        );
      }
    }

    // Validate minimumSamples
    if (config.minimumSamples !== undefined) {
      if (
        !Number.isInteger(config.minimumSamples) ||
        config.minimumSamples < 1
      ) {
        throw new Error(
          `minimumSamples must be a positive integer, got: ${config.minimumSamples}`
        );
      }
      if (config.minimumSamples > 100) {
        throw new Error(
          `minimumSamples too high, maximum allowed: 100, got: ${config.minimumSamples}`
        );
      }
    }

    // Validate callback functions
    if (config.onOpen !== undefined && typeof config.onOpen !== "function") {
      throw new Error("onOpen must be a function");
    }
    if (config.onClose !== undefined && typeof config.onClose !== "function") {
      throw new Error("onClose must be a function");
    }
    if (
      config.onHalfOpen !== undefined &&
      typeof config.onHalfOpen !== "function"
    ) {
      throw new Error("onHalfOpen must be a function");
    }
  }
}

export class LLMCircuitBreaker implements ICircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private requests: { success: boolean; timestamp: number }[] = [];
  private readonly minRequests: number = 20;
  private readonly threshold: number = 0.05; // 5%
  private readonly resetTimeoutMs: number = 60000; // 1 minute
  private nextAttemptTime: number = 0;
  private successCount: number = 0;
  private readonly halfOpenSuccessThreshold: number = 3;

  constructor() {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        resilienceEvents.inc({
          type: "circuit_trip",
          source: "llm_circuit_breaker",
        });
        throw new CircuitBreakerError(
          "Circuit breaker is OPEN. Service is unavailable."
        );
      }
      // Time to attempt recovery
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info(
        "LLM Circuit breaker entering HALF_OPEN state for recovery attempt"
      );
    }

    try {
      const result = await operation();
      this.recordResult(true);
      return result;
    } catch (error) {
      this.recordResult(false);
      throw error;
    }
  }

  private recordResult(success: boolean): void {
    this.requests.push({ success, timestamp: Date.now() });

    // Keep only last 100 requests for sliding window
    if (this.requests.length > 100) {
      this.requests.shift();
    }

    if (success) {
      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= this.halfOpenSuccessThreshold) {
          // Successfully recovered
          this.state = CircuitState.CLOSED;
          this.successCount = 0;
          this.requests = []; // Clear history on successful recovery
          logger.info("LLM Circuit breaker recovered to CLOSED state");
        }
      }
    } else {
      if (this.state === CircuitState.HALF_OPEN) {
        // Failed recovery attempt, go back to OPEN
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
        this.successCount = 0;
        logger.warn(
          "LLM Circuit breaker recovery failed, returning to OPEN state"
        );
      }
    }

    this.updateState();
  }

  private updateState(): void {
    if (this.requests.length < this.minRequests) {
      // Not enough data, stay in current state
      return;
    }

    const failures = this.requests.filter((r) => !r.success).length;
    const failureRate = failures / this.requests.length;

    if (this.state === CircuitState.CLOSED) {
      if (failureRate > this.threshold) {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
        logger.warn("LLM Circuit breaker opened", {
          failureRate,
          threshold: this.threshold,
        });
      }
    }
    // Note: HALF_OPEN transitions are handled in recordResult
  }

  private updateMetric(stateValue: number): void {
    llmCircuitBreakerState.labels({ provider: "system" }).set(stateValue);
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    const failures = this.requests.filter((r) => !r.success).length;
    const totalRequests = this.requests.length;
    const failureRate = totalRequests > 0 ? failures / totalRequests : 0;

    return {
      state: this.state,
      failureCount: failures,
      successCount: totalRequests - failures,
      totalRequests,
      failureRate,
      averageResponseTime: 0, // LLM requests don't track response time in this implementation
      lastFailureTime: (() => {
        const failure = this.requests.find((r) => !r.success);
        return failure ? new Date(failure.timestamp) : undefined;
      })(),
      uptime: this.calculateUptime(),
      healthScore: this.calculateHealthScore(),
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.requests = [];
    this.nextAttemptTime = 0;
    this.successCount = 0;
  }

  getFailureCount(): number {
    return this.requests.filter((r) => !r.success).length;
  }

  getLastFailureTime(): Date | null {
    const lastFailure = this.requests.find((r) => !r.success);
    return lastFailure ? new Date(lastFailure.timestamp) : null;
  }

  getNextAttemptTime(): number {
    return this.nextAttemptTime;
  }

  private calculateUptime(): number {
    if (this.state === CircuitState.CLOSED) return 100;
    if (this.state === CircuitState.HALF_OPEN) return 50;
    return 0; // OPEN state
  }

  private calculateHealthScore(): number {
    if (this.state === CircuitState.CLOSED) return 1.0;
    if (this.state === CircuitState.HALF_OPEN) return 0.5;
    return 0.0; // OPEN state
  }
}

/**
 * CircuitBreakerManager
 *
 * Manages multiple circuit breakers for different operations.
 * Tracks failure rates and latency to determine circuit state.
 */
export class CircuitBreakerManager {
  private breakers = new Map<
    string,
    {
      state: "closed" | "open" | "half-open";
      results: boolean[];
      nextAttemptTime: number;
      successCount: number;
    }
  >();

  private readonly config: {
    windowMs: number;
    failureRateThreshold: number;
    latencyThresholdMs: number;
    minimumSamples: number;
    timeoutMs: number;
    halfOpenMaxProbes: number;
  };

  constructor(config: {
    windowMs?: number;
    failureRateThreshold: number;
    latencyThresholdMs: number;
    minimumSamples: number;
    timeoutMs: number;
    halfOpenMaxProbes?: number;
  }) {
    this.config = {
      windowMs: config.windowMs || 5000,
      failureRateThreshold: config.failureRateThreshold,
      latencyThresholdMs: config.latencyThresholdMs,
      minimumSamples: config.minimumSamples,
      timeoutMs: Math.max(config.timeoutMs, 1000),
      halfOpenMaxProbes: config.halfOpenMaxProbes || 1,
    };
  }

  private getOrCreateBreaker(name: string) {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = {
        state: "closed",
        results: [],
        nextAttemptTime: 0,
        successCount: 0,
      };
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  private cleanOldResults(breaker: { results: boolean[] }) {
    if (breaker.results.length > this.config.minimumSamples * 2) {
      breaker.results = breaker.results.slice(-this.config.minimumSamples);
    }
  }

  private calculateFailureRate(results: boolean[]): number {
    if (results.length === 0) return 0;
    const failures = results.filter((r) => !r).length;
    return failures / results.length;
  }

  async execute<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const breaker = this.getOrCreateBreaker(name);
    this.cleanOldResults(breaker);

    if (breaker.state === "open") {
      if (Date.now() < breaker.nextAttemptTime) {
        throw new Error(`Circuit breaker "${name}" is open`);
      }
      breaker.state = "half-open";
      breaker.successCount = 0;
    }

    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      const isHighLatency = duration > this.config.latencyThresholdMs;

      breaker.results.push(!isHighLatency);

      if (isHighLatency) {
        if (breaker.state === "half-open") {
          breaker.state = "open";
          breaker.nextAttemptTime = Date.now() + this.config.timeoutMs;
        } else if (breaker.state === "closed") {
          const failureRate = this.calculateFailureRate(breaker.results);
          if (
            breaker.results.length >= this.config.minimumSamples &&
            failureRate >= this.config.failureRateThreshold
          ) {
            breaker.state = "open";
            breaker.nextAttemptTime = Date.now() + this.config.timeoutMs;
          }
        }
      } else if (breaker.state === "half-open") {
        breaker.successCount++;
        if (breaker.successCount >= this.config.halfOpenMaxProbes) {
          breaker.state = "closed";
          breaker.results = [];
        }
      }

      return result;
    } catch (error) {
      breaker.results.push(false);

      if (breaker.state === "half-open") {
        breaker.state = "open";
        breaker.nextAttemptTime = Date.now() + this.config.timeoutMs;
      } else if (breaker.state === "closed") {
        const failureRate = this.calculateFailureRate(breaker.results);
        if (
          breaker.results.length >= this.config.minimumSamples &&
          failureRate >= this.config.failureRateThreshold
        ) {
          breaker.state = "open";
          breaker.nextAttemptTime = Date.now() + this.config.timeoutMs;
        }
      }

      throw error;
    }
  }

  getState(name: string): { state: string } | undefined {
    const breaker = this.breakers.get(name);
    if (!breaker) return undefined;
    return { state: breaker.state };
  }

  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.state = "closed";
      breaker.results = [];
      breaker.nextAttemptTime = 0;
      breaker.successCount = 0;
    }
  }

  resetAll(): void {
    this.breakers.clear();
  }
}

/**
 * Resilience Module - Circuit Breaker
 *
 * Canonical implementation of CircuitBreaker and CircuitBreakerManager.
 * The services/ layer re-exports from here.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successes: number;
  failures: number;
  state: CircuitState;
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailure = 0;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      resetTimeout: config?.resetTimeout ?? 30_000,
      halfOpenRequests: config?.halfOpenRequests ?? 1,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.config.resetTimeout) {
        this.state = "half_open";
      } else {
        throw new CircuitBreakerError("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      totalRequests: this.totalRequests,
      successes: this.successes,
      failures: this.failures,
      state: this.state,
    };
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = 0;
  }

  private onSuccess(): void {
    this.successes++;
    if (this.state === "half_open") {
      this.state = "closed";
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
    }
  }
}

export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(config));
    }
    return this.breakers.get(name)!;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

/** LLM-specific circuit breaker with model-aware defaults. */
export class LLMCircuitBreaker extends CircuitBreaker {
  constructor() {
    super({ failureThreshold: 3, resetTimeout: 60_000, halfOpenRequests: 1 });
  }
}

// Re-export RedisCircuitBreaker (standalone implementation, no circular dependency)
export { RedisCircuitBreaker } from "../../services/RedisCircuitBreaker.js";

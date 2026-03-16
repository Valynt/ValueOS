// Minimal circuit breaker types for sdui package.
// The full implementation lives in packages/backend/src/lib/resilience/CircuitBreaker.ts.

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
  successThreshold?: number;
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
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      throw new CircuitBreakerError("Circuit breaker is open");
    }
    try {
      const result = await fn();
      this.failures = 0;
      if (this.state === "half_open") this.state = "closed";
      return result;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.config.failureThreshold) {
        this.state = "open";
        setTimeout(() => { this.state = "half_open"; }, this.config.resetTimeout);
      }
      throw err;
    }
  }
}

const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
  if (!registry.has(name)) {
    registry.set(name, new CircuitBreaker(config ?? { failureThreshold: 5, resetTimeout: 60000, halfOpenRequests: 1 }));
  }
  return registry.get(name)!;
}

export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return registry;
}

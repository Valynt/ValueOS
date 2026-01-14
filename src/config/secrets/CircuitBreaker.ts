/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by failing fast when external services are down
 * Automatically recovers when services become available again
 */

export enum CircuitState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Failing fast
  HALF_OPEN = "HALF_OPEN", // Testing recovery
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures to open circuit
  recoveryTimeout: number; // Time to wait before trying half-open (ms)
  monitoringPeriod: number; // Time window for failure tracking (ms)
  successThreshold: number; // Successes needed to close circuit in half-open
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalRequests: number;
  totalFailures: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private nextAttemptTime = 0;
  private totalRequests = 0;
  private totalFailures = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error("Circuit breaker is OPEN - failing fast");
      }
      // Time to try half-open
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery test, go back to open
      this.openCircuit();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures >= this.config.failureThreshold) {
        this.openCircuit();
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
  }

  /**
   * Reset circuit breaker to closed state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  resetCircuit(): void {
    this.reset();
  }

  /**
   * Force open the circuit breaker
   */
  openCircuitManually(): void {
    this.openCircuit();
  }
}

/**
 * Create a circuit breaker with sensible defaults
 */
export function createProviderCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 5, // Open after 5 failures
    recoveryTimeout: 60000, // Wait 1 minute before retry
    monitoringPeriod: 300000, // 5 minute window
    successThreshold: 3, // Need 3 successes to close
  });
}

/**
 * Create a circuit breaker with configurable settings
 */
export function createConfigurableCircuitBreaker(
  config: CircuitBreakerConfig
): CircuitBreaker {
  return new CircuitBreaker(config);
}

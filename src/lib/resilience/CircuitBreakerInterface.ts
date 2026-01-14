/**
 * Common Circuit Breaker Interface
 *
 * Standardizes the interface for all circuit breaker implementations
 * across the system for consistency and interchangeability.
 */

export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half-open",
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  uptime: number;
  healthScore: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold?: number;
  rollingWindowSize?: number;
  failureRateThreshold?: number;
  latencyThresholdMs?: number;
  minimumSamples?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onHalfOpen?: () => void;
}

export interface ICircuitBreaker {
  /**
   * Execute an operation with circuit breaker protection
   */
  execute<T>(operation: () => Promise<T>): Promise<T>;

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState;

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics;

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void;

  /**
   * Get failure count
   */
  getFailureCount(): number;

  /**
   * Get last failure time
   */
  getLastFailureTime(): Date | null;

  /**
   * Get next attempt time (when circuit will try to recover)
   */
  getNextAttemptTime(): number;
}

/**
 * Circuit Breaker Implementation
 *
 * Provides resilience for external API calls with automatic failover,
 * timeout handling, and recovery mechanisms.
 */

import { useCallback, useMemo } from 'react';

export interface CircuitBreakerOptions {
  // Failure thresholds
  failureThreshold?: number; // Number of failures before opening
  resetTimeout?: number; // Time in ms to wait before trying again

  // Timeouts
  timeout?: number; // Request timeout in ms

  // Monitoring
  monitoringPeriod?: number; // Time window for failure counting
  minimumThroughput?: number; // Minimum requests before breaking

  // Callbacks
  onStateChange?: (state: CircuitState, reason?: string) => void;
  onFailure?: (error: Error, context: string) => void;
  onRecovery?: (context: string) => void;
}

export enum CircuitState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open',     // Circuit is open, rejecting calls
  HALF_OPEN = 'half_open' // Testing if service has recovered
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  averageResponseTime?: number;
}

/**
 * Circuit Breaker class for external API resilience
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private responseTimes: number[] = [];

  private readonly options: Required<CircuitBreakerOptions>;
  private readonly name: string;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 60000, // 1 minute
      timeout: options.timeout ?? 30000, // 30 seconds
      monitoringPeriod: options.monitoringPeriod ?? 300000, // 5 minutes
      minimumThroughput: options.minimumThroughput ?? 10,
      onStateChange: options.onStateChange ?? (() => {}),
      onFailure: options.onFailure ?? (() => {}),
      onRecovery: options.onRecovery ?? (() => {}),
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    context: string = 'unknown'
  ): Promise<T> {
    const startTime = Date.now();

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.setState(CircuitState.HALF_OPEN, 'Attempting reset');
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
    }

    this.totalRequests++;

    try {
      // Execute with timeout
      const result = await this.withTimeout(fn(), this.options.timeout);

      // Record success
      this.recordSuccess(Date.now() - startTime);
      this.options.onRecovery(context);

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error as Error, context);
      throw error;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      averageResponseTime: this.getAverageResponseTime(),
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.setState(CircuitState.CLOSED, 'Manual reset');
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.responseTimes = [];
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(reason: string = 'Manual force open'): void {
    this.setState(CircuitState.OPEN, reason);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private recordSuccess(responseTime: number): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.responseTimes.push(responseTime);

    // Keep only recent response times for average calculation
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-50);
    }

    // If in half-open state, close circuit on success
    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.CLOSED, 'Recovery successful');
      this.failureCount = 0;
    }
  }

  private recordFailure(error: Error, context: string): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    this.options.onFailure(error, context);

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.setState(CircuitState.OPEN, `Failure threshold reached: ${this.failureCount}`);
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.state !== CircuitState.CLOSED) {
      return false;
    }

    // Check minimum throughput
    if (this.totalRequests < this.options.minimumThroughput) {
      return false;
    }

    // Check failure threshold
    const failureRate = this.failureCount / this.totalRequests;
    return failureRate >= 0.5 || this.failureCount >= this.options.failureThreshold;
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.options.resetTimeout;
  }

  private setState(newState: CircuitState, reason?: string): void {
    if (newState !== this.state) {
      const oldState = this.state;
      this.state = newState;
      this.options.onStateChange(newState, reason);

      console.log(`Circuit breaker '${this.name}' state changed: ${oldState} -> ${newState}${reason ? ` (${reason})` : ''}`);
    }
  }

  private getAverageResponseTime(): number | undefined {
    if (this.responseTimes.length === 0) {
      return undefined;
    }

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimes.length;
  }
}

/**
 * Circuit Breaker Registry
 *
 * Manages multiple circuit breakers with different configurations.
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.circuitBreakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, options);
      this.circuitBreakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.circuitBreakers.delete(name);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [name, breaker] of this.circuitBreakers) {
      stats[name] = breaker.getStats();
    }

    return stats;
  }
}

/**
 * Hook for using circuit breakers in React components
 */
export function useCircuitBreaker(name: string, options?: CircuitBreakerOptions) {
  const registry = CircuitBreakerRegistry.getInstance();
  const breaker = registry.get(name, options);

  const execute = useCallback(async <T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> => {
    return breaker.execute(fn, context);
  }, [breaker]);

  const stats = useMemo(() => breaker.getStats(), [breaker]);

  const reset = useCallback(() => {
    breaker.reset();
  }, [breaker]);

  const forceOpen = useCallback((reason?: string) => {
    breaker.forceOpen(reason);
  }, [breaker]);

  return {
    execute,
    stats,
    reset,
    forceOpen,
    state: stats.state,
    isAvailable: stats.state !== CircuitState.OPEN,
  };
}

// Default circuit breaker configurations
export const DEFAULT_CIRCUIT_BREAKER_CONFIGS = {
  // LLM API calls
  llm_api: {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    timeout: 60000, // 1 minute
    minimumThroughput: 5,
  },

  // Database operations
  database: {
    failureThreshold: 5,
    resetTimeout: 10000, // 10 seconds
    timeout: 5000, // 5 seconds
    minimumThroughput: 10,
  },

  // External API calls
  external_api: {
    failureThreshold: 4,
    resetTimeout: 60000, // 1 minute
    timeout: 30000, // 30 seconds
    minimumThroughput: 3,
  },

  // File operations
  file_operations: {
    failureThreshold: 2,
    resetTimeout: 5000, // 5 seconds
    timeout: 10000, // 10 seconds
    minimumThroughput: 2,
  },
};

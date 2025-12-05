/**
 * Circuit Breaker
 * 
 * Implements circuit breaker pattern to prevent cascading failures.
 * Automatically opens circuit after threshold failures and closes after recovery.
 */

/**
 * Circuit state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Name of the circuit
   */
  name: string;

  /**
   * Failure threshold to open circuit
   */
  failureThreshold: number;

  /**
   * Success threshold to close circuit from half-open
   */
  successThreshold: number;

  /**
   * Timeout before attempting to close circuit (ms)
   */
  timeout: number;

  /**
   * Rolling window size for failure tracking
   */
  rollingWindowSize?: number;

  /**
   * Callback when circuit opens
   */
  onOpen?: () => void;

  /**
   * Callback when circuit closes
   */
  onClose?: () => void;

  /**
   * Callback when circuit half-opens
   */
  onHalfOpen?: () => void;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  openedAt: string | null;
  halfOpenedAt: string | null;
}

/**
 * Circuit Breaker Service
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private totalCalls = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private openedAt: Date | null = null;
  private halfOpenedAt: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private recentResults: boolean[] = [];

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      rollingWindowSize: 10,
      onOpen: () => {},
      onClose: () => {},
      onHalfOpen: () => {},
      ...config,
    };
  }

  /**
   * Execute operation through circuit breaker
   */
  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.halfOpen();
      } else {
        throw new Error(`Circuit breaker '${this.config.name}' is open`);
      }
    }

    this.totalCalls++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();
    this.recordResult(true);

    if (this.state === 'half-open') {
      if (this.successes >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.recordResult(false);

    if (this.state === 'half-open') {
      this.open();
    } else if (this.state === 'closed') {
      const recentFailures = this.recentResults.filter((r) => !r).length;
      if (recentFailures >= this.config.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Record result in rolling window
   */
  private recordResult(success: boolean): void {
    this.recentResults.push(success);
    if (this.recentResults.length > this.config.rollingWindowSize) {
      this.recentResults.shift();
    }
  }

  /**
   * Open circuit
   */
  private open(): void {
    this.state = 'open';
    this.openedAt = new Date();
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
    this.config.onOpen();
    console.warn(`[CircuitBreaker] Circuit '${this.config.name}' opened`);
  }

  /**
   * Close circuit
   */
  private close(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.recentResults = [];
    this.openedAt = null;
    this.halfOpenedAt = null;
    this.nextAttemptTime = null;
    this.config.onClose();
    console.log(`[CircuitBreaker] Circuit '${this.config.name}' closed`);
  }

  /**
   * Half-open circuit
   */
  private halfOpen(): void {
    this.state = 'half-open';
    this.halfOpenedAt = new Date();
    this.successes = 0;
    this.config.onHalfOpen();
    console.log(`[CircuitBreaker] Circuit '${this.config.name}' half-opened`);
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== null && Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime?.toISOString() || null,
      lastSuccessTime: this.lastSuccessTime?.toISOString() || null,
      openedAt: this.openedAt?.toISOString() || null,
      halfOpenedAt: this.halfOpenedAt?.toISOString() || null,
    };
  }

  /**
   * Reset circuit breaker
   */
  public reset(): void {
    this.close();
  }

  /**
   * Force open circuit
   */
  public forceOpen(): void {
    this.open();
  }

  /**
   * Force close circuit
   */
  public forceClose(): void {
    this.close();
  }
}

/**
 * Circuit breaker registry
 */
class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  public static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  public register(config: CircuitBreakerConfig): CircuitBreaker {
    if (this.breakers.has(config.name)) {
      return this.breakers.get(config.name)!;
    }

    const breaker = new CircuitBreaker(config);
    this.breakers.set(config.name, breaker);
    return breaker;
  }

  public get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  public getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  public remove(name: string): void {
    this.breakers.delete(name);
  }

  public clear(): void {
    this.breakers.clear();
  }
}

/**
 * Get or create circuit breaker
 */
export function getCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
  const registry = CircuitBreakerRegistry.getInstance();
  return registry.register(config);
}

/**
 * Get all circuit breakers
 */
export function getAllCircuitBreakers(): CircuitBreaker[] {
  const registry = CircuitBreakerRegistry.getInstance();
  return registry.getAll();
}

export default CircuitBreaker;

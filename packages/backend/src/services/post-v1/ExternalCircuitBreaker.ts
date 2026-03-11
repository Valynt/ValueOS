import { logger } from '../utils/logger.js';

import { CircuitBreakerConfig, CircuitBreakerManager } from './CircuitBreaker.js';

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface IntegrationCircuitMetrics {
  key: string;
  integration: string;
  state: BreakerState;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failureRate: number;
  failureCount: number;
  lastFailureTime: string | null;
  openedAt: string | null;
}

interface ExecuteOptions<T> {
  config?: Partial<CircuitBreakerConfig>;
  fallback?: (error: Error, state: BreakerState) => Promise<T> | T;
}

export class ExternalCircuitBreaker {
  private readonly manager: CircuitBreakerManager;
  private readonly integration: string;

  constructor(integration: string, manager?: CircuitBreakerManager) {
    this.integration = integration;
    this.manager = manager ?? new CircuitBreakerManager();
  }

  async execute<T>(
    key: string,
    task: () => Promise<T>,
    options: ExecuteOptions<T> = {}
  ): Promise<T> {
    const breaker = this.manager.getBreaker(key, options.config);
    const previousState = breaker.getState();

    try {
      const result = await breaker.execute(task);
      this.logStateTransitionIfNeeded(
        key,
        previousState,
        breaker.getState()
      );
      return result;
    } catch (error) {
      const currentState = breaker.getState();
      this.logStateTransitionIfNeeded(key, previousState, currentState);

      const normalizedError =
        error instanceof Error
          ? error
          : new Error('Unknown circuit breaker error');

      if (options.fallback) {
        logger.warn('Executing integration fallback', {
          integration: this.integration,
          breakerKey: key,
          state: currentState,
          error: normalizedError.message,
        });
        return options.fallback(normalizedError, currentState as BreakerState);
      }

      throw normalizedError;
    }
  }

  getMetrics(key: string): IntegrationCircuitMetrics {
    const breaker = this.manager.getBreaker(key);
    const metrics = breaker.getMetrics();

    return {
      key,
      integration: this.integration,
      state: metrics.state as BreakerState,
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successes,
      failedRequests: metrics.failures,
      failureRate: metrics.totalRequests === 0 ? 0 : metrics.failures / metrics.totalRequests,
      failureCount: metrics.failures,
      lastFailureTime: null, // Not tracked by canonical breaker
      openedAt: null, // Not tracked by canonical breaker
    };
  }

  getAllMetrics(keys: string[]): Record<string, IntegrationCircuitMetrics> {
    return keys.reduce<Record<string, IntegrationCircuitMetrics>>((acc, key) => {
      acc[key] = this.getMetrics(key);
      return acc;
    }, {});
  }

  getState(key: string): BreakerState {
    return this.manager.getBreaker(key).getState() as BreakerState;
  }

  reset(key: string): void {
    this.manager.getBreaker(key).reset();
  }

  private logStateTransitionIfNeeded(
    key: string,
    previousState: BreakerState,
    nextState: BreakerState
  ): void {
    if (previousState === nextState) {
      return;
    }

    const payload = {
      integration: this.integration,
      breakerKey: key,
      fromState: previousState,
      toState: nextState,
      metrics: this.getMetrics(key),
    };

    if (nextState === 'open') {
      logger.warn('Circuit breaker transitioned to OPEN', payload);
      return;
    }

    if (nextState === 'half_open') {
      logger.info('Circuit breaker transitioned to HALF_OPEN', payload);
      return;
    }

    logger.info('Circuit breaker transitioned to CLOSED', payload);
  }
}

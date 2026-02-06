import { CircuitBreakerConfig, CircuitBreakerManager } from './CircuitBreaker.js';
import { logger } from '../utils/logger.js';

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
    const previousState = this.manager.getState(key)?.state ?? 'closed';

    try {
      const result = await this.manager.execute(key, task, options.config);
      this.logStateTransitionIfNeeded(
        key,
        previousState,
        this.manager.getState(key)?.state ?? 'closed'
      );
      return result;
    } catch (error) {
      const currentState = this.manager.getState(key)?.state ?? previousState;
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
        return options.fallback(normalizedError, currentState);
      }

      throw normalizedError;
    }
  }

  getMetrics(key: string): IntegrationCircuitMetrics {
    const state = this.manager.getState(key);
    const metrics = state?.metrics ?? [];
    const totalRequests = metrics.length;
    const failedRequests = metrics.filter((metric) => !metric.success).length;
    const successfulRequests = totalRequests - failedRequests;

    return {
      key,
      integration: this.integration,
      state: state?.state ?? 'closed',
      totalRequests,
      successfulRequests,
      failedRequests,
      failureRate: totalRequests === 0 ? 0 : failedRequests / totalRequests,
      failureCount: state?.failure_count ?? 0,
      lastFailureTime: state?.last_failure_time ?? null,
      openedAt: state?.opened_at ?? null,
    };
  }

  getAllMetrics(keys: string[]): Record<string, IntegrationCircuitMetrics> {
    return keys.reduce<Record<string, IntegrationCircuitMetrics>>((acc, key) => {
      acc[key] = this.getMetrics(key);
      return acc;
    }, {});
  }

  getState(key: string): BreakerState {
    return this.manager.getState(key)?.state ?? 'closed';
  }

  reset(key: string): void {
    this.manager.reset(key);
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

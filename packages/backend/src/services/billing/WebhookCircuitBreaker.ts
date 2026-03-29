/**
 * Webhook Circuit Breaker
 *
 * Circuit breaker protection for webhook retry operations to prevent
 * retry amplification storms when downstream systems are failing.
 *
 * Integrates with the canonical CircuitBreaker from lib/resilience
 * and emits metrics for monitoring and alerting.
 *
 * ADR-0012: Uses canonical CircuitBreaker from lib/resilience.
 */

import {
  CircuitBreaker,
  CircuitBreakerError,
  type CircuitBreakerConfig,
} from "../../lib/resilience/CircuitBreaker.js";
import { createLogger } from "../../lib/logger.js";
import {
  webhookCircuitBreakerOpenTotal,
  webhookCircuitBreakerRejectedTotal,
} from "../../metrics/billingMetrics.js";

const logger = createLogger({ component: "WebhookCircuitBreaker" });

/** Circuit breaker categories for webhook operations. */
export const WEBHOOK_CIRCUIT_CATEGORIES = {
  /** Primary circuit for webhook delivery attempts. */
  DELIVERY: "webhook_delivery",
  /** Circuit for webhook retry operations. */
  RETRY: "webhook_retry",
  /** Circuit for DLQ replay operations. */
  DLQ_REPLAY: "webhook_dlq_replay",
} as const;

export type WebhookCircuitCategory =
  typeof WEBHOOK_CIRCUIT_CATEGORIES[keyof typeof WEBHOOK_CIRCUIT_CATEGORIES];

/** Default configuration for webhook circuit breakers. */
const DEFAULT_WEBHOOK_BREAKER_CONFIG: Partial<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeout: 60_000, // 1 minute recovery
  halfOpenRequests: 1,
};

/** Result of a circuit breaker protected operation. */
export interface CircuitBreakerResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  circuitOpen: boolean;
}

/**
 * Webhook-specific circuit breaker manager.
 *
 * Provides circuit breaker protection for webhook delivery operations
 * with webhook-specific metrics and logging.
 */
export class WebhookCircuitBreaker {
  private breakers = new Map<string, CircuitBreaker>();
  private config: Partial<CircuitBreakerConfig>;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_WEBHOOK_BREAKER_CONFIG, ...config };
  }

  /**
   * Get or create a circuit breaker for a specific category.
   */
  private getBreaker(category: WebhookCircuitCategory): CircuitBreaker {
    if (!this.breakers.has(category)) {
      const breaker = new CircuitBreaker(this.config);
      this.breakers.set(category, breaker);

      // Log initial state
      logger.info("Webhook circuit breaker created", {
        category,
        failureThreshold: this.config.failureThreshold,
        resetTimeout: this.config.resetTimeout,
      });
    }
    return this.breakers.get(category)!;
  }

  /**
   * Execute a webhook operation with circuit breaker protection.
   *
   * If the circuit is open, the operation is rejected immediately and
   * the event should be sent to the dead-letter queue without retry.
   *
   * @param category - Circuit category (delivery, retry, dlq_replay)
   * @param eventType - Stripe event type for metrics
   * @param operation - The async operation to protect
   * @returns Result indicating success/failure and circuit state
   */
  async execute<T>(
    category: WebhookCircuitCategory,
    eventType: string,
    operation: () => Promise<T>
  ): Promise<CircuitBreakerResult<T>> {
    const breaker = this.getBreaker(category);
    const previousState = breaker.getState();

    try {
      const result = await breaker.execute(operation);

      // Log state transitions
      const currentState = breaker.getState();
      if (previousState !== currentState) {
        this.logStateTransition(category, eventType, previousState, currentState);
      }

      return { success: true, result, circuitOpen: false };
    } catch (err) {
      const currentState = breaker.getState();

      // Check if this was a circuit breaker rejection
      if (err instanceof CircuitBreakerError) {
        webhookCircuitBreakerRejectedTotal.labels({ event_type: eventType }).inc();

        logger.warn("Webhook operation rejected due to open circuit", {
          category,
          eventType,
          circuitState: currentState,
        });

        return {
          success: false,
          error: err,
          circuitOpen: true,
        };
      }

      // Log state transitions on regular failures too
      if (previousState !== currentState && currentState === "open") {
        this.logStateTransition(category, eventType, previousState, currentState);
      }

      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
        circuitOpen: false,
      };
    }
  }

  /**
   * Check if a circuit is currently open (rejecting requests).
   */
  isCircuitOpen(category: WebhookCircuitCategory): boolean {
    return this.getBreaker(category).getState() === "open";
  }

  /**
   * Get metrics for all circuit breakers.
   */
  getMetrics(): Array<{
    category: string;
    state: string;
    totalRequests: number;
    successes: number;
    failures: number;
  }> {
    return Array.from(this.breakers.entries()).map(([category, breaker]) => {
      const m = breaker.getMetrics();
      return {
        category,
        state: m.state,
        totalRequests: m.totalRequests,
        successes: m.successes,
        failures: m.failures,
      };
    });
  }

  /**
   * Reset a specific circuit breaker to closed state.
   */
  reset(category: WebhookCircuitCategory): void {
    this.getBreaker(category).reset();
    logger.info("Webhook circuit breaker reset", { category });
  }

  /**
   * Reset all circuit breakers.
   */
  resetAll(): void {
    for (const [category, breaker] of this.breakers) {
      breaker.reset();
      logger.info("Webhook circuit breaker reset", { category });
    }
  }

  private logStateTransition(
    category: string,
    eventType: string,
    fromState: string,
    toState: string
  ): void {
    const metrics = this.breakers.get(category)?.getMetrics();

    const payload = {
      category,
      eventType,
      fromState,
      toState,
      failureCount: metrics?.failures ?? 0,
      totalRequests: metrics?.totalRequests ?? 0,
    };

    if (toState === "open") {
      webhookCircuitBreakerOpenTotal.labels({ event_type: eventType }).inc();
      logger.warn("Webhook circuit breaker transitioned to OPEN", payload);
    } else if (toState === "half_open") {
      logger.info("Webhook circuit breaker transitioned to HALF_OPEN", payload);
    } else if (toState === "closed" && fromState === "half_open") {
      logger.info("Webhook circuit breaker transitioned to CLOSED (recovered)", payload);
    }
  }
}

/** Singleton instance for the application. */
let _instance: WebhookCircuitBreaker | null = null;

export function getWebhookCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): WebhookCircuitBreaker {
  if (!_instance) {
    _instance = new WebhookCircuitBreaker(config);
  }
  return _instance;
}

export function resetWebhookCircuitBreaker(): void {
  _instance?.resetAll();
  _instance = null;
}

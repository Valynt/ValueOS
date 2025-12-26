/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by failing fast when a service is unhealthy.
 */

import { logger } from "../logger";
import { CircuitBreakerError } from "./errors";
import {
  llmCircuitBreakerState,
  resilienceEvents,
} from "../monitoring/metrics";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000, // 60 seconds
    private halfOpenSuccessThreshold: number = 2
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          "Circuit breaker is OPEN. Service is unavailable."
        );
      }

      // Transition to HALF_OPEN to test if service recovered
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info("Circuit breaker transitioning to HALF_OPEN");
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        logger.info("Circuit breaker CLOSED after successful recovery");
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery attempt, go back to OPEN
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      logger.warn("Circuit breaker OPEN after failed recovery attempt");
    } else if (this.failureCount >= this.failureThreshold) {
      // Too many failures, open the circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      logger.warn("Circuit breaker OPEN due to failure threshold", {
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    logger.info("Circuit breaker manually reset");
  }
}

export class LLMCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private requests: { success: boolean; timestamp: number }[] = [];
  private readonly minRequests: number = 20;
  private readonly threshold: number = 0.05; // 5%

  constructor() {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      resilienceEvents.inc({
        type: "circuit_trip",
        source: "llm_circuit_breaker",
      });
      throw new CircuitBreakerError(
        "Circuit breaker is OPEN. Service is unavailable."
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

    this.updateState();
  }

  private updateState(): void {
    if (this.requests.length < this.minRequests) {
      this.state = CircuitState.CLOSED;
      this.updateMetric(0);
      return;
    }

    const failures = this.requests.filter((r) => !r.success).length;
    const failureRate = failures / this.requests.length;

    if (failureRate > this.threshold) {
      this.state = CircuitState.OPEN;
      this.updateMetric(1);
    } else {
      this.state = CircuitState.CLOSED;
      this.updateMetric(0);
    }
  }

  private updateMetric(stateValue: number): void {
    llmCircuitBreakerState.labels({ provider: "system" }).set(stateValue);
  }

  getState(): CircuitState {
    return this.state;
  }
}

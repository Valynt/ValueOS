import { logger } from "../logger";
import { CircuitBreakerError } from "./errors";
import { EventEmitter } from "node:events";
import {
  llmCircuitBreakerState,
  resilienceEvents,
} from "../monitoring/metrics";

export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half-open",
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

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime: string | null;
  lastSuccessTime: string | null;
  averageLatency: number;
  failureRate: number;
  requestsInWindow: number;
  windowStartTime: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private lastFailureTime: string | null = null;
  private lastSuccessTime: string | null = null;
  private openedAt: string | null = null;
  private halfOpenedAt: string | null = null;
  private nextAttemptTime: number = 0;
  private recentResults: boolean[] = [];
  private latencies: number[] = [];
  private readonly config: Required<CircuitBreakerConfig>;
  private windowStartTime: number = Date.now();

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = {
      halfOpenSuccessThreshold: 2,
      rollingWindowSize: 10,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 2000,
      minimumSamples: 5,
      onOpen: () => {},
      onClose: () => {},
      onHalfOpen: () => {},
      ...config,
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.totalCalls++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          "Circuit breaker is OPEN. Service is unavailable."
        );
      }
      this.halfOpen();
    }

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.recordSuccess(duration);
      this.emit("success");
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(duration);
      this.emit("failure", error);
      throw error;
    }
  }

  private recordSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date().toISOString();
    this.recordResult(true, duration);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        this.close();
      }
    }
  }

  private recordFailure(duration: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date().toISOString();
    this.recordResult(false, duration);

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
    } else if (this.state === CircuitState.CLOSED) {
      this.evaluateThresholds();
    }
  }

  private recordResult(success: boolean, duration: number): void {
    this.recentResults.push(success);
    this.latencies.push(duration);

    if (this.recentResults.length > this.config.rollingWindowSize) {
      this.recentResults.shift();
      this.latencies.shift();
    }
  }

  private evaluateThresholds(): void {
    if (this.recentResults.length < this.config.minimumSamples) {
      return;
    }

    const failures = this.recentResults.filter((r) => !r).length;
    const failureRate = failures / this.recentResults.length;
    const avgLatency =
      this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length;

    if (
      failureRate >= this.config.failureRateThreshold ||
      avgLatency >= this.config.latencyThresholdMs
    ) {
      this.open();
    }
  }

  private open(): void {
    this.emit("state-change", this.state, CircuitState.OPEN);
    this.state = CircuitState.OPEN;
    this.openedAt = new Date().toISOString();
    this.nextAttemptTime = Date.now() + this.config.resetTimeoutMs;
    this.config.onOpen();
    logger.warn("Circuit breaker opened", {
      failureCount: this.failureCount,
      failureRate: this.getFailureRate(),
      averageLatency: this.getAverageLatency(),
    });
  }

  private close(): void {
    this.emit("state-change", this.state, CircuitState.CLOSED);
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.recentResults = [];
    this.latencies = [];
    this.openedAt = null;
    this.halfOpenedAt = null;
    this.nextAttemptTime = 0;
    this.config.onClose();
    logger.info("Circuit breaker closed");
  }

  private halfOpen(): void {
    this.emit("state-change", this.state, CircuitState.HALF_OPEN);
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenedAt = new Date().toISOString();
    this.successCount = 0;
    this.config.onHalfOpen();
    logger.info("Circuit breaker half-opened");
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      averageLatency: this.getAverageLatency(),
      failureRate: this.getFailureRate(),
      requestsInWindow: this.recentResults.length,
      windowStartTime: this.windowStartTime,
    };
  }

  private getAverageLatency(): number {
    return this.latencies.length > 0
      ? this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length
      : 0;
  }

  private getFailureRate(): number {
    return this.recentResults.length > 0
      ? this.recentResults.filter((r) => !r).length / this.recentResults.length
      : 0;
  }

  reset(): void {
    this.close();
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): string | null {
    return this.lastFailureTime;
  }

  getNextAttemptTime(): number {
    return this.nextAttemptTime;
  }

  // Legacy compatibility properties
  get failures(): number {
    return this.failureCount;
  }

  get successes(): number {
    return this.successCount;
  }

  set failures(value: number) {
    this.failureCount = value;
  }

  set successes(value: number) {
    this.successCount = value;
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

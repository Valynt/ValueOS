/**
 * Resilience-related error classes
 */

export class ResilienceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResilienceError";
  }
}

export class TimeoutError extends ResilienceError {
  constructor(message: string = "The request timed out after 30 seconds.") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class CircuitBreakerError extends ResilienceError {
  constructor(
    message: string = "Circuit breaker is OPEN. Service is unavailable."
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class RateLimitError extends ResilienceError {
  constructor(message: string = "Rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}

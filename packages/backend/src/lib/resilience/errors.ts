/**
 * Resilience Error Types
 */

export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RetryExhaustedError extends Error {
  constructor(message = 'All retry attempts exhausted') {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class RetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryError';
  }
}

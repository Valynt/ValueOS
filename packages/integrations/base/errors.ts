/**
 * Integration error types
 */

export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

export class AuthError extends IntegrationError {
  constructor(provider: string, message: string, cause?: Error) {
    super(message, "AUTH_ERROR", provider, true, cause);
    this.name = "AuthError";
  }
}

export class RateLimitError extends IntegrationError {
  constructor(
    provider: string,
    public readonly retryAfter: number,
    cause?: Error
  ) {
    super(
      `Rate limit exceeded for ${provider}. Retry after ${retryAfter}ms`,
      "RATE_LIMIT",
      provider,
      true,
      cause
    );
    this.name = "RateLimitError";
  }
}

export class ValidationError extends IntegrationError {
  constructor(provider: string, message: string, cause?: Error) {
    super(message, "VALIDATION_ERROR", provider, false, cause);
    this.name = "ValidationError";
  }
}

export class ConnectionError extends IntegrationError {
  constructor(provider: string, message: string, cause?: Error) {
    super(message, "CONNECTION_ERROR", provider, true, cause);
    this.name = "ConnectionError";
  }
}

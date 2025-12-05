/**
 * Custom error types for service layer
 */

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export class ServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    statusCode?: number,
    details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, ServiceError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class NetworkError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.NETWORK_ERROR, undefined, details);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ServiceError {
  constructor(message: string = 'Authentication failed') {
    super(message, ErrorCode.AUTHENTICATION_ERROR, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ServiceError {
  constructor(message: string = 'Permission denied') {
    super(message, ErrorCode.AUTHORIZATION_ERROR, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string) {
    super(`${resource} not found`, ErrorCode.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.CONFLICT, 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ServiceError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends ServiceError {
  constructor(message: string = 'Request timeout') {
    super(message, ErrorCode.TIMEOUT, 408);
    this.name = 'TimeoutError';
  }
}

export const handleServiceError = (error: unknown): ServiceError => {
  if (error instanceof ServiceError) {
    return error;
  }

  if (error instanceof Error) {
    return new ServiceError(error.message, ErrorCode.UNKNOWN);
  }

  return new ServiceError('An unknown error occurred', ErrorCode.UNKNOWN);
};

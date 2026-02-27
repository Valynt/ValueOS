/**
 * Centralized Error Classes
 *
 * Provides a unified error hierarchy for the entire backend.
 * All errors extend AppError and map to specific HTTP status codes.
 */

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCode = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// HTTP Status Mapping
// ============================================================================

const errorCodeToStatus: Record<ErrorCodeType, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,
  [ErrorCode.DATABASE_ERROR]: 503,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
};

export function getHttpStatus(code: ErrorCodeType): number {
  return errorCodeToStatus[code] ?? 500;
}

// ============================================================================
// Base AppError
// ============================================================================

export interface AppErrorOptions {
  code: ErrorCodeType;
  message: string;
  status?: number;
  isOperational?: boolean;
  cause?: Error;
  details?: Record<string, unknown>;
}

/**
 * Base error class for all application errors.
 *
 * - `code`: Machine-readable error code for client handling
 * - `status`: HTTP status code
 * - `isOperational`: true = expected error (user input, not found, etc.)
 *                    false = programming error (should trigger alerts)
 * - `cause`: Original error that caused this one (for error chaining)
 * - `details`: Additional context (validation errors, field names, etc.)
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly status: number;
  public readonly isOperational: boolean;
  public override readonly cause?: Error;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.status = options.status ?? getHttpStatus(options.code);
    this.isOperational = options.isOperational ?? true;
    this.cause = options.cause;
    this.details = options.details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace, excluding constructor
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON-safe object for logging (includes internal details)
   */
  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      isOperational: this.isOperational,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }
}

// ============================================================================
// Client Error Classes (4xx)
// ============================================================================

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

export class ValidationError extends AppError {
  public readonly errors: ValidationErrorDetail[];

  constructor(
    message: string,
    errors: ValidationErrorDetail[] = [],
    cause?: Error
  ) {
    super({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      isOperational: true,
      cause,
      details: { errors },
    });
    this.errors = errors;
  }

  static fromZodError(zodError: { errors: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const errors = zodError.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return new ValidationError('Invalid request body', errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', cause?: Error) {
    super({
      code: ErrorCode.UNAUTHORIZED,
      message,
      isOperational: true,
      cause,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', cause?: Error) {
    super({
      code: ErrorCode.FORBIDDEN,
      message,
      isOperational: true,
      cause,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, cause?: Error) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super({
      code: ErrorCode.NOT_FOUND,
      message,
      isOperational: true,
      cause,
      details: { resource, id },
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, cause?: Error) {
    super({
      code: ErrorCode.CONFLICT,
      message,
      isOperational: true,
      cause,
    });
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number, cause?: Error) {
    super({
      code: ErrorCode.RATE_LIMITED,
      message,
      isOperational: true,
      cause,
      details: retryAfter ? { retryAfter } : undefined,
    });
    this.retryAfter = retryAfter;
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Request payload too large', maxSize?: number, cause?: Error) {
    super({
      code: ErrorCode.PAYLOAD_TOO_LARGE,
      message,
      isOperational: true,
      cause,
      details: maxSize ? { maxSize } : undefined,
    });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, cause?: Error) {
    super({
      code: ErrorCode.UNPROCESSABLE_ENTITY,
      message,
      isOperational: true,
      cause,
    });
  }
}

// ============================================================================
// Server Error Classes (5xx)
// ============================================================================

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred', cause?: Error) {
    super({
      code: ErrorCode.INTERNAL_ERROR,
      message,
      isOperational: false,
      cause,
    });
  }
}

export class DatabaseError extends AppError {
  public readonly dbCode?: string;

  constructor(message: string, cause?: Error, dbCode?: string) {
    super({
      code: ErrorCode.DATABASE_ERROR,
      message,
      isOperational: false,
      cause,
      details: dbCode ? { dbCode } : undefined,
    });
    this.dbCode = dbCode;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, cause?: Error) {
    super({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: `${service} is temporarily unavailable`,
      isOperational: true,
      cause,
      details: { service },
    });
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(service: string, cause?: Error) {
    super({
      code: ErrorCode.GATEWAY_TIMEOUT,
      message: `${service} request timed out`,
      isOperational: true,
      cause,
      details: { service },
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, cause?: Error) {
    super({
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      message: `${service}: ${message}`,
      isOperational: true,
      cause,
      details: { service },
    });
  }
}

// ============================================================================
// Error Type Guards
// ============================================================================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

// ============================================================================
// Error Wrapping Utilities
// ============================================================================

/**
 * Wrap an unknown error into an AppError.
 * Preserves AppError instances, wraps others as InternalError.
 */
export function wrapError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError('An unexpected error occurred', error);
  }

  return new InternalError(String(error));
}

/**
 * Extract a safe error message for client responses.
 * Masks internal errors, preserves operational error messages.
 */
export function getSafeErrorMessage(error: AppError): string {
  if (error.isOperational) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

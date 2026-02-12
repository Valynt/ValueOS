/**
 * Error Mapping Utilities
 *
 * Maps various error types to AppError classes.
 * Useful for integrating with external libraries and services.
 */

import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  ExternalServiceError,
  InternalError,
  ErrorCode,
  ErrorCodeType,
  getHttpStatus,
} from './errors';

// ============================================================================
// HTTP Status to Error Class Mapping
// ============================================================================

/**
 * Create an AppError from an HTTP status code.
 * Useful when receiving errors from external APIs.
 */
export function errorFromHttpStatus(
  status: number,
  message?: string,
  cause?: Error
): AppError {
  switch (status) {
    case 400:
      return new ValidationError(message || 'Bad request', [], cause);
    case 401:
      return new UnauthorizedError(message || 'Unauthorized', cause);
    case 403:
      return new ForbiddenError(message || 'Forbidden', cause);
    case 404:
      return new NotFoundError('Resource', undefined, cause);
    case 409:
      return new ConflictError(message || 'Conflict', cause);
    case 429:
      return new (require('./errors').RateLimitError)(
        message || 'Too many requests',
        undefined,
        cause
      );
    case 502:
      return new ExternalServiceError('Upstream', message || 'Bad gateway', cause);
    case 503:
      return new ServiceUnavailableError('Service', cause);
    case 504:
      return new GatewayTimeoutError('Upstream', cause);
    default:
      if (status >= 400 && status < 500) {
        return new AppError({
          code: ErrorCode.VALIDATION_ERROR,
          message: message || 'Client error',
          status,
          isOperational: true,
          cause,
        });
      }
      return new InternalError(message || 'Server error', cause);
  }
}

// ============================================================================
// Database Error Mapping
// ============================================================================

/**
 * PostgreSQL error codes to AppError mapping.
 * See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const pgErrorCodeMap: Record<string, (message: string, cause?: Error) => AppError> = {
  // Integrity constraint violations
  '23000': (msg, cause) => new ConflictError(msg || 'Integrity constraint violation', cause),
  '23001': (msg, cause) => new ConflictError(msg || 'Restrict violation', cause),
  '23502': (msg, cause) => new ValidationError(msg || 'Not null violation', [], cause),
  '23503': (msg, cause) => new ConflictError(msg || 'Foreign key violation', cause),
  '23505': (msg, cause) => new ConflictError(msg || 'Unique violation', cause),
  '23514': (msg, cause) => new ValidationError(msg || 'Check violation', [], cause),

  // Connection errors
  '08000': (_msg, cause) => new ServiceUnavailableError('Database', cause),
  '08003': (_msg, cause) => new ServiceUnavailableError('Database', cause),
  '08006': (_msg, cause) => new ServiceUnavailableError('Database', cause),

  // Insufficient resources
  '53000': (_msg, cause) => new ServiceUnavailableError('Database', cause),
  '53100': (_msg, cause) => new ServiceUnavailableError('Database', cause),
  '53200': (_msg, cause) => new ServiceUnavailableError('Database', cause),
  '53300': (_msg, cause) => new ServiceUnavailableError('Database', cause),

  // Query canceled (timeout)
  '57014': (_msg, cause) => new GatewayTimeoutError('Database', cause),
};

/**
 * Map a PostgreSQL error to an AppError.
 */
export function mapPostgresError(
  pgError: { code?: string; message?: string },
  cause?: Error
): AppError {
  const code = pgError.code || '';
  const message = pgError.message || 'Database error';

  // Check for exact match
  if (pgErrorCodeMap[code]) {
    return pgErrorCodeMap[code](message, cause);
  }

  // Check for class match (first 2 characters)
  const errorClass = code.substring(0, 2);
  if (pgErrorCodeMap[errorClass + '000']) {
    return pgErrorCodeMap[errorClass + '000'](message, cause);
  }

  // Default to DatabaseError
  return new DatabaseError(message, cause, code);
}

// ============================================================================
// Supabase Error Mapping
// ============================================================================

/**
 * Map Supabase PostgREST errors to AppError.
 */
export function mapSupabaseError(
  error: { code?: string; message?: string; details?: string; hint?: string },
  cause?: Error
): AppError {
  const code = error.code || '';
  const message = error.message || 'Database error';

  // PostgREST specific codes
  switch (code) {
    case 'PGRST116': // No rows returned
      return new NotFoundError('Resource', undefined, cause);
    case 'PGRST301': // JWT expired
    case 'PGRST302': // JWT invalid
      return new UnauthorizedError('Invalid or expired token', cause);
    case 'PGRST000': // Connection error
      return new ServiceUnavailableError('Database', cause);
    default:
      // Try PostgreSQL error mapping
      return mapPostgresError(error, cause);
  }
}

// ============================================================================
// Axios/Fetch Error Mapping
// ============================================================================

interface HttpErrorLike {
  response?: {
    status?: number;
    data?: { message?: string; error?: string };
  };
  code?: string;
  message?: string;
}

/**
 * Map HTTP client errors (axios, fetch) to AppError.
 */
export function mapHttpClientError(
  error: HttpErrorLike,
  serviceName = 'External service'
): AppError {
  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new ServiceUnavailableError(serviceName, error as Error);
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    return new GatewayTimeoutError(serviceName, error as Error);
  }

  // HTTP response errors
  if (error.response?.status) {
    const status = error.response.status;
    const message =
      error.response.data?.message ||
      error.response.data?.error ||
      error.message;

    return errorFromHttpStatus(status, message, error as Error);
  }

  // Unknown error
  return new ExternalServiceError(
    serviceName,
    error.message || 'Unknown error',
    error as Error
  );
}

// ============================================================================
// Error Code Utilities
// ============================================================================

/**
 * Check if an error code represents a client error (4xx).
 */
export function isClientError(code: ErrorCodeType): boolean {
  const status = getHttpStatus(code);
  return status >= 400 && status < 500;
}

/**
 * Check if an error code represents a server error (5xx).
 */
export function isServerError(code: ErrorCodeType): boolean {
  const status = getHttpStatus(code);
  return status >= 500;
}

/**
 * Check if an error should be retried.
 */
export function isRetryableError(error: AppError): boolean {
  const retryableCodes: ErrorCodeType[] = [
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.GATEWAY_TIMEOUT,
    ErrorCode.DATABASE_ERROR,
    ErrorCode.RATE_LIMITED,
  ];
  return retryableCodes.includes(error.code);
}

/**
 * Get suggested retry delay in milliseconds.
 */
export function getRetryDelay(error: AppError, attempt: number): number {
  // Use Retry-After if available
  if (error.code === ErrorCode.RATE_LIMITED && error.details?.retryAfter) {
    return (error.details.retryAfter as number) * 1000;
  }

  // Exponential backoff with jitter
  const baseDelay = 1000;
  const maxDelay = 30000;
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 0.3 * exponentialDelay;

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Error Mapping Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  errorFromHttpStatus,
  mapPostgresError,
  mapSupabaseError,
  mapHttpClientError,
  isClientError,
  isServerError,
  isRetryableError,
  getRetryDelay,
} from '../errorMapping';
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  ExternalServiceError,
  InternalError,
  DatabaseError,
  ErrorCode,
} from '../errors';

describe('Error Mapping Utilities', () => {
  // ============================================================================
  // HTTP Status Mapping
  // ============================================================================

  describe('errorFromHttpStatus', () => {
    it('maps 400 to ValidationError', () => {
      const error = errorFromHttpStatus(400, 'Bad request');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.status).toBe(400);
    });

    it('maps 401 to UnauthorizedError', () => {
      const error = errorFromHttpStatus(401);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.status).toBe(401);
    });

    it('maps 403 to ForbiddenError', () => {
      const error = errorFromHttpStatus(403);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.status).toBe(403);
    });

    it('maps 404 to NotFoundError', () => {
      const error = errorFromHttpStatus(404);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.status).toBe(404);
    });

    it('maps 409 to ConflictError', () => {
      const error = errorFromHttpStatus(409, 'Duplicate entry');
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Duplicate entry');
    });

    it('maps 429 to RateLimitError', () => {
      const error = errorFromHttpStatus(429);
      expect(error).toBeInstanceOf(RateLimitError);
    });

    it('maps 502 to ExternalServiceError', () => {
      const error = errorFromHttpStatus(502);
      expect(error).toBeInstanceOf(ExternalServiceError);
    });

    it('maps 503 to ServiceUnavailableError', () => {
      const error = errorFromHttpStatus(503);
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    });

    it('maps 504 to GatewayTimeoutError', () => {
      const error = errorFromHttpStatus(504);
      expect(error).toBeInstanceOf(GatewayTimeoutError);
    });

    it('maps unknown 4xx to generic client error', () => {
      const error = errorFromHttpStatus(418, 'I am a teapot');
      expect(error.status).toBe(418);
      expect(error.isOperational).toBe(true);
    });

    it('maps unknown 5xx to InternalError', () => {
      const error = errorFromHttpStatus(599);
      expect(error).toBeInstanceOf(InternalError);
    });
  });

  // ============================================================================
  // PostgreSQL Error Mapping
  // ============================================================================

  describe('mapPostgresError', () => {
    it('maps unique violation (23505) to ConflictError', () => {
      const error = mapPostgresError({ code: '23505', message: 'duplicate key' });
      expect(error).toBeInstanceOf(ConflictError);
    });

    it('maps foreign key violation (23503) to ConflictError', () => {
      const error = mapPostgresError({ code: '23503', message: 'foreign key' });
      expect(error).toBeInstanceOf(ConflictError);
    });

    it('maps not null violation (23502) to ValidationError', () => {
      const error = mapPostgresError({ code: '23502', message: 'null value' });
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('maps check violation (23514) to ValidationError', () => {
      const error = mapPostgresError({ code: '23514', message: 'check constraint' });
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('maps connection errors (08xxx) to ServiceUnavailableError', () => {
      const error = mapPostgresError({ code: '08006', message: 'connection failure' });
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    });

    it('maps query canceled (57014) to GatewayTimeoutError', () => {
      const error = mapPostgresError({ code: '57014', message: 'query canceled' });
      expect(error).toBeInstanceOf(GatewayTimeoutError);
    });

    it('maps unknown codes to DatabaseError', () => {
      const error = mapPostgresError({ code: '99999', message: 'unknown' });
      expect(error).toBeInstanceOf(DatabaseError);
      expect((error as DatabaseError).dbCode).toBe('99999');
    });
  });

  // ============================================================================
  // Supabase Error Mapping
  // ============================================================================

  describe('mapSupabaseError', () => {
    it('maps PGRST116 (no rows) to NotFoundError', () => {
      const error = mapSupabaseError({ code: 'PGRST116', message: 'no rows' });
      expect(error).toBeInstanceOf(NotFoundError);
    });

    it('maps PGRST301 (JWT expired) to UnauthorizedError', () => {
      const error = mapSupabaseError({ code: 'PGRST301', message: 'JWT expired' });
      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('maps PGRST302 (JWT invalid) to UnauthorizedError', () => {
      const error = mapSupabaseError({ code: 'PGRST302', message: 'JWT invalid' });
      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('maps PGRST000 (connection) to ServiceUnavailableError', () => {
      const error = mapSupabaseError({ code: 'PGRST000', message: 'connection' });
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    });

    it('falls back to PostgreSQL mapping for other codes', () => {
      const error = mapSupabaseError({ code: '23505', message: 'duplicate' });
      expect(error).toBeInstanceOf(ConflictError);
    });
  });

  // ============================================================================
  // HTTP Client Error Mapping
  // ============================================================================

  describe('mapHttpClientError', () => {
    it('maps ECONNREFUSED to ServiceUnavailableError', () => {
      const error = mapHttpClientError({ code: 'ECONNREFUSED' }, 'API');
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.message).toContain('API');
    });

    it('maps ENOTFOUND to ServiceUnavailableError', () => {
      const error = mapHttpClientError({ code: 'ENOTFOUND' }, 'DNS');
      expect(error).toBeInstanceOf(ServiceUnavailableError);
    });

    it('maps ETIMEDOUT to GatewayTimeoutError', () => {
      const error = mapHttpClientError({ code: 'ETIMEDOUT' }, 'Slow API');
      expect(error).toBeInstanceOf(GatewayTimeoutError);
    });

    it('maps ECONNABORTED to GatewayTimeoutError', () => {
      const error = mapHttpClientError({ code: 'ECONNABORTED' });
      expect(error).toBeInstanceOf(GatewayTimeoutError);
    });

    it('maps HTTP response errors by status', () => {
      const error = mapHttpClientError({
        response: { status: 404, data: { message: 'Not found' } },
      });
      expect(error).toBeInstanceOf(NotFoundError);
    });

    it('extracts message from response data', () => {
      const error = mapHttpClientError({
        response: { status: 400, data: { error: 'Invalid input' } },
      });
      expect(error.message).toBe('Invalid input');
    });

    it('maps unknown errors to ExternalServiceError', () => {
      const error = mapHttpClientError({ message: 'Unknown failure' }, 'Service');
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.message).toContain('Unknown failure');
    });
  });

  // ============================================================================
  // Error Code Utilities
  // ============================================================================

  describe('isClientError', () => {
    it('returns true for 4xx error codes', () => {
      expect(isClientError(ErrorCode.VALIDATION_ERROR)).toBe(true);
      expect(isClientError(ErrorCode.UNAUTHORIZED)).toBe(true);
      expect(isClientError(ErrorCode.FORBIDDEN)).toBe(true);
      expect(isClientError(ErrorCode.NOT_FOUND)).toBe(true);
      expect(isClientError(ErrorCode.CONFLICT)).toBe(true);
      expect(isClientError(ErrorCode.RATE_LIMITED)).toBe(true);
    });

    it('returns false for 5xx error codes', () => {
      expect(isClientError(ErrorCode.INTERNAL_ERROR)).toBe(false);
      expect(isClientError(ErrorCode.SERVICE_UNAVAILABLE)).toBe(false);
      expect(isClientError(ErrorCode.DATABASE_ERROR)).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('returns true for 5xx error codes', () => {
      expect(isServerError(ErrorCode.INTERNAL_ERROR)).toBe(true);
      expect(isServerError(ErrorCode.SERVICE_UNAVAILABLE)).toBe(true);
      expect(isServerError(ErrorCode.GATEWAY_TIMEOUT)).toBe(true);
      expect(isServerError(ErrorCode.DATABASE_ERROR)).toBe(true);
    });

    it('returns false for 4xx error codes', () => {
      expect(isServerError(ErrorCode.VALIDATION_ERROR)).toBe(false);
      expect(isServerError(ErrorCode.NOT_FOUND)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('returns true for retryable errors', () => {
      expect(isRetryableError(new ServiceUnavailableError('DB'))).toBe(true);
      expect(isRetryableError(new GatewayTimeoutError('API'))).toBe(true);
      expect(isRetryableError(new DatabaseError('timeout'))).toBe(true);
      expect(isRetryableError(new RateLimitError())).toBe(true);
    });

    it('returns false for non-retryable errors', () => {
      expect(isRetryableError(new ValidationError('bad input'))).toBe(false);
      expect(isRetryableError(new NotFoundError('Resource'))).toBe(false);
      expect(isRetryableError(new UnauthorizedError())).toBe(false);
      expect(isRetryableError(new InternalError())).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('uses Retry-After for rate limit errors', () => {
      const error = new RateLimitError('Too many', 30);
      const delay = getRetryDelay(error, 0);
      expect(delay).toBe(30000); // 30 seconds in ms
    });

    it('uses exponential backoff for other errors', () => {
      const error = new ServiceUnavailableError('DB');

      const delay0 = getRetryDelay(error, 0);
      const delay1 = getRetryDelay(error, 1);
      const delay2 = getRetryDelay(error, 2);

      // Base delay is 1000ms, with jitter
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThan(1500);

      // Second attempt should be roughly 2x
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThan(3000);

      // Third attempt should be roughly 4x
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThan(6000);
    });

    it('caps delay at 30 seconds', () => {
      const error = new ServiceUnavailableError('DB');
      const delay = getRetryDelay(error, 10); // 2^10 = 1024 seconds would exceed cap

      expect(delay).toBeLessThanOrEqual(39000); // 30s + 30% jitter
    });
  });
});

/**
 * Error Classes Tests
 *
 * Tests for AppError hierarchy and utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  DatabaseError,
  ErrorCode,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  getHttpStatus,
  getSafeErrorMessage,
  InternalError,
  isAppError,
  isOperationalError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnprocessableEntityError,
  ValidationError,
  wrapError,
} from '../errors';

describe('Error Classes', () => {
  // ============================================================================
  // AppError Base Class
  // ============================================================================

  describe('AppError', () => {
    it('creates error with all properties', () => {
      const cause = new Error('Original error');
      const error = new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Test error',
        status: 400,
        isOperational: true,
        cause,
        details: { field: 'name' },
      });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.cause).toBe(cause);
      expect(error.details).toEqual({ field: 'name' });
      expect(error.timestamp).toBeDefined();
      expect(error.stack).toBeDefined();
    });

    it('derives status from code when not provided', () => {
      const error = new AppError({
        code: ErrorCode.NOT_FOUND,
        message: 'Not found',
      });

      expect(error.status).toBe(404);
    });

    it('defaults isOperational to true', () => {
      const error = new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Test',
      });

      expect(error.isOperational).toBe(true);
    });

    it('toLogObject includes all details', () => {
      const cause = new Error('Cause');
      const error = new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Test',
        cause,
        details: { key: 'value' },
      });

      const logObj = error.toLogObject();

      expect(logObj.name).toBe('AppError');
      expect(logObj.code).toBe('INTERNAL_ERROR');
      expect(logObj.message).toBe('Test');
      expect(logObj.details).toEqual({ key: 'value' });
      expect(logObj.cause).toBeDefined();
      expect((logObj.cause as { message: string }).message).toBe('Cause');
    });
  });

  // ============================================================================
  // Client Error Classes (4xx)
  // ============================================================================

  describe('ValidationError', () => {
    it('creates with field errors', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'email', message: 'Invalid format' },
        { field: 'age', message: 'Must be positive' },
      ]);

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.status).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.errors).toHaveLength(2);
      expect(error.details?.errors).toEqual(error.errors);
    });

    it('creates from Zod error', () => {
      const zodError = {
        errors: [
          { path: ['user', 'email'], message: 'Invalid email' },
          { path: ['user', 'name'], message: 'Required' },
        ],
      };

      const error = ValidationError.fromZodError(zodError);

      expect(error.errors).toEqual([
        { field: 'user.email', message: 'Invalid email' },
        { field: 'user.name', message: 'Required' },
      ]);
    });
  });

  describe('UnauthorizedError', () => {
    it('creates with default message', () => {
      const error = new UnauthorizedError();

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.status).toBe(401);
      expect(error.message).toBe('Authentication required');
      expect(error.isOperational).toBe(true);
    });

    it('creates with custom message', () => {
      const error = new UnauthorizedError('Token expired');

      expect(error.message).toBe('Token expired');
    });
  });

  describe('ForbiddenError', () => {
    it('creates with default message', () => {
      const error = new ForbiddenError();

      expect(error.code).toBe('FORBIDDEN');
      expect(error.status).toBe(403);
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('NotFoundError', () => {
    it('creates with resource and id', () => {
      const error = new NotFoundError('User', '123');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.status).toBe(404);
      expect(error.message).toBe('User not found: 123');
      expect(error.details).toEqual({ resource: 'User', id: '123' });
    });

    it('creates with resource only', () => {
      const error = new NotFoundError('Configuration');

      expect(error.message).toBe('Configuration not found');
    });
  });

  describe('ConflictError', () => {
    it('creates with message', () => {
      const error = new ConflictError('Email already exists');

      expect(error.code).toBe('CONFLICT');
      expect(error.status).toBe(409);
      expect(error.message).toBe('Email already exists');
    });
  });

  describe('RateLimitError', () => {
    it('creates with retry after', () => {
      const error = new RateLimitError('Too many requests', 60);

      expect(error.code).toBe('RATE_LIMITED');
      expect(error.status).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.details?.retryAfter).toBe(60);
    });

    it('creates without retry after', () => {
      const error = new RateLimitError();

      expect(error.retryAfter).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  describe('PayloadTooLargeError', () => {
    it('creates with max size', () => {
      const error = new PayloadTooLargeError('File too large', 10485760);

      expect(error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(error.status).toBe(413);
      expect(error.details?.maxSize).toBe(10485760);
    });
  });

  describe('UnprocessableEntityError', () => {
    it('creates with message', () => {
      const error = new UnprocessableEntityError('Cannot process request');

      expect(error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(error.status).toBe(422);
    });
  });

  // ============================================================================
  // Server Error Classes (5xx)
  // ============================================================================

  describe('InternalError', () => {
    it('creates with default message', () => {
      const error = new InternalError();

      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.status).toBe(500);
      expect(error.message).toBe('An unexpected error occurred');
      expect(error.isOperational).toBe(false);
    });

    it('creates with cause', () => {
      const cause = new Error('Original');
      const error = new InternalError('Failed', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('DatabaseError', () => {
    it('creates with db code', () => {
      const error = new DatabaseError('Connection failed', undefined, '08006');

      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.status).toBe(503);
      expect(error.dbCode).toBe('08006');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('creates with service name', () => {
      const error = new ServiceUnavailableError('Redis');

      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.status).toBe(503);
      expect(error.message).toBe('Redis is temporarily unavailable');
      expect(error.details?.service).toBe('Redis');
      expect(error.isOperational).toBe(true);
    });
  });

  describe('GatewayTimeoutError', () => {
    it('creates with service name', () => {
      const error = new GatewayTimeoutError('Payment API');

      expect(error.code).toBe('GATEWAY_TIMEOUT');
      expect(error.status).toBe(504);
      expect(error.message).toBe('Payment API request timed out');
    });
  });

  describe('ExternalServiceError', () => {
    it('creates with service and message', () => {
      const error = new ExternalServiceError('Stripe', 'Invalid API key');

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.status).toBe(502);
      expect(error.message).toBe('Stripe: Invalid API key');
    });
  });

  // ============================================================================
  // HTTP Status Mapping
  // ============================================================================

  describe('getHttpStatus', () => {
    it('maps all error codes to correct status', () => {
      expect(getHttpStatus(ErrorCode.VALIDATION_ERROR)).toBe(400);
      expect(getHttpStatus(ErrorCode.UNAUTHORIZED)).toBe(401);
      expect(getHttpStatus(ErrorCode.FORBIDDEN)).toBe(403);
      expect(getHttpStatus(ErrorCode.NOT_FOUND)).toBe(404);
      expect(getHttpStatus(ErrorCode.CONFLICT)).toBe(409);
      expect(getHttpStatus(ErrorCode.RATE_LIMITED)).toBe(429);
      expect(getHttpStatus(ErrorCode.PAYLOAD_TOO_LARGE)).toBe(413);
      expect(getHttpStatus(ErrorCode.UNPROCESSABLE_ENTITY)).toBe(422);
      expect(getHttpStatus(ErrorCode.INTERNAL_ERROR)).toBe(500);
      expect(getHttpStatus(ErrorCode.SERVICE_UNAVAILABLE)).toBe(503);
      expect(getHttpStatus(ErrorCode.GATEWAY_TIMEOUT)).toBe(504);
      expect(getHttpStatus(ErrorCode.DATABASE_ERROR)).toBe(503);
      expect(getHttpStatus(ErrorCode.EXTERNAL_SERVICE_ERROR)).toBe(502);
    });
  });

  // ============================================================================
  // Type Guards
  // ============================================================================

  describe('isAppError', () => {
    it('returns true for AppError instances', () => {
      expect(isAppError(new ValidationError('test'))).toBe(true);
      expect(isAppError(new InternalError())).toBe(true);
      expect(isAppError(new NotFoundError('Resource'))).toBe(true);
    });

    it('returns false for non-AppError', () => {
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({ code: 'ERROR' })).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('returns true for operational errors', () => {
      expect(isOperationalError(new ValidationError('test'))).toBe(true);
      expect(isOperationalError(new NotFoundError('Resource'))).toBe(true);
      expect(isOperationalError(new ServiceUnavailableError('DB'))).toBe(true);
    });

    it('returns false for non-operational errors', () => {
      expect(isOperationalError(new InternalError())).toBe(false);
      expect(isOperationalError(new DatabaseError('fail'))).toBe(false);
    });

    it('returns false for non-AppError', () => {
      expect(isOperationalError(new Error('test'))).toBe(false);
      expect(isOperationalError(null)).toBe(false);
    });
  });

  // ============================================================================
  // Utilities
  // ============================================================================

  describe('wrapError', () => {
    it('returns AppError unchanged', () => {
      const original = new ValidationError('test');
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
    });

    it('wraps Error as InternalError', () => {
      const original = new Error('Something failed');
      const wrapped = wrapError(original);

      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.cause).toBe(original);
    });

    it('wraps string as InternalError', () => {
      const wrapped = wrapError('string error');

      expect(wrapped).toBeInstanceOf(InternalError);
      expect(wrapped.message).toBe('string error');
    });
  });

  describe('getSafeErrorMessage', () => {
    it('returns message for operational errors', () => {
      const error = new ValidationError('Email is invalid');
      expect(getSafeErrorMessage(error)).toBe('Email is invalid');
    });

    it('returns generic message for non-operational errors', () => {
      const error = new InternalError('Database connection string leaked');
      expect(getSafeErrorMessage(error)).toBe('An unexpected error occurred');
    });

    it('returns generic message for DatabaseError', () => {
      const error = new DatabaseError('postgres://user:pass@host');
      expect(getSafeErrorMessage(error)).toBe('An unexpected error occurred');
    });
  });
});

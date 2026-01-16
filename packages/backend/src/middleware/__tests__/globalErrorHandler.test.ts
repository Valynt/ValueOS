/**
 * Global Error Handler Tests
 *
 * Tests for error mapping, masking, and middleware behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  requestIdMiddleware,
  accessLogMiddleware,
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  transformError,
  buildErrorEnvelope,
  TrackedRequest,
  ErrorEnvelope,
} from '../globalErrorHandler';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ServiceUnavailableError,
  InternalError,
  ErrorCode,
} from '../../lib/errors';
import { ZodError } from 'zod';

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Global Error Handler', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    vi.clearAllMocks();
  });

  // ============================================================================
  // Request ID Middleware Tests
  // ============================================================================

  describe('requestIdMiddleware', () => {
    it('generates a request ID when none provided', async () => {
      app.get('/test', (req, res) => {
        const trackedReq = req as TrackedRequest;
        res.json({ requestId: trackedReq.requestId });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.requestId).toMatch(/^req-[a-f0-9-]+$/);
      expect(response.headers['x-request-id']).toBe(response.body.requestId);
    });

    it('uses X-Request-ID header when provided', async () => {
      app.get('/test', (req, res) => {
        const trackedReq = req as TrackedRequest;
        res.json({ requestId: trackedReq.requestId });
      });

      const response = await request(app)
        .get('/test')
        .set('X-Request-ID', 'custom-request-123');

      expect(response.body.requestId).toBe('custom-request-123');
      expect(response.headers['x-request-id']).toBe('custom-request-123');
    });

    it('uses X-Correlation-ID header when provided', async () => {
      app.get('/test', (req, res) => {
        const trackedReq = req as TrackedRequest;
        res.json({ requestId: trackedReq.requestId });
      });

      const response = await request(app)
        .get('/test')
        .set('X-Correlation-ID', 'correlation-456');

      expect(response.body.requestId).toBe('correlation-456');
    });

    it('sets startTime on request', async () => {
      app.get('/test', (req, res) => {
        const trackedReq = req as TrackedRequest;
        res.json({ hasStartTime: typeof trackedReq.startTime === 'number' });
      });

      const response = await request(app).get('/test');

      expect(response.body.hasStartTime).toBe(true);
    });
  });

  // ============================================================================
  // Error Transformation Tests
  // ============================================================================

  describe('transformError', () => {
    it('passes through AppError instances unchanged', () => {
      const original = new ValidationError('Test error', []);
      const result = transformError(original);

      expect(result).toBe(original);
    });

    it('transforms ZodError to ValidationError', () => {
      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' },
        { code: 'too_small', minimum: 1, type: 'string', inclusive: true, path: ['email'], message: 'Required' },
      ]);

      const result = transformError(zodError);

      expect(result).toBeInstanceOf(ValidationError);
      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.details?.errors).toEqual([
        { field: 'name', message: 'Expected string' },
        { field: 'email', message: 'Required' },
      ]);
    });

    it('transforms standard Error to InternalError', () => {
      const error = new Error('Something went wrong');
      const result = transformError(error);

      expect(result).toBeInstanceOf(InternalError);
      expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.isOperational).toBe(false);
      expect(result.cause).toBe(error);
    });

    it('transforms string to InternalError', () => {
      const result = transformError('string error');

      expect(result).toBeInstanceOf(InternalError);
      expect(result.message).toBe('string error');
    });

    it('transforms null/undefined to InternalError', () => {
      const result = transformError(null);

      expect(result).toBeInstanceOf(InternalError);
    });
  });

  // ============================================================================
  // Error Envelope Tests
  // ============================================================================

  describe('buildErrorEnvelope', () => {
    it('builds envelope for operational error with details', () => {
      const error = new ValidationError('Invalid input', [
        { field: 'name', message: 'Required' },
      ]);
      const requestId = 'req-123';

      const envelope = buildErrorEnvelope(error, requestId);

      expect(envelope).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          requestId: 'req-123',
          details: { errors: [{ field: 'name', message: 'Required' }] },
        },
      });
    });

    it('masks message for non-operational errors', () => {
      const error = new InternalError('Database connection string: postgres://user:pass@host', new Error());
      const requestId = 'req-456';

      const envelope = buildErrorEnvelope(error, requestId);

      expect(envelope.error.message).toBe('An unexpected error occurred');
      expect(envelope.error.details).toBeUndefined();
    });

    it('excludes details for non-operational errors', () => {
      const error = new DatabaseError('Connection failed', new Error(), 'ECONNREFUSED');
      const requestId = 'req-789';

      const envelope = buildErrorEnvelope(error, requestId);

      expect(envelope.error.details).toBeUndefined();
    });
  });

  // ============================================================================
  // Global Error Handler Integration Tests
  // ============================================================================

  describe('globalErrorHandler integration', () => {
    beforeEach(() => {
      app.use(notFoundHandler);
      app.use(globalErrorHandler);
    });

    it('handles ValidationError with 400 status', async () => {
      app.post('/validate', (req, res, next) => {
        next(new ValidationError('Invalid data', [
          { field: 'email', message: 'Invalid email format' },
        ]));
      });

      const response = await request(app).post('/validate');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toHaveLength(1);
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('handles UnauthorizedError with 401 status', async () => {
      app.get('/protected', (req, res, next) => {
        next(new UnauthorizedError('Token expired'));
      });

      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Token expired');
    });

    it('handles ForbiddenError with 403 status', async () => {
      app.get('/admin', (req, res, next) => {
        next(new ForbiddenError('Admin access required'));
      });

      const response = await request(app).get('/admin');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('handles NotFoundError with 404 status', async () => {
      app.get('/users/:id', (req, res, next) => {
        next(new NotFoundError('User', req.params.id));
      });

      const response = await request(app).get('/users/123');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('User not found: 123');
    });

    it('handles ConflictError with 409 status', async () => {
      app.post('/users', (req, res, next) => {
        next(new ConflictError('Email already exists'));
      });

      const response = await request(app).post('/users');

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('handles RateLimitError with 429 status and Retry-After header', async () => {
      app.get('/api', (req, res, next) => {
        next(new RateLimitError('Too many requests', 60));
      });

      const response = await request(app).get('/api');

      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMITED');
      expect(response.headers['retry-after']).toBe('60');
    });

    it('handles ServiceUnavailableError with 503 status', async () => {
      app.get('/data', (req, res, next) => {
        next(new ServiceUnavailableError('Database'));
      });

      const response = await request(app).get('/data');

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('handles DatabaseError with 503 status and masks details', async () => {
      app.get('/query', (req, res, next) => {
        next(new DatabaseError(
          'Connection to postgres://admin:secret@db.internal:5432 failed',
          new Error('ECONNREFUSED'),
          'ECONNREFUSED'
        ));
      });

      const response = await request(app).get('/query');

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
      // Message should be masked (non-operational error)
      expect(response.body.error.message).toBe('An unexpected error occurred');
      // No details should leak
      expect(response.body.error.details).toBeUndefined();
    });

    it('handles unknown errors with 500 status and masks message', async () => {
      app.get('/crash', (req, res, next) => {
        next(new Error('TypeError: Cannot read property "x" of undefined'));
      });

      const response = await request(app).get('/crash');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('An unexpected error occurred');
    });

    it('handles thrown strings', async () => {
      app.get('/throw-string', (req, res, next) => {
        next('Something bad happened');
      });

      const response = await request(app).get('/throw-string');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('sets Cache-Control: no-store on error responses', async () => {
      app.get('/error', (req, res, next) => {
        next(new NotFoundError('Resource'));
      });

      const response = await request(app).get('/error');

      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('sets Content-Type: application/json', async () => {
      app.get('/error', (req, res, next) => {
        next(new ValidationError('Bad input'));
      });

      const response = await request(app).get('/error');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // ============================================================================
  // Not Found Handler Tests
  // ============================================================================

  describe('notFoundHandler', () => {
    beforeEach(() => {
      app.get('/exists', (req, res) => res.json({ ok: true }));
      app.use(notFoundHandler);
      app.use(globalErrorHandler);
    });

    it('returns 404 for unmatched routes', async () => {
      const response = await request(app).get('/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('GET /does-not-exist');
    });

    it('does not affect matched routes', async () => {
      const response = await request(app).get('/exists');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  // ============================================================================
  // Async Handler Tests
  // ============================================================================

  describe('asyncHandler', () => {
    beforeEach(() => {
      app.use(globalErrorHandler);
    });

    it('catches rejected promises and forwards to error handler', async () => {
      app.get('/async-error', asyncHandler(async (req, res) => {
        throw new ValidationError('Async validation failed');
      }));

      const response = await request(app).get('/async-error');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('allows successful async handlers to complete', async () => {
      app.get('/async-success', asyncHandler(async (req, res) => {
        await Promise.resolve();
        res.json({ success: true });
      }));

      const response = await request(app).get('/async-success');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('catches async errors from database operations', async () => {
      app.get('/async-db', asyncHandler(async (req, res) => {
        await Promise.reject(new DatabaseError('Query timeout', new Error()));
      }));

      const response = await request(app).get('/async-db');

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
    });
  });

  // ============================================================================
  // Error Masking Security Tests
  // ============================================================================

  describe('error masking security', () => {
    beforeEach(() => {
      app.use(globalErrorHandler);
    });

    it('does not leak stack traces in responses', async () => {
      app.get('/stack', (req, res, next) => {
        const error = new Error('Internal failure');
        next(error);
      });

      const response = await request(app).get('/stack');

      expect(response.body.error.stack).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('at ');
    });

    it('does not leak database connection strings', async () => {
      app.get('/db-leak', (req, res, next) => {
        next(new DatabaseError(
          'Failed to connect to postgres://user:password123@internal-db.cluster.local:5432/production',
          new Error()
        ));
      });

      const response = await request(app).get('/db-leak');

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('password123');
      expect(responseText).not.toContain('internal-db.cluster.local');
      expect(responseText).not.toContain('postgres://');
    });

    it('does not leak API keys in error messages', async () => {
      app.get('/api-leak', (req, res, next) => {
        next(new Error('API call failed with key: sk_live_abc123xyz'));
      });

      const response = await request(app).get('/api-leak');

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('sk_live_abc123xyz');
    });

    it('does not leak internal paths', async () => {
      app.get('/path-leak', (req, res, next) => {
        const error = new Error('File not found: /var/app/secrets/config.json');
        next(error);
      });

      const response = await request(app).get('/path-leak');

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('/var/app/secrets');
    });

    it('preserves operational error messages', async () => {
      app.get('/operational', (req, res, next) => {
        next(new ValidationError('Email format is invalid'));
      });

      const response = await request(app).get('/operational');

      expect(response.body.error.message).toBe('Email format is invalid');
    });
  });
});

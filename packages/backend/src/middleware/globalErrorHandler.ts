/**
 * Global Error Handling Middleware
 *
 * Guarantees no request crashes the server by:
 * - Converting all errors to standardized error envelope
 * - Mapping known error classes to HTTP status codes
 * - Masking internal errors (500) with generic messages
 * - Capturing async errors (no unhandled promise rejections)
 * - Generating and propagating request IDs
 * - Logging latency timing and access logs
 */

import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';

import { getTraceContextForLogging, recordSpanException } from '../config/telemetry.js'
import {
  AppError,
  getSafeErrorMessage,
  InternalError,
  isAppError,
  RateLimitError,
  ValidationError,
} from '../lib/errors';
import { logger } from '../lib/logger.js'
import { redactSensitiveData } from '../lib/redaction.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Standardized error response envelope
 */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

/**
 * Extended request with timing and request ID
 */
export interface TrackedRequest extends Request {
  requestId: string;
  startTime: number;
  hasLoggedError?: boolean;
}

// ============================================================================
// Request ID Middleware
// ============================================================================

/**
 * Generate or propagate request ID and start timing.
 * Must be applied early in the middleware chain.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const trackedReq = req as TrackedRequest;

  // Use existing correlation ID or generate new one
  const upstreamId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string);
  trackedReq.requestId = upstreamId || `req-${uuidv4()}`;

  // Start timing
  trackedReq.startTime = Date.now();

  // Propagate request ID in response headers
  res.setHeader('X-Request-ID', trackedReq.requestId);

  next();
}

// ============================================================================
// Access Logging Middleware
// ============================================================================

/**
 * Log completed requests with timing information.
 * Should be applied after requestIdMiddleware.
 */
export function accessLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const trackedReq = req as TrackedRequest;
  const startLogContext = {
    requestId: trackedReq.requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent']?.substring(0, 200),
    trace: getTraceContextForLogging(),
  };

  logger.info('Request started', redactSensitiveData(startLogContext));

  // Log on response finish
  res.on('finish', () => {
    const latencyMs = Date.now() - (trackedReq.startTime || Date.now());
    const logData = {
      requestId: trackedReq.requestId,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      status: res.statusCode,
      latencyMs,
      contentLength: res.get('Content-Length'),
      userAgent: req.headers['user-agent']?.substring(0, 200),
      ip: req.ip || req.socket.remoteAddress,
      userId: (req as unknown as { user?: { id: string } }).user?.id,
      tenantId: (req as unknown as { tenantId?: string }).tenantId,
      trace: getTraceContextForLogging(),
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', redactSensitiveData(logData));
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', redactSensitiveData(logData));
    } else {
      logger.info('Request completed', redactSensitiveData(logData));
    }
  });

  next();
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

/**
 * Wrap async route handlers to catch rejected promises.
 * Prevents unhandled promise rejections from crashing the server.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
): (req: T, res: Response, next: NextFunction) => void {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================================================
// Error Transformation
// ============================================================================

/**
 * Transform any error into an AppError.
 * Handles Zod validation errors, native errors, and unknown values.
 */
function transformError(error: unknown): AppError {
  // Already an AppError
  if (isAppError(error)) {
    return error;
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return ValidationError.fromZodError(error);
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for specific error types by name/message
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return new (require('../lib/errors').UnauthorizedError)(
        'Invalid or expired token',
        error
      );
    }

    if (error.name === 'PayloadTooLargeError' || error.message.includes('request entity too large')) {
      return new (require('../lib/errors').PayloadTooLargeError)(
        'Request payload too large',
        undefined,
        error
      );
    }

    // Wrap as internal error
    return new InternalError('An unexpected error occurred', error);
  }

  // Unknown error type
  return new InternalError(String(error));
}

/**
 * Build the error response envelope.
 * Masks internal error details for non-operational errors.
 */
function buildErrorEnvelope(error: AppError, requestId: string): ErrorEnvelope {
  const safeMessage = getSafeErrorMessage(error);

  const envelope: ErrorEnvelope = {
    error: {
      code: error.code,
      message: safeMessage,
      requestId,
    },
  };

  // Include details only for operational errors
  if (error.isOperational && error.details) {
    envelope.error.details = error.details;
  }

  return envelope;
}

// ============================================================================
// Global Error Handler
// ============================================================================

/**
 * Global error handling middleware.
 * Must be the LAST middleware in the chain.
 *
 * Features:
 * - Converts all errors to standardized envelope
 * - Maps error codes to HTTP status
 * - Masks internal errors
 * - Logs errors with context
 * - Sets appropriate headers
 */
export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const trackedReq = req as TrackedRequest;
  const requestId = trackedReq.requestId || `req-${uuidv4()}`;
  const latencyMs = trackedReq.startTime
    ? Date.now() - trackedReq.startTime
    : undefined;
  const hasLoggedError = trackedReq.hasLoggedError === true;
  trackedReq.hasLoggedError = true;

  // Transform to AppError
  const appError = transformError(err);
  const errorInstance = appError.cause instanceof Error
    ? appError.cause
    : appError instanceof Error
      ? appError
      : undefined;

  if (errorInstance) {
    recordSpanException(errorInstance);
  }

  // Log the error
  const logContext = {
    requestId,
    method: req.method,
    path: req.path,
    status: appError.status,
    code: appError.code,
    isOperational: appError.isOperational,
    latencyMs,
    userId: (req as unknown as { user?: { id: string } }).user?.id,
    tenantId: (req as unknown as { tenantId?: string }).tenantId,
    trace: getTraceContextForLogging(),
  };

  if (!hasLoggedError) {
    if (appError.isOperational) {
      logger.warn('Operational error', redactSensitiveData({
        ...logContext,
        message: appError.message,
        details: appError.details,
      }));
    } else {
      // Log full error details for non-operational errors
      logger.error('Unexpected error', redactSensitiveData({
        ...logContext,
        error: appError.toLogObject(),
      }));
    }
  }

  // Build response
  const envelope = buildErrorEnvelope(appError, requestId);

  // Set headers
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('Content-Type', 'application/json');

  // Set Retry-After for rate limit errors
  if (appError instanceof RateLimitError && appError.retryAfter) {
    res.setHeader('Retry-After', appError.retryAfter.toString());
  }

  // Prevent caching of error responses
  res.setHeader('Cache-Control', 'no-store');

  // Send response
  res.status(appError.status).json(envelope);
};

// ============================================================================
// Not Found Handler
// ============================================================================

/**
 * Handle 404 for unmatched routes.
 * Should be applied after all route handlers, before globalErrorHandler.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { NotFoundError } = require('../lib/errors');
  next(new NotFoundError('Route', `${req.method} ${req.path}`));
}

// ============================================================================
// Unhandled Rejection Handler
// ============================================================================

/**
 * Setup global handlers for unhandled rejections and uncaught exceptions.
 * Call this once during app bootstrap.
 */
export function setupGlobalErrorHandlers(): void {
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise),
    });

    // In production, you might want to gracefully shutdown
    // For now, we log and continue
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });

    // Uncaught exceptions leave the process in an undefined state
    // Best practice is to exit and let the process manager restart
    process.exit(1);
  });

  logger.info('Global error handlers initialized');
}

// ============================================================================
// Express App Setup Helper
// ============================================================================

/**
 * Apply all error handling middleware to an Express app.
 *
 * Usage:
 *   const app = express();
 *   // ... add routes ...
 *   applyErrorHandling(app);
 */
export function applyErrorHandling(app: {
  use: (handler: unknown) => void;
}): void {
  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(globalErrorHandler);
}

// ============================================================================
// Exports
// ============================================================================

export {
  transformError,
  buildErrorEnvelope,
};

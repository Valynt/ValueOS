import { NextFunction, Request, Response } from 'express';

import { logger } from '../../lib/logger.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

import { ConflictError, DatabaseError, NotFoundError } from './repository';
import { ApiErrorResponse } from './types';

export function handleError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const authReq = req as AuthenticatedRequest;
  const requestId = authReq.correlationId;

  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({
      error: 'CONFLICT',
      message: err.message,
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  if (err instanceof DatabaseError) {
    logger.error('Database error', {
      requestId,
      error: err.message,
      code: err.code,
    });

    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database temporarily unavailable. Please retry.',
      requestId,
    } satisfies ApiErrorResponse);
    return;
  }

  logger.error('Unexpected error in value cases API', {
    requestId,
    error: err instanceof Error ? err.message : 'Unknown error',
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    requestId,
  } satisfies ApiErrorResponse);
}

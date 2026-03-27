import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z, ZodError } from 'zod';

import { logger } from '../../lib/logger.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

import { ApiErrorResponse } from './types';

export function correlationId(req: Request, _res: Response, next: NextFunction): void {
  (req as AuthenticatedRequest).correlationId =
    (req.headers['x-correlation-id'] as string) || `req-${uuidv4()}`;
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authReq = req as AuthenticatedRequest;

  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    logger.info('API request completed', {
      requestId: authReq.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs,
      tenantId: authReq.tenantId,
      userId: authReq.user?.id,
      userAgent: req.headers['user-agent']?.substring(0, 100),
    });
  });

  next();
}

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: { errors },
          requestId: (req as AuthenticatedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(err);
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as unknown as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: { errors },
          requestId: (req as AuthenticatedRequest).correlationId,
        } satisfies ApiErrorResponse);
        return;
      }
      next(err);
    }
  };
}

export function validateUuidParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!value || !uuidRegex.test(value)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid ${paramName}: must be a valid UUID`,
        requestId: (req as AuthenticatedRequest).correlationId,
      } satisfies ApiErrorResponse);
      return;
    }
    next();
  };
}

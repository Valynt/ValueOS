import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError, ErrorType } from '../utils/errorHandling';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req as any).requestId || res.locals.requestId;

  // Log the error
  logger.error('Request error', err, {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  // Default to 500
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorType = ErrorType.UNKNOWN;

  if (err instanceof AppError) {
    statusCode = getStatusCode(err.type);
    message = err.userMessage;
    errorType = err.type;
  } else if ((err as any).statusCode) {
      statusCode = (err as any).statusCode;
      message = err.message;
  } else if ((err as any).status) {
      statusCode = (err as any).status;
      message = err.message;
  }

  // Safety check
  if (statusCode < 100 || statusCode > 599) statusCode = 500;

  // In production, hide generic error messages for 500s
  if (process.env.NODE_ENV === 'production' && statusCode === 500 && !(err instanceof AppError)) {
    message = 'Internal Server Error';
  }

  // If headers are already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    error: errorType,
    message,
    requestId,
  });
}

function getStatusCode(type: ErrorType): number {
  switch (type) {
    case ErrorType.VALIDATION: return 400;
    case ErrorType.AUTH: return 401;
    case ErrorType.RATE_LIMIT: return 429;
    case ErrorType.FILE_UPLOAD: return 400;
    case ErrorType.PARSE: return 400;
    case ErrorType.NETWORK: return 503;
    case ErrorType.AI_GENERATION: return 502;
    case ErrorType.DATABASE: return 500;
    case ErrorType.UNKNOWN: return 500;
    default: return 500;
  }
}

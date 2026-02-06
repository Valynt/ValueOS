import { NextFunction, Request, Response } from 'express';
import { SanitizeOptions, sanitizeObject, sanitizeString } from '../security/InputSanitizer';

interface RequestSanitizationConfig {
  body?: Record<string, SanitizeOptions>;
  query?: Record<string, SanitizeOptions>;
  params?: Record<string, SanitizeOptions>;
}

function applyFieldOptions<T extends Record<string, any>>(
  source: T,
  fieldOptions: Record<string, SanitizeOptions> = {}
): T {
  const sanitized = { ...source } as Record<string, any>;

  for (const [field, options] of Object.entries(fieldOptions)) {
    const value = source[field];
    if (typeof value === 'string') {
      sanitized[field] = sanitizeString(value, options).sanitized;
    }
  }

  return sanitized as T;
}

export function requestSanitizationMiddleware(
  config: RequestSanitizationConfig = {}
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
      req.body = applyFieldOptions(req.body, config.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
      req.query = applyFieldOptions(req.query as Record<string, any>, config.query);
    }

    if (req.params && typeof req.params === 'object') {
      req.params = applyFieldOptions(req.params, config.params);
    }

    next();
  };
}

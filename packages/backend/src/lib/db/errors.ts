/**
 * Database boundary error taxonomy.
 */

export type ErrorDetails = Record<string, unknown>;

export class DbError extends Error {
  readonly statusCode: number;
  readonly details?: ErrorDetails;

  constructor(message: string, statusCode: number, details?: ErrorDetails) {
    super(message);
    this.name = 'DbError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DbValidationError extends DbError {
  constructor(message = 'Validation failed', details?: ErrorDetails) {
    super(message, 400, details);
    this.name = 'DbValidationError';
  }
}

export class DbNotFoundError extends DbError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` not found: ${id}` : ' not found'}`, 404);
    this.name = 'DbNotFoundError';
  }
}

export class DbConflictError extends DbError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 409, details);
    this.name = 'DbConflictError';
  }
}

export class DbUnauthorizedError extends DbError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'DbUnauthorizedError';
  }
}

export class DbForbiddenError extends DbError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'DbForbiddenError';
  }
}

export class TransientDbError extends DbError {
  readonly retryAfterMs: number;
  readonly retryHint: string;

  constructor(message = 'Transient database error', details?: ErrorDetails) {
    super(message, 503, details);
    this.name = 'TransientDbError';
    this.retryAfterMs = 2000;
    this.retryHint = 'Retry with exponential backoff.';
  }
}

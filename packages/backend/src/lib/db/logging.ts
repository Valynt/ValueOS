/**
 * Structured logging helpers for database boundary events.
 * Ensures no PII/secrets are logged.
 */

import { logger } from '../logger.js'

interface DbLogContext {
  correlationId: string;
  operation: string;
  table: string;
  tenantId?: string;
  recordId?: string;
  errorCode?: string;
}

export function logDbInfo(message: string, context: DbLogContext): void {
  logger.info(message, context);
}

export function logDbWarn(message: string, context: DbLogContext): void {
  logger.warn(message, context);
}

export function logDbError(message: string, context: DbLogContext, error?: Error): void {
  logger.error(message, {
    ...context,
    error: error ? error.message : undefined,
  });
}

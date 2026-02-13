import { logger } from "./logger.js";
/**
 * Sentry Integration
 * 
 * Error tracking and performance monitoring with Sentry
 */

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sample_rate?: number;
}

export function initSentry(config: SentryConfig): void {
  // Placeholder - actual Sentry SDK integration would go here
  logger.info('Sentry initialized', { environment: config.environment });
}

export function captureException(error: Error, context?: Record<string, any>): void {
  console.error('Sentry exception', { error, context });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  logger.info(`Sentry ${level}`, message);
}

export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: string;
  data?: Record<string, any>;
}): void {
  logger.info('Sentry breadcrumb', breadcrumb);
}

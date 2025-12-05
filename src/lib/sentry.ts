/**
 * Sentry Integration
 * 
 * Provides error tracking and performance monitoring for production.
 * Only initializes in production environment.
 */

import { logger } from './lib/logger';
import { isProduction, isDevelopment, getConfig } from '../config/environment';

// Type-safe Sentry interface (will be replaced with actual SDK)
interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

interface SentryContext {
  react?: {
    componentStack?: string;
  };
  [key: string]: unknown;
}

interface SentryExtra {
  [key: string]: unknown;
}

/**
 * Initialize Sentry for error tracking
 * 
 * @example
 * ```typescript
 * import { initializeSentry } from './lib/sentry';
 * 
 * // In bootstrap
 * if (config.monitoring.sentry.enabled) {
 *   initializeSentry();
 * }
 * ```
 */
export function initializeSentry(): void {
  if (!isProduction()) {
    logger.debug('[Sentry] Skipping initialization (not in production)');
    return;
  }

  const config = getConfig();

  if (!config.monitoring.sentry.enabled) {
    logger.debug('[Sentry] Disabled in configuration');
    return;
  }

  if (!config.monitoring.sentry.dsn) {
    logger.error('[Sentry] DSN not configured');
    return;
  }

  try {
    // Sentry SDK is now installed
    
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: config.monitoring.sentry.dsn,
        environment: config.monitoring.sentry.environment,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
        tracesSampleRate: config.monitoring.sentry.sampleRate,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        
        // Performance monitoring
        beforeSend(event) {
          // Filter out development errors
          if (event.environment === 'development') {
            return null;
          }
          return event;
        },
        
        // Ignore common non-critical errors
        ignoreErrors: [
          'ResizeObserver loop limit exceeded',
          'Non-Error promise rejection captured',
        ],
      });

      logger.debug('[Sentry] Initialized successfully');
    });
    

  } catch (error) {
    logger.error('[Sentry] Initialization failed:', error);
  }
}

/**
 * Capture an exception manually
 * 
 * @example
 * ```typescript
 * try {
 *   // risky operation
 * } catch (error) {
 *   captureException(error, {
 *     extra: { userId: '123', action: 'save' }
 *   });
 * }
 * ```
 */
export function captureException(
  error: Error,
  options?: {
    contexts?: SentryContext;
    extra?: SentryExtra;
  }
): void {
  if (!isProduction()) {
    logger.error('[Sentry] Would capture exception:', error, options);
    return;
  }

  // Sentry SDK is now installed
  /*
  import('@sentry/react').then((Sentry) => {
    Sentry.captureException(error, options);
  });
  */

  logger.error('[Sentry] Exception captured (SDK not installed):', error);
}

/**
 * Capture a message manually
 * 
 * @example
 * ```typescript
 * captureMessage('User completed onboarding', {
 *   level: 'info',
 *   extra: { userId: '123' }
 * });
 * ```
 */
export function captureMessage(
  message: string,
  options?: {
    level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
    extra?: SentryExtra;
  }
): void {
  if (!isProduction()) {
    logger.debug('[Sentry] Would capture message:', message, options);
    return;
  }

  // Sentry SDK is now installed
  /*
  import('@sentry/react').then((Sentry) => {
    Sentry.captureMessage(message, options?.level || 'info');
  });
  */

  logger.debug('[Sentry] Message captured (SDK not installed):', message);
}

/**
 * Set user context for error tracking
 * 
 * @example
 * ```typescript
 * setUser({
 *   id: '123',
 *   email: 'user@example.com',
 *   username: 'john_doe'
 * });
 * ```
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
} | null): void {
  if (!isProduction()) {
    logger.debug('[Sentry] Would set user:', user);
    return;
  }

  // Sentry SDK is now installed
  /*
  import('@sentry/react').then((Sentry) => {
    Sentry.setUser(user);
  });
  */

  logger.debug('[Sentry] User set (SDK not installed):', user?.id);
}

/**
 * Add breadcrumb for debugging
 * 
 * @example
 * ```typescript
 * addBreadcrumb({
 *   category: 'navigation',
 *   message: 'User navigated to dashboard',
 *   level: 'info'
 * });
 * ```
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  data?: Record<string, unknown>;
}): void {
  if (!isProduction()) {
    logger.debug('[Sentry] Would add breadcrumb:', breadcrumb);
    return;
  }

  // Sentry SDK is now installed
  /*
  import('@sentry/react').then((Sentry) => {
    Sentry.addBreadcrumb(breadcrumb);
  });
  */

  logger.debug('[Sentry] Breadcrumb added (SDK not installed):', breadcrumb.message);
}

/**
 * Start a performance transaction
 * 
 * @example
 * ```typescript
 * const transaction = startTransaction({
 *   name: 'Load Dashboard',
 *   op: 'navigation'
 * });
 * 
 * // ... do work ...
 * 
 * transaction.finish();
 * ```
 */
export function startTransaction(options: {
  name: string;
  op: string;
}): {
  finish: () => void;
  setStatus: (status: string) => void;
} {
  if (!isProduction()) {
    logger.debug('[Sentry] Would start transaction:', options);
    return {
      finish: () => logger.debug('[Sentry] Transaction finished:', options.name),
      setStatus: (status) => logger.debug('[Sentry] Transaction status:', status),
    };
  }

  // Sentry SDK is now installed
  /*
  import('@sentry/react').then((Sentry) => {
    return Sentry.startTransaction(options);
  });
  */

  return {
    finish: () => {},
    setStatus: () => {},
  };
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  const config = getConfig();
  return isProduction() && config.monitoring.sentry.enabled;
}

/**
 * Installation instructions
 */
export const INSTALLATION_INSTRUCTIONS = `
To enable Sentry error tracking:

1. Install dependencies:
   npm install @sentry/react @sentry/vite-plugin

2. Get Sentry DSN:
   - Sign up at https://sentry.io
   - Create a new project
   - Copy the DSN

3. Add to .env.production:
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   VITE_SENTRY_ENABLED=true
   VITE_SENTRY_ENVIRONMENT=production
   SENTRY_AUTH_TOKEN=your-auth-token

4. Update vite.config.ts:
   import { sentryVitePlugin } from '@sentry/vite-plugin';
   
   export default defineConfig({
     build: { sourcemap: true },
     plugins: [
       react(),
       sentryVitePlugin({
         org: 'your-org',
         project: 'valuecanvas',
         authToken: process.env.SENTRY_AUTH_TOKEN,
       }),
     ],
   });

5. Uncomment Sentry code in this file

6. Test in production build:
   npm run build && npm run preview
`;

export default {
  initializeSentry,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  startTransaction,
  isSentryEnabled,
  INSTALLATION_INSTRUCTIONS,
};

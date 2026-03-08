// Migrated from apps/ValyntApp/src/services/SecurityLogger.ts
// and packages/backend/src/services/SecurityLogger.ts (identical).
// Canonical location: packages/core-services/src/SecurityLogger.ts

export interface SecurityEvent {
  category: 'authentication' | 'authorization' | 'session' | 'llm' | 'dependency' | 'formula';
  action: string;
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warn' | 'error';
}

// Minimal logger interface so callers can inject the project's structured
// logger (e.g. winston) without core-services depending on it directly.
export interface SecurityLoggerBackend {
  debug(message: string, meta?: Record<string, unknown>): void;
}

const noopLogger: SecurityLoggerBackend = { debug: () => {} };

class SecurityLogger {
  private buffer: SecurityEvent[] = [];
  private maxBuffer = 100;
  private logger: SecurityLoggerBackend;

  constructor(logger: SecurityLoggerBackend = noopLogger) {
    this.logger = logger;
  }

  log(event: SecurityEvent): void {
    const enriched: SecurityEvent = {
      severity: 'info',
      ...event,
    };

    this.buffer.push(enriched);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }

    if (process.env.NODE_ENV !== 'test') {
      this.logger.debug('[security-event]', {
        ...enriched,
        timestamp: new Date().toISOString(),
      });
    }
  }

  getRecentEvents(): SecurityEvent[] {
    return [...this.buffer];
  }
}

export const securityLogger = new SecurityLogger();

/**
 * Wire the project's structured logger into the module-level singleton.
 * Call once at application startup, e.g.:
 *   configureSecurityLogger(logger); // where logger is the winston instance
 */
export function configureSecurityLogger(logger: SecurityLoggerBackend): void {
  (securityLogger as unknown as { logger: SecurityLoggerBackend }).logger = logger;
}

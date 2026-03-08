// Migrated to @valueos/core-services in Sprint 6.
// This re-export exists for backward compatibility during the transition.
// Update imports to use '@valueos/core-services' directly.
export { securityLogger } from '@valueos/core-services';
export type { SecurityEvent } from '@valueos/core-services';
interface SecurityEvent {
  category: 'authentication' | 'authorization' | 'autonomy' | 'session' | 'llm' | 'dependency' | 'formula';
  action: string;
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'warn' | 'error';
}

class SecurityLogger {
  private buffer: SecurityEvent[] = [];
  private maxBuffer = 100;

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
      logger.debug('[security-event]', {
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

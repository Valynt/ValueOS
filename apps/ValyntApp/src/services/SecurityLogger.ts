interface SecurityEvent {
  category: 'authentication' | 'authorization' | 'session' | 'llm' | 'dependency' | 'formula';
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

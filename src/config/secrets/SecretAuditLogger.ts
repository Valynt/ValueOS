import { createHash } from 'crypto';
import { logger } from '../../lib/logger';

export type SecretAuditAction = 'READ' | 'WRITE' | 'ROTATE';

export interface SecretAuditEvent {
  tenantId: string;
  secretKey: string;
  action: SecretAuditAction;
  result: 'SUCCESS' | 'FAILURE';
  userId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  logAccess(event: SecretAuditEvent): Promise<void>;
  logRotation(event: SecretAuditEvent): Promise<void>;
  logDenied(event: SecretAuditEvent & { reason: string }): Promise<void>;
}

export class StructuredSecretAuditLogger implements AuditLogger {
  async logAccess(event: SecretAuditEvent): Promise<void> {
    const payload = this.buildPayload(event);
    logger.info('SECRET_ACCESS', payload);
  }

  async logRotation(event: SecretAuditEvent): Promise<void> {
    const payload = this.buildPayload(event);
    logger.info('SECRET_ROTATED', payload);
  }

  async logDenied(event: SecretAuditEvent & { reason: string }): Promise<void> {
    const payload = this.buildPayload({ ...event, result: 'FAILURE' });
    logger.warn('SECRET_ACCESS_DENIED', { ...payload, reason: event.reason });
  }

  private buildPayload(event: SecretAuditEvent): Record<string, unknown> {
    return {
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      result: event.result,
      secretKey: this.maskSecretKey(event.secretKey),
      secretFingerprint: this.secretFingerprint(event.secretKey),
      metadata: event.metadata,
      timestamp: new Date().toISOString()
    };
  }

  private maskSecretKey(secretKey: string): string {
    if (secretKey.length <= 8) {
      return `${secretKey.slice(0, 2)}***`;
    }
    return `${secretKey.slice(0, 4)}...${secretKey.slice(-4)}`;
  }

  private secretFingerprint(secretKey: string): string {
    return createHash('sha256').update(secretKey).digest('hex').slice(0, 8);
  }
}

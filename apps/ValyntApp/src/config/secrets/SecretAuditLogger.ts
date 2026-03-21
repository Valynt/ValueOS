import { createHash } from 'crypto';

import { apiClient } from '../../api/client/unified-api-client';
import { logger } from '../../lib/logger';

export type SecretAuditAction = 'READ' | 'WRITE' | 'ROTATE' | 'DELETE' | 'LIST';

export interface SecretAuditEvent {
  tenantId: string;
  secretKey: string;
  action: SecretAuditAction;
  result: 'SUCCESS' | 'FAILURE';
  userId?: string;
  error?: string;
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
    await this.logToDatabase(event);
  }

  async logRotation(event: SecretAuditEvent): Promise<void> {
    const payload = this.buildPayload(event);
    logger.info('SECRET_ROTATED', payload);
    await this.logToDatabase(event);
  }

  async logDenied(event: SecretAuditEvent & { reason: string }): Promise<void> {
    const payload = this.buildPayload({ ...event, result: 'FAILURE', error: event.reason });
    logger.warn('SECRET_ACCESS_DENIED', { ...payload, reason: event.reason });
    await this.logToDatabase({ ...event, result: 'FAILURE', error: event.reason });
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
      error: event.error,
      timestamp: new Date().toISOString()
    };
  }

  private async logToDatabase(event: SecretAuditEvent): Promise<void> {
    try {
      const response = await apiClient.post('v1/secrets/audit', {
        tenantId: event.tenantId,
        userId: event.userId,
        secretKey: event.secretKey,
        action: event.action,
        result: event.result,
        error: event.error || event.reason,
        metadata: event.metadata ?? {},
      });

      if (!response.success) {
        logger.error('Failed to write secret audit log via backend API', new Error(response.error?.message || 'Unknown secret audit API error'), {
          tenantId: event.tenantId,
          action: event.action
        });
      }
    } catch (err) {
      logger.error('Unexpected error writing secret audit log', err instanceof Error ? err : new Error(String(err)), {
        tenantId: event.tenantId,
        action: event.action
      });
    }
  }

  private maskSecretKey(secretKey: string): string {
    if (secretKey === 'ALL' || secretKey.length <= 8) {
      return secretKey; // Don't mask 'ALL' or short keys
    }
    return `${secretKey.slice(0, 4)}...${secretKey.slice(-4)}`;
  }

  private secretFingerprint(secretKey: string): string {
    return createHash('sha256').update(secretKey).digest('hex').slice(0, 8);
  }
}

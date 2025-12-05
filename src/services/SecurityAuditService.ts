import { logger } from '../lib/logger';
import { sanitizeForLogging } from '../lib/piiFilter';
import { BaseService } from './BaseService';

export interface RequestAuditEvent {
  requestId: string;
  userId?: string;
  actor?: string;
  action: string;
  resource: string;
  requestPath: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  eventType?: string;
  eventData?: Record<string, unknown>;
}

class SecurityAuditService extends BaseService {
  constructor() {
    super('SecurityAuditService');
  }

  async logRequestEvent(event: RequestAuditEvent): Promise<void> {
    const sanitizedDetails = event.eventData
      ? (sanitizeForLogging(event.eventData) as Record<string, unknown>)
      : {};

    const payload = {
      request_id: event.requestId,
      user_id: event.userId || null,
      actor: event.actor || 'anonymous',
      action: event.action,
      resource: event.resource,
      request_path: event.requestPath,
      event_type: event.eventType || 'http_request',
      event_data: sanitizedDetails,
      ip_address: event.ipAddress || null,
      user_agent: event.userAgent || null,
      severity: event.severity || 'medium',
      status_code: event.statusCode || null,
    };

    await this.executeRequest(async () => {
      const { error } = await this.supabase
        .from('security_audit_log' as any)
        .insert(payload as any);

      if (error) {
        logger.error('Failed to write security audit event', error, {
          requestId: event.requestId,
          action: event.action,
        });
        throw error;
      }
    }, { skipCache: true });
  }
}

export const securityAuditService = new SecurityAuditService();

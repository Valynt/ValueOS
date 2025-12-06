/**
 * Audit Log Service
 * 
 * AUD-301: Immutable audit logging for compliance (SOC 2, GDPR)
 * 
 * Features:
 * - Immutable logs (INSERT only, no UPDATE/DELETE)
 * - Cryptographic integrity (hash chain)
 * - Tenant isolation
 * - PII sanitization
 * - Compliance exports
 */

// Browser-compatible hash function (replaces Node.js crypto)
import { logger } from '../lib/logger';
import { sanitizeForLogging } from '../lib/piiFilter';
import { BaseService } from './BaseService';
import { AuditLogEntry } from '../types';

export interface AuditLogCreateInput {
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failed';
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  status?: 'success' | 'failed';
  limit?: number;
  offset?: number;
}

export interface AuditLogExportOptions {
  format: 'csv' | 'json';
  query?: AuditLogQuery;
}

export class AuditLogService extends BaseService {
  private lastHash: string | null = null;

  constructor() {
    super('AuditLogService');
  }

  /**
   * Convenience wrapper used by middleware hooks
   * Ensures all audit events persist through the immutable pipeline
   */
  async log(input: AuditLogCreateInput): Promise<AuditLogEntry> {
    return this.createEntry(input);
  }

  /**
   * Create an audit log entry (immutable)
   * AUD-301: Logs are INSERT-only with cryptographic integrity
   */
  async createEntry(input: AuditLogCreateInput): Promise<AuditLogEntry> {
    this.validateRequired(input, [
      'userId',
      'userName',
      'userEmail',
      'action',
      'resourceType',
      'resourceId',
    ]);

    return this.executeRequest(
      async () => {
        // Sanitize sensitive data
        const sanitizedDetails = input.details
          ? (sanitizeForLogging(input.details) as Record<string, unknown>)
          : {};

        // Calculate integrity hash (using secure SHA-256)
        const hash = await this.calculateHash({
          userId: input.userId,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          details: sanitizedDetails,
          previousHash: this.lastHash,
        });

        const logEntry = {
          user_id: input.userId,
          user_name: input.userName,
          user_email: input.userEmail,
          action: input.action,
          resource_type: input.resourceType,
          resource_id: input.resourceId,
          details: sanitizedDetails,
          ip_address: input.ipAddress || '',
          user_agent: input.userAgent || '',
          status: input.status || 'success',
          timestamp: new Date().toISOString(),
          integrity_hash: hash,
          previous_hash: this.lastHash || undefined,
        };

        const { data, error } = await this.supabase
          .from('audit_logs' as any)
          .insert(logEntry as any)
          .select()
          .single();

        if (error) {
          // CRITICAL: Audit logging failure must be escalated
          logger.error('CRITICAL: Audit logging failed', error, {
            action: input.action,
            resourceType: input.resourceType,
          });
          throw error;
        }

        this.lastHash = hash;
        return data as unknown as AuditLogEntry;
      },
      { skipCache: true }
    );
  }

  /**
   * Calculate cryptographic hash for integrity
   */
  private async calculateHash(data: any): Promise<string> {
    const content = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(content);
    // Use Web Crypto API for secure SHA-256 hash (browser-compatible)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Query audit logs with filters
   */
  async query(query: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
    super.log('info', 'Querying audit logs', query);

    return this.executeRequest(
      async () => {
        let dbQuery = this.supabase.from('audit_logs' as any).select('*');

        if (query.userId) {
          dbQuery = dbQuery.eq('user_id' as any, query.userId as any);
        }

        if (query.action) {
          dbQuery = dbQuery.eq('action' as any, query.action as any);
        }

        if (query.resourceType) {
          dbQuery = dbQuery.eq('resource_type' as any, query.resourceType as any);
        }

        if (query.status) {
          dbQuery = dbQuery.eq('status' as any, query.status as any);
        }

        if (query.startDate) {
          dbQuery = dbQuery.gte('timestamp', query.startDate);
        }

        if (query.endDate) {
          dbQuery = dbQuery.lte('timestamp', query.endDate);
        }

        dbQuery = dbQuery.order('timestamp', { ascending: false });

        if (query.limit) {
          dbQuery = dbQuery.limit(query.limit);
        }

        if (query.offset) {
          dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 50) - 1);
        }

        const { data, error } = await dbQuery;

        if (error) throw error;
        return (data || []) as unknown as AuditLogEntry[];
      },
      {
        deduplicationKey: `audit-logs-${JSON.stringify(query)}`,
      }
    );
  }

  /**
   * Get audit log by ID
   */
  async getById(id: string): Promise<AuditLogEntry | null> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('audit_logs' as any)
          .select('*')
          .eq('id' as any, id as any)
          .maybeSingle();

        if (error) throw error;
        return data as unknown as AuditLogEntry | null;
      },
      {
        deduplicationKey: `audit-log-${id}`,
      }
    );
  }

  /**
   * Export audit logs
   */
  async export(options: AuditLogExportOptions): Promise<string> {
    super.log('info', 'Exporting audit logs', options);

    const logs = await this.query(options.query);

    if (options.format === 'csv') {
      return this.exportToCsv(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; userName: string; count: number }>;
  }> {
    return this.executeRequest(
      async () => {
        const logs = await this.query({ startDate, endDate });

        const totalEvents = logs.length;
        const successfulEvents = logs.filter((l) => l.status === 'success').length;
        const failedEvents = logs.filter((l) => l.status === 'failed').length;

        const actionCounts = new Map<string, number>();
        logs.forEach((log) => {
          actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
        });

        const topActions = Array.from(actionCounts.entries())
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const userCounts = new Map<string, { userName: string; count: number }>();
        logs.forEach((log) => {
          const existing = userCounts.get(log.userId) || {
            userName: log.userName,
            count: 0,
          };
          userCounts.set(log.userId, {
            userName: log.userName,
            count: existing.count + 1,
          });
        });

        const topUsers = Array.from(userCounts.entries())
          .map(([userId, data]) => ({ userId, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return {
          totalEvents,
          successfulEvents,
          failedEvents,
          topActions,
          topUsers,
        };
      },
      {
        deduplicationKey: `audit-stats-${startDate}-${endDate}`,
      }
    );
  }

  /**
   * Convert logs to CSV format
   */
  private exportToCsv(logs: AuditLogEntry[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'User',
      'Email',
      'Action',
      'Resource Type',
      'Resource ID',
      'Status',
      'IP Address',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp,
      log.userName,
      log.userEmail,
      log.action,
      log.resourceType,
      log.resourceId,
      log.status,
      log.ipAddress,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Archive old audit logs (data retention)
   * AUD-301: Logs are immutable - archive instead of delete
   */
  async archiveOldLogs(olderThan: string): Promise<number> {
    logger.warn('Archiving old audit logs', { olderThan });

    return this.executeRequest(
      async () => {
        // Mark as archived instead of deleting
        const { data, error } = await this.supabase
          .from('audit_logs' as any)
          .update({ archived: true } as any)
          .lt('timestamp', olderThan)
          .select('id');

        if (error) throw error;

        const archivedCount = data?.length || 0;
        logger.info('Archived old audit logs', { count: archivedCount });

        this.clearCache();
        return archivedCount;
      },
      { skipCache: true }
    );
  }

  /**
   * Verify audit log integrity
   * AUD-301: Verify cryptographic hash chain
   */
  async verifyIntegrity(limit: number = 1000): Promise<{
    valid: boolean;
    errors: string[];
    checked: number;
  }> {
    logger.info('Verifying audit log integrity', { limit });

    const logs = await this.query({ limit });
    const errors: string[] = [];
    let previousHash: string | null = null;

    // Check in reverse chronological order
    for (let i = logs.length - 1; i >= 0; i--) {
      const log = logs[i] as any;

      // Verify hash chain
      if (log.previous_hash !== previousHash) {
        errors.push(
          `Hash chain broken at log ${log.id}: expected ${previousHash}, got ${log.previous_hash}`
        );
      }

      // Verify integrity hash (using secure SHA-256)
      const calculatedHash = await this.calculateHash({
        userId: log.user_id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        details: log.details,
        previousHash: log.previous_hash,
      });

      if (calculatedHash !== log.integrity_hash) {
        errors.push(
          `Integrity hash mismatch at log ${log.id}: expected ${log.integrity_hash}, got ${calculatedHash}`
        );
      }

      previousHash = log.integrity_hash || null;
    }

    const valid = errors.length === 0;

    if (!valid) {
      logger.error('Audit log integrity verification failed', undefined, {
        errors: errors.length,
        checked: logs.length,
      });
    } else {
      logger.info('Audit log integrity verified', {
        checked: logs.length,
      });
    }

    return {
      valid,
      errors,
      checked: logs.length,
    };
  }
}

export const auditLogService = new AuditLogService();
